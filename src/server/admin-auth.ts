import {createHash, createHmac, timingSafeEqual} from 'node:crypto';

// Sesión del administrador: una sola contraseña (ADMIN_PASSWORD) y una cookie
// firmada (HMAC) de corta duración. Sin cuentas ni base de usuarios.

export const ADMIN_COOKIE = 'adm';
export const SESSION_MS = 12 * 60 * 60 * 1000;

const sha = (s: string) => createHash('sha256').update(s).digest();

export function adminConfigured(env: {ADMIN_PASSWORD?: string}) {
	return !!env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length >= 8;
}

export function checkPassword(given: unknown, expected: string | undefined): boolean {
	if (typeof given !== 'string' || !expected) return false;
	return timingSafeEqual(sha(given), sha(expected));
}

export function signSession(secret: string, now = Date.now()): string {
	const exp = String(now + SESSION_MS);
	return `${exp}.${createHmac('sha256', secret).update(`admin:${exp}`).digest('base64url')}`;
}

export function verifySession(cookie: string | undefined | null, secret: string, now = Date.now()): boolean {
	if (!cookie) return false;
	const [exp, sig, ...rest] = cookie.split('.');
	if (!exp || !sig || rest.length || !/^\d+$/.test(exp) || Number(exp) <= now) return false;
	const expected = createHmac('sha256', secret).update(`admin:${exp}`).digest();
	let given: Buffer;
	try {
		given = Buffer.from(sig, 'base64url');
	} catch {
		return false;
	}
	return given.length === expected.length && timingSafeEqual(given, expected);
}

export function readCookie(header: string | null, name: string): string | undefined {
	if (!header) return undefined;
	for (const part of header.split(';')) {
		const i = part.indexOf('=');
		if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
	}
	return undefined;
}

/**
 * Defensa extra contra CSRF: en pedidos que modifican datos, el Origin debe ser el mismo sitio.
 * Sin Origin solo se acepta si el navegador declara `Sec-Fetch-Site: same-origin|none`;
 * un pedido sin ninguna de las dos cabeceras se rechaza.
 */
export function sameOrigin(headers: {get(n: string): string | null}): boolean {
	const origin = headers.get('origin');
	if (!origin) {
		const site = headers.get('sec-fetch-site');
		return site === 'same-origin' || site === 'none';
	}
	const host = headers.get('x-forwarded-host') ?? headers.get('host');
	try {
		return new URL(origin).host === host;
	} catch {
		return false;
	}
}
