import {NextResponse} from 'next/server';
import {errorResponse, getClaimService, limited, RULES} from '../../../src/server';

export const runtime = 'nodejs';

/** Un canje gratis: enlace de un posteo público + contacto. Queda pendiente hasta que una persona lo revise. */
export async function POST(req: Request) {
	try {
		const blocked = await limited(req, RULES.claimSubmit);
		if (blocked) return blocked;
		if (Number(req.headers.get('content-length') ?? 0) > 4_000) {
			return NextResponse.json({error: 'invalid', message: 'Los datos enviados son demasiado grandes.'}, {status: 413});
		}
		const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
		const claim = await getClaimService().submit(body);
		return NextResponse.json(claim, {status: 201, headers: {'Cache-Control': 'no-store'}});
	} catch (e) {
		return errorResponse(e);
	}
}
