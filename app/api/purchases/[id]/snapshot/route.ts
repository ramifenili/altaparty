import {NextResponse} from 'next/server';
import {errorResponse, getPurchaseService, limited, RULES} from '../../../../../src/server';

export const runtime = 'nodejs';

/** Datos que se compraron (de solo lectura). Solo con pago aprobado y compra vigente. */
export async function GET(req: Request, ctx: {params: Promise<{id: string}>}) {
	try {
		const blocked = await limited(req, RULES.purchaseStatus);
		if (blocked) return blocked;
		const {id} = await ctx.params;
		const s = await getPurchaseService().snapshot(decodeURIComponent(id));
		return NextResponse.json(s, {headers: {'Cache-Control': 'no-store'}});
	} catch (e) {
		return errorResponse(e);
	}
}
