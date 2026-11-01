import {NextResponse} from 'next/server';
import {getClaimService, getPurchaseService} from '../../../../src/server';
import {getStore} from '../../../../src/server/store';
import {dayKey} from '../../../../src/server/stats';

export const runtime = 'nodejs';

/**
 * Tarea diaria (Vercel Cron): borra los datos vencidos y guarda el registro de uso de espacio.
 * Vercel la llama con `Authorization: Bearer <CRON_SECRET>`; sin esa variable queda desactivada.
 */
export async function GET(req: Request) {
	const secret = process.env.CRON_SECRET;
	if (!secret) return NextResponse.json({error: 'cron_not_configured'}, {status: 503});
	if (req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({error: 'unauthorized'}, {status: 401});
	const purchases = await getPurchaseService().purge();
	const claims = await getClaimService().purge();
	const store = getStore();
	await store.recordUsage(dayKey(Date.now()), await store.measureUsage());
	return NextResponse.json({purchases, claims});
}
