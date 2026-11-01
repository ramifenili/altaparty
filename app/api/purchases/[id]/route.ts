import {NextResponse} from 'next/server';
import {errorResponse, getPurchaseService, limited, RULES} from '../../../../src/server';

export const runtime = 'nodejs';

/** Estado real de la compra, consultado a Mercado Pago (nunca a parámetros del cliente). */
export async function GET(_req: Request, ctx: {params: Promise<{id: string}>}) {
	try {
		const blocked = await limited(_req, RULES.purchaseStatus);
		if (blocked) return blocked;
		const {id} = await ctx.params;
		const s = await getPurchaseService().status(decodeURIComponent(id));
		return NextResponse.json(s, {headers: {'Cache-Control': 'no-store'}});
	} catch (e) {
		return errorResponse(e);
	}
}
