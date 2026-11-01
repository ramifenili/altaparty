import {createHmac, timingSafeEqual} from 'node:crypto';

// Autorización de descarga: token firmado con HMAC-SHA256 que el servidor
// emite SOLO después de comprobar el pago aprobado en Mercado Pago.
// Es de corta duración y no hace falta guardarlo en una base de datos.

/** `kind`: qué se autoriza a generar (el video MP4 o la imagen); sin él, el video. */
export type AuthPayload = {pid: string; tpl: string; exp: number; kind?: 'video' | 'image'};

const b64 = (b: Buffer) => b.toString('base64url');

export function signToken(payload: AuthPayload, secret: string): string {
	const body = b64(Buffer.from(JSON.stringify(payload)));
	const sig = b64(createHmac('sha256', secret).update(body).digest());
	return `${body}.${sig}`;
}

export function verifyToken(token: string, secret: string, now = Date.now()): AuthPayload | null {
	const [body, sig, ...rest] = token.split('.');
	if (!body || !sig || rest.length) return null;
	const expected = createHmac('sha256', secret).update(body).digest();
	let given: Buffer;
	try {
		given = Buffer.from(sig, 'base64url');
	} catch {
		return null;
	}
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
	try {
		const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AuthPayload;
		if (typeof p.pid !== 'string' || typeof p.tpl !== 'string' || typeof p.exp !== 'number') return null;
		if (p.exp <= now) return null;
		return p;
	} catch {
		return null;
	}
}
