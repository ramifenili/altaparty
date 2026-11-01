import {NextResponse} from 'next/server';
import {limited, RULES} from '../../../src/server';
import {getStore} from '../../../src/server/store';
import {EVENTS} from '../../../src/lib/events';

export const runtime = 'nodejs';

const dayKey = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // hora de Argentina

/** Contador de eventos del embudo. Solo cuenta: no guarda IP, cookies ni datos personales. */
export async function POST(req: Request) {
	const blocked = await limited(req, RULES.events);
	if (blocked) return blocked;
	const body = (await req.json().catch(() => ({}))) as {name?: unknown; templateId?: unknown};
	if (typeof body.name !== 'string' || !(EVENTS as readonly string[]).includes(body.name)) {
		return NextResponse.json({error: 'invalid'}, {status: 400});
	}
	const tpl = typeof body.templateId === 'string' && /^[a-z0-9-]{2,40}$/.test(body.templateId) ? body.templateId : undefined;
	await getStore().trackEvent(dayKey(), body.name, tpl);
	return new NextResponse(null, {status: 204});
}
