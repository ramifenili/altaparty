import {NextResponse} from 'next/server';
import {limited, RULES} from '../../../../src/server';
import {getStore} from '../../../../src/server/store';
import {OG_ID_RE, ogMediaId} from '../../../../src/server/og';

export const runtime = 'nodejs';

/** Imagen para compartir de una plantilla (la usan WhatsApp, X, Facebook…). Con ?v=<versión> se puede cachear para siempre. */
export async function GET(req: Request, ctx: {params: Promise<{id: string}>}) {
	const blocked = await limited(req, RULES.media);
	if (blocked) return blocked;
	const {id} = await ctx.params;
	if (!OG_ID_RE.test(id)) return new NextResponse(null, {status: 404});
	const media = await getStore().serveMedia(ogMediaId(id), null);
	if (!media) return new NextResponse(null, {status: 404});
	const versioned = new URL(req.url).searchParams.has('v');
	return new NextResponse(media.body, {
		status: media.status,
		headers: {...media.headers, 'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'},
	});
}
