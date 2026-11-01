import {NextResponse} from 'next/server';
import {requireAdmin} from '../../../../src/server/admin';

export const runtime = 'nodejs';

export async function GET(req: Request) {
	const denied = requireAdmin(req);
	if (denied) return denied;
	return NextResponse.json({ok: true, testMode: process.env.MP_FAKE_PAYMENTS === '1'}, {headers: {'Cache-Control': 'no-store'}});
}
