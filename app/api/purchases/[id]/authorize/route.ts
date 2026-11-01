import {NextResponse} from 'next/server';
import {errorResponse, getPurchaseService, limited, RULES} from '../../../../../src/server';

export const runtime = 'nodejs';

/** Emite la autorización de render final solo si el pago está aprobado en Mercado Pago. */
export async function POST(_req: Request, ctx: {params: Promise<{id: string}>}) {
	try {
		const blocked = await limited(_req, RULES.authorize);
		if (blocked) return blocked;
		const {id} = await ctx.params;
		const body = (await _req.json().catch(() => ({}))) as {kind?: unknown};
		const auth = await getPurchaseService().authorize(decodeURIComponent(id), body.kind);
		return NextResponse.json(auth, {headers: {'Cache-Control': 'no-store'}});
	} catch (e) {
		return errorResponse(e);
	}
}
