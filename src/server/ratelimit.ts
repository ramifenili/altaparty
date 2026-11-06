// Límite de pedidos por IP para la API. No usa dependencias ni requiere cuenta:
//  - Por defecto, en memoria (suficiente en un servidor Node propio/VPS).
//  - Si existen UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN, usa Upstash
//    Redis (plan gratuito) para que el límite se comparta entre instancias
//    serverless (Vercel, etc.).
// Si el almacenamiento externo falla, el límite "se abre" (no se bloquea a
// usuarios legítimos por una caída): queda registrado en consola.

/** `failClosed`: si el almacenamiento del límite falla, el pedido se rechaza (para login y cobros). */
export type Rule = {name: string; limit: number; windowMs: number; failClosed?: boolean};

export type HitResult = {allowed: boolean; remaining: number; retryAfterSec: number};

export interface RateLimiter {
	hit(key: string, rule: Rule): Promise<HitResult>;
}

/** Reglas por ruta. Los valores más bajos protegen las que crean cobros o consultan a Mercado Pago. */
export const RULES = {
	createPurchase: {name: 'crear-compra', limit: 8, windowMs: 10 * 60_000, failClosed: true},
	purchaseStatus: {name: 'estado-compra', limit: 60, windowMs: 60_000},
	authorize: {name: 'autorizar', limit: 15, windowMs: 10 * 60_000, failClosed: true},
	verifyAuth: {name: 'verificar-autorizacion', limit: 30, windowMs: 60_000},
	delivered: {name: 'entregado', limit: 15, windowMs: 10 * 60_000},
	claimSubmit: {name: 'canje-gratis', limit: 5, windowMs: 10 * 60_000, failClosed: true},
	claimStatus: {name: 'canje-estado', limit: 60, windowMs: 60_000},
	webhook: {name: 'webhook', limit: 600, windowMs: 60_000},
	adminLogin: {name: 'admin-login', limit: 6, windowMs: 10 * 60_000, failClosed: true},
	adminApi: {name: 'admin-api', limit: 300, windowMs: 60_000},
	events: {name: 'eventos', limit: 120, windowMs: 60_000},
	config: {name: 'config', limit: 120, windowMs: 60_000},
	media: {name: 'media', limit: 600, windowMs: 60_000},
} satisfies Record<string, Rule>;

export class MemoryLimiter implements RateLimiter {
	private buckets = new Map<string, {count: number; resetAt: number}>();
	private now: () => number;

	constructor(now: () => number = () => Date.now()) {
		this.now = now;
	}

	async hit(key: string, rule: Rule): Promise<HitResult> {
		const t = this.now();
		if (this.buckets.size > 5000) {
			for (const [k, b] of this.buckets) if (b.resetAt <= t) this.buckets.delete(k);
			if (this.buckets.size > 5000) this.buckets.clear(); // tope de memoria
		}
		const id = `${rule.name}:${key}`;
		let b = this.buckets.get(id);
		if (!b || b.resetAt <= t) {
			b = {count: 0, resetAt: t + rule.windowMs};
			this.buckets.set(id, b);
		}
		b.count++;
		return {
			allowed: b.count <= rule.limit,
			remaining: Math.max(0, rule.limit - b.count),
			retryAfterSec: Math.max(1, Math.ceil((b.resetAt - t) / 1000)),
		};
	}
}

export class UpstashLimiter implements RateLimiter {
	private url: string;
	private token: string;

	constructor(url: string, token: string) {
		this.url = url.replace(/\/$/, '');
		this.token = token;
	}

	async hit(key: string, rule: Rule): Promise<HitResult> {
		// ventana fija: INCR + PEXPIRE NX en un solo pedido, y PTTL para saber cuánto falta
		const bucket = Math.floor(Date.now() / rule.windowMs);
		const k = `rl:${rule.name}:${key}:${bucket}`;
		const res = await fetch(`${this.url}/pipeline`, {
			method: 'POST',
			headers: {Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json'},
			body: JSON.stringify([['INCR', k], ['PEXPIRE', k, String(rule.windowMs), 'NX'], ['PTTL', k]]),
		});
		if (!res.ok) throw new Error('Upstash HTTP ' + res.status);
		const out = (await res.json()) as {result: number}[];
		const count = Number(out[0]?.result ?? 1);
		const ttl = Number(out[2]?.result ?? rule.windowMs);
		return {allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count), retryAfterSec: Math.max(1, Math.ceil(ttl / 1000))};
	}
}

let shared: RateLimiter | null = null;
export function getLimiter(): RateLimiter {
	if (shared) return shared;
	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;
	if (!(url && token) && process.env.VERCEL) {
		console.warn('[ratelimit] En Vercel falta UPSTASH_REDIS_REST_URL/TOKEN: el límite en memoria no se comparte entre instancias y casi no protege.');
	}
	shared = url && token ? new UpstashLimiter(url, token) : new MemoryLimiter();
	return shared;
}

/**
 * IP del cliente. En Vercel se usa `x-vercel-forwarded-for`, que pone la plataforma y el cliente
 * NO puede falsificar (a diferencia de `x-forwarded-for`, cuyo primer valor lo puede escribir cualquiera).
 * Fuera de Vercel solo es confiable si un proxy propio (Nginx, Cloudflare) reescribe esas cabeceras.
 */
export function clientIp(headers: {get(name: string): string | null}, env: Record<string, string | undefined> = process.env) {
	if (env.VERCEL) {
		const v = headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
		if (v) return v;
	}
	const fwd = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
	return fwd || headers.get('x-real-ip')?.trim() || 'sin-ip';
}

export async function checkLimit(limiter: RateLimiter, headers: {get(name: string): string | null}, rule: Rule): Promise<HitResult> {
	try {
		return await limiter.hit(clientIp(headers), rule);
	} catch (e) {
		if (rule.failClosed) {
			console.error('[ratelimit] falló el almacenamiento, se rechaza el pedido (ruta sensible):', e);
			return {allowed: false, remaining: 0, retryAfterSec: 30};
		}
		console.error('[ratelimit] falló el almacenamiento, se deja pasar el pedido:', e);
		return {allowed: true, remaining: rule.limit, retryAfterSec: 1};
	}
}
