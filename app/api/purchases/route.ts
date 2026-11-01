import {NextResponse} from 'next/server';
import {errorResponse, getPurchaseService, limited, RULES} from '../../../src/server';

export const runtime = 'nodejs';

/** Crea la compra y la preferencia de Mercado Pago. El importe lo define el servidor. */
export async function POST(req: Request) {
	try {
		const blocked = await limited(req, RULES.createPurchase);
		if (blocked) return blocked;
		// los datos de la invitación + una foto reducida (JPEG ≤ 700 KB) caben holgados en 1,5 MB
		if (Number(req.headers.get('content-length') ?? 0) > 1_500_000) {
			return NextResponse.json({error: 'invalid', message: 'Los datos enviados son demasiado grandes.'}, {status: 413});
		}
		const body = (await req.json().catch(() => ({}))) as {templateId?: unknown; snapshot?: {data?: unknown; audio?: unknown; photo?: unknown}; product?: unknown; upgradeFrom?: unknown};
		const purchase = await getPurchaseService().create(body.templateId, body.snapshot, body.product, body.upgradeFrom);
		return NextResponse.json(purchase, {status: 201});
	} catch (e) {
		return errorResponse(e);
	}
}
