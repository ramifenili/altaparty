import {NextResponse} from 'next/server';
import {errorResponse, getPurchaseService, limited, RULES} from '../../../../src/server';
import {verifyMercadoPagoSignature} from '../../../../src/server/webhook';

export const runtime = 'nodejs';

/**
 * Notificaciones (webhooks) de Mercado Pago.
 * - Si MP_WEBHOOK_SECRET está configurada, exige una firma válida.
 * - No usa el contenido del aviso como prueba de pago: consulta el pago a la API.
 * - Responde 200 ante duplicados para que Mercado Pago no reintente.
 */
export async function POST(req: Request) {
	try {
		const blocked = await limited(req, RULES.webhook);
		if (blocked) return blocked;
		const url = new URL(req.url);
		const body = (await req.json().catch(() => ({}))) as {type?: string; data?: {id?: string | number}};
		const topic = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? body.type;
		const dataId = url.searchParams.get('data.id') ?? (body.data?.id !== undefined ? String(body.data.id) : null);

		const secret = process.env.MP_WEBHOOK_SECRET;
		if (secret) {
			const ok = verifyMercadoPagoSignature({
				secret,
				signatureHeader: req.headers.get('x-signature'),
				requestId: req.headers.get('x-request-id'),
				dataId,
			});
			if (!ok) return NextResponse.json({error: 'invalid_signature'}, {status: 401});
		} else if (process.env.NODE_ENV === 'production') {
			return NextResponse.json({error: 'webhook_not_configured'}, {status: 503});
		}

		if (topic !== 'payment' || !dataId) return NextResponse.json({ignored: true});
		const result = await getPurchaseService().handlePaymentNotification(dataId);
		return NextResponse.json(result);
	} catch (e) {
		return errorResponse(e);
	}
}
