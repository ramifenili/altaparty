import {NextResponse} from 'next/server';
import {limited, RULES} from '../../../../src/server';
import {requireAdmin} from '../../../../src/server/admin';
import {getStore} from '../../../../src/server/store';
import {dayKey} from '../../../../src/server/stats';
import {buildUsage, usageLimits} from '../../../../src/server/usage';

export const runtime = 'nodejs';

/** Uso de la base y de los archivos: hoy, por día, por mes y cuánto falta para llenar el plan. */
export async function GET(req: Request) {
	const denied = requireAdmin(req);
	if (denied) return denied;
	const blocked = await limited(req, RULES.adminApi);
	if (blocked) return blocked;
	const store = getStore();
	const now = Date.now();
	const today = dayKey(now);
	const [used, history] = await Promise.all([store.measureUsage(), store.readUsage()]);
	await store.recordUsage(today, used);
	return NextResponse.json(buildUsage(used, today, history, usageLimits({DB_LIMIT_MB: process.env.DB_LIMIT_MB, BLOB_LIMIT_MB: process.env.BLOB_LIMIT_MB})), {headers: {'Cache-Control': 'no-store'}});
}
