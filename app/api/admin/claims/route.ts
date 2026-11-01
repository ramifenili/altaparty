import {NextResponse} from 'next/server';
import {getClaimService, limited, RULES} from '../../../../src/server';
import {requireAdmin} from '../../../../src/server/admin';

export const runtime = 'nodejs';

export async function GET(req: Request) {
	const denied = requireAdmin(req);
	if (denied) return denied;
	const blocked = await limited(req, RULES.adminApi);
	if (blocked) return blocked;
	return NextResponse.json(await getClaimService().list(), {headers: {'Cache-Control': 'no-store'}});
}
