import {NextResponse} from 'next/server';
import {ConfigError, MercadoPagoGateway} from './gateway.ts';
import {createPurchaseService, PurchaseError, type PurchaseService} from './purchases.ts';
import {ClaimError, createClaimService, type ClaimService} from './claims.ts';
import {getStore} from './store.ts';
import {isBuiltinTemplate} from '../templates/ids.ts';
import {FakeGateway, fakePaymentsAllowed} from './fake-gateway.ts';
import {checkLimit, getLimiter, type Rule} from './ratelimit.ts';

let service: PurchaseService | null = null;

/** Servicio de compras con las credenciales del entorno (solo servidor). */
export function getPurchaseService(): PurchaseService {
	if (service) return service;
	const isProd = process.env.NODE_ENV === 'production';
	const tokenSecret = process.env.PURCHASE_TOKEN_SECRET;
	if (!tokenSecret && isProd) {
		throw new ConfigError('Falta configurar PURCHASE_TOKEN_SECRET en el servidor.');
	}
	const testMode = fakePaymentsAllowed(process.env);
	if (testMode) console.warn('[pagos] MODO PRUEBA: los pagos son simulados (MP_FAKE_PAYMENTS=1). No usar en un sitio público.');
	const store = getStore();
	service = createPurchaseService({
		testMode,
		gateway: testMode ? new FakeGateway() : new MercadoPagoGateway(process.env.MP_ACCESS_TOKEN),
		store,
		getSettings: () => store.getSettings(),
		isTemplateAvailable: async (id) => {
			if (isBuiltinTemplate(id)) return true;
			const spec = await store.getCompiled(id);
			return !!spec?.enabled;
		},
		appUrl: (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
		tokenSecret: tokenSecret ?? 'solo-desarrollo-no-usar-en-produccion',
	});
	// limpieza automática de datos vencidos: al iniciar y cada hora
	void service.purge();
	const timer = setInterval(() => void service?.purge(), 60 * 60 * 1000);
	timer.unref?.();
	return service;
}

let claims: ClaimService | null = null;

/** Servicio de canjes gratis (programa de difusión). */
export function getClaimService(): ClaimService {
	if (claims) return claims;
	const store = getStore();
	claims = createClaimService({
		store,
		grant: (templateId, claimId) => getPurchaseService().grantFree(templateId, claimId),
		isTemplateAvailable: async (id) => {
			if (isBuiltinTemplate(id)) return true;
			return !!(await store.getCompiled(id))?.enabled;
		},
	});
	void claims.purge();
	const timer = setInterval(() => void claims?.purge(), 6 * 60 * 60 * 1000);
	timer.unref?.();
	return claims;
}

/** Aplica el límite de pedidos. Devuelve la respuesta 429 si se superó, o null si puede seguir. */
export async function limited(req: Request, rule: Rule) {
	const r = await checkLimit(getLimiter(), req.headers, rule);
	if (r.allowed) return null;
	return NextResponse.json(
		{error: 'rate_limited', message: 'Hiciste demasiados intentos seguidos. Esperá un momento y probá de nuevo.'},
		{status: 429, headers: {'Retry-After': String(r.retryAfterSec)}}
	);
}

/** Convierte errores de dominio en respuestas JSON sin filtrar detalles internos. */
export function errorResponse(e: unknown) {
	if (e instanceof PurchaseError) {
		return NextResponse.json({error: e.code, message: e.message}, {status: e.http});
	}
	if (e instanceof ClaimError) {
		return NextResponse.json({error: e.code, message: e.message}, {status: e.http});
	}
	if (e instanceof ConfigError) {
		return NextResponse.json({error: 'not_configured', message: e.message}, {status: 503});
	}
	console.error('[pagos]', e);
	return NextResponse.json({error: 'server_error', message: 'No pudimos completar la operación. Intentá de nuevo en unos minutos.'}, {status: 502});
}

export {RULES} from './ratelimit.ts';
