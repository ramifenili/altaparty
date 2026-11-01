import {createHmac, timingSafeEqual} from 'node:crypto';

/**
 * Valida la firma `x-signature` de las notificaciones de Mercado Pago.
 * Manifiesto oficial: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * firmado con HMAC-SHA256 usando la "clave secreta" del webhook.
 */
export function verifyMercadoPagoSignature(o: {
	secret: string;
	signatureHeader: string | null;
	requestId: string | null;
	dataId: string | null;
	now?: number;
	toleranceMs?: number;
}): boolean {
	if (!o.signatureHeader || !o.requestId || !o.dataId) return false;
	const parts = Object.fromEntries(
		o.signatureHeader.split(',').map((kv) => {
			const i = kv.indexOf('=');
			return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
		})
	);
	const ts = parts.ts;
	const v1 = parts.v1;
	if (!ts || !v1) return false;
	const id = /^[a-z0-9]+$/i.test(o.dataId) ? o.dataId.toLowerCase() : o.dataId;
	const manifest = `id:${id};request-id:${o.requestId};ts:${ts};`;
	const expected = createHmac('sha256', o.secret).update(manifest).digest('hex');
	const a = Buffer.from(expected);
	const b = Buffer.from(v1);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
	const tol = o.toleranceMs ?? 15 * 60 * 1000;
	const tsNum = Number(ts);
	if (Number.isFinite(tsNum) && Math.abs((o.now ?? Date.now()) - tsNum) > tol) return false;
	return true;
}
