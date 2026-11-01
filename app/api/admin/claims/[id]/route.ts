import {NextResponse} from 'next/server';
import {errorResponse, getClaimService, limited, RULES} from '../../../../../src/server';
import {requireAdmin} from '../../../../../src/server/admin';

export const runtime = 'nodejs';

/** Aprueba (crea el código gratis) o rechaza un canje. */
export async function POST(req: Request, ctx: {params: Promise<{id: string}>}) {
	try {
		const denied = requireAdmin(req, {mutating: true});
		if (denied) return denied;
		const blocked = await limited(req, RULES.adminApi);
		if (blocked) return blocked;
		const {id} = await ctx.params;
		const body = (await req.json().catch(() => ({}))) as {action?: unknown; note?: unknown};
		const claim = await getClaimService().decide(id, body.action, body.note);
		return NextResponse.json(claim, {headers: {'Cache-Control': 'no-store'}});
	} catch (e) {
		return errorResponse(e);
	}
}
