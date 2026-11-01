import {NextResponse} from 'next/server';
import {limited, RULES} from '../../../../src/server';
import {requireAdmin} from '../../../../src/server/admin';
import {getStore} from '../../../../src/server/store';

export const runtime = 'nodejs';

export async function GET(req: Request) {
	const denied = requireAdmin(req);
	if (denied) return denied;
	return NextResponse.json(await getStore().listCompiled(), {headers: {'Cache-Control': 'no-store'}});
}

/** Crea o actualiza un video compilado (la definición se valida y limpia en el servidor). */
export async function POST(req: Request) {
	const denied = requireAdmin(req, {mutating: true});
	if (denied) return denied;
	const blocked = await limited(req, RULES.adminApi);
	if (blocked) return blocked;
	if (Number(req.headers.get('content-length') ?? 0) > 2_000_000) return NextResponse.json({error: 'too_large'}, {status: 413});
	const body = await req.json().catch(() => null);
	const spec = await getStore().saveCompiled(body);
	if (!spec) return NextResponse.json({error: 'invalid', message: 'La definición no es válida: necesita un nombre y al menos una escena.'}, {status: 400});
	return NextResponse.json(spec);
}
