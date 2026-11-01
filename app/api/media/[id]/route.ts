import {NextResponse} from 'next/server';
import {limited, RULES} from '../../../../src/server';
import {getStore} from '../../../../src/server/store';

export const runtime = 'nodejs';

/** Sirve un medio subido por el admin (video, imagen) con soporte de rangos para reproducir videos. */
export async function GET(req: Request, ctx: {params: Promise<{id: string}>}) {
	const blocked = await limited(req, RULES.media);
	if (blocked) return blocked;
	const {id} = await ctx.params;
	if (!/^[a-z0-9]{8,32}$/.test(id)) return new NextResponse(null, {status: 404});
	const media = await getStore().serveMedia(id, req.headers.get('range'));
	if (!media) return new NextResponse(null, {status: 404});
	return new NextResponse(media.body, {status: media.status, headers: media.headers});
}
