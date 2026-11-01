import {NextResponse} from 'next/server';
import {errorResponse, getPurchaseService, limited, RULES} from '../../../../src/server';

export const runtime = 'nodejs';

/** Verifica firma y vencimiento de una autorización antes de permitir el render sin marca de agua. */
export async function POST(req: Request) {
	try {
		const blocked = await limited(req, RULES.verifyAuth);
		if (blocked) return blocked;
		const body = (await req.json().catch(() => ({}))) as {token?: unknown};
		const auth = getPurchaseService().checkAuthorization(body.token);
		return NextResponse.json({valid: true, ...auth}, {headers: {'Cache-Control': 'no-store'}});
	} catch (e) {
		return errorResponse(e);
	}
}
