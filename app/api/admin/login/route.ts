import {NextResponse} from 'next/server';
import {limited, RULES} from '../../../../src/server';
import {ADMIN_COOKIE, SESSION_MS, checkPassword, sameOrigin, signSession} from '../../../../src/server/admin-auth';
import {adminSecret} from '../../../../src/server/admin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
	if (!process.env.ADMIN_PASSWORD) {
		return NextResponse.json({error: 'admin_disabled', message: 'El panel está desactivado: falta configurar ADMIN_PASSWORD.'}, {status: 503});
	}
	if (!sameOrigin(req.headers)) return NextResponse.json({error: 'forbidden'}, {status: 403});
	const blocked = await limited(req, RULES.adminLogin);
	if (blocked) return blocked;
	const body = (await req.json().catch(() => ({}))) as {password?: unknown};
	if (!checkPassword(body.password, process.env.ADMIN_PASSWORD)) {
		await new Promise((r) => setTimeout(r, 600)); // frena ataques de fuerza bruta
		return NextResponse.json({error: 'bad_password', message: 'Contraseña incorrecta.'}, {status: 401});
	}
	const res = NextResponse.json({ok: true});
	res.cookies.set(ADMIN_COOKIE, signSession(adminSecret()), {
		httpOnly: true,
		sameSite: 'strict',
		secure: (process.env.APP_URL ?? '').startsWith('https://'),
		path: '/',
		maxAge: SESSION_MS / 1000,
	});
	return res;
}
