import {NextResponse} from 'next/server';
import {limited, RULES} from '../../../../src/server';
import {requireAdmin} from '../../../../src/server/admin';
import {getStore} from '../../../../src/server/store';

export const runtime = 'nodejs';

export async function GET(req: Request) {
	const denied = requireAdmin(req);
	if (denied) return denied;
	return NextResponse.json(await getStore().getSettings(), {headers: {'Cache-Control': 'no-store'}});
}

export async function PUT(req: Request) {
	const denied = requireAdmin(req, {mutating: true});
	if (denied) return denied;
	const blocked = await limited(req, RULES.adminApi);
	if (blocked) return blocked;
	const body = await req.json().catch(() => null);
	if (!body) return NextResponse.json({error: 'invalid', message: 'Datos inválidos.'}, {status: 400});
	// normalizeSettings acota y valida todo: nunca se guarda el JSON crudo
	return NextResponse.json(await getStore().saveSettings(body));
}
