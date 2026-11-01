import {NextResponse} from 'next/server';
import {errorResponse, getClaimService, limited, RULES} from '../../../../src/server';

export const runtime = 'nodejs';

/** Estado del canje (y el código de compra si ya fue aprobado). */
export async function GET(req: Request, ctx: {params: Promise<{id: string}>}) {
	try {
		const blocked = await limited(req, RULES.claimStatus);
		if (blocked) return blocked;
		const {id} = await ctx.params;
		const c = await getClaimService().status(decodeURIComponent(id));
		return NextResponse.json(c, {headers: {'Cache-Control': 'no-store'}});
	} catch (e) {
		return errorResponse(e);
	}
}
