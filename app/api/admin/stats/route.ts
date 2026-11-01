import {NextResponse} from 'next/server';
import {limited, RULES} from '../../../../src/server';
import {requireAdmin} from '../../../../src/server/admin';
import {getStore} from '../../../../src/server/store';
import {buildStats} from '../../../../src/server/stats';

export const runtime = 'nodejs';

export async function GET(req: Request) {
	const denied = requireAdmin(req);
	if (denied) return denied;
	const blocked = await limited(req, RULES.adminApi);
	if (blocked) return blocked;
	const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get('days')) || 30));
	const store = getStore();
	const [events, purchases] = await Promise.all([store.readEvents(), store.listPurchases(5000)]);
	return NextResponse.json(buildStats(events, purchases, days, Date.now()), {headers: {'Cache-Control': 'no-store'}});
}
