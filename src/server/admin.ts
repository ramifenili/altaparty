import {NextResponse} from 'next/server';
import {ADMIN_COOKIE, readCookie, sameOrigin, verifySession} from './admin-auth.ts';

export function adminSecret() {
	return process.env.ADMIN_SECRET ?? process.env.PURCHASE_TOKEN_SECRET ?? 'solo-desarrollo-no-usar-en-produccion';
}

/** Devuelve una respuesta de error si el pedido NO viene de un administrador con sesión; null si puede seguir. */
export function requireAdmin(req: Request, opts: {mutating?: boolean} = {}): NextResponse | null {
	if (!process.env.ADMIN_PASSWORD) {
		return NextResponse.json({error: 'admin_disabled', message: 'El panel está desactivado: falta configurar ADMIN_PASSWORD.'}, {status: 503});
	}
	if (opts.mutating && !sameOrigin(req.headers)) {
		return NextResponse.json({error: 'forbidden', message: 'Origen no permitido.'}, {status: 403});
	}
	const cookie = readCookie(req.headers.get('cookie'), ADMIN_COOKIE);
	if (!verifySession(cookie, adminSecret())) {
		return NextResponse.json({error: 'unauthorized', message: 'Iniciá sesión para continuar.'}, {status: 401, headers: {'Cache-Control': 'no-store'}});
	}
	return null;
}
