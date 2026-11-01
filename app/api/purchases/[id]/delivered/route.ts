import {NextResponse} from 'next/server';
import {errorResponse, getPurchaseService, limited, RULES} from '../../../../../src/server';
import {PurchaseError} from '../../../../../src/server/purchases';

export const runtime = 'nodejs';

/** El cliente avisa que terminó de exportar el MP4 final. Requiere la autorización vigente. */
export async function POST(req: Request, ctx: {params: Promise<{id: string}>}) {
	try {
		const blocked = await limited(req, RULES.delivered);
		if (blocked) return blocked;
		const {id} = await ctx.params;
		const body = (await req.json().catch(() => ({}))) as {token?: unknown};
		const svc = getPurchaseService();
		const auth = svc.checkAuthorization(body.token);
		if (auth.purchaseId !== decodeURIComponent(id)) {
			throw new PurchaseError('La autorización no corresponde a esta compra.', 'bad_token', 403);
		}
		return NextResponse.json(await svc.markDelivered(body.token));
	} catch (e) {
		return errorResponse(e);
	}
}
