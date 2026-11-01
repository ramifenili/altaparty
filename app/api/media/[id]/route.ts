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
	const store = getStore();
	const meta = await store.getMediaMeta(id);
	const buf = meta ? await store.db.readFile(`media-${id}`) : null;
	if (!meta || !buf) return new NextResponse(null, {status: 404});

	const headers: Record<string, string> = {
		'Content-Type': meta.mime,
		'Accept-Ranges': 'bytes',
		'Cache-Control': 'public, max-age=3600',
		'X-Content-Type-Options': 'nosniff',
	};
	const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
	if (range) {
		const start = range[1] ? Number(range[1]) : 0;
		const end = Math.min(buf.length - 1, range[2] ? Number(range[2]) : buf.length - 1);
		if (start > end || start >= buf.length) return new NextResponse(null, {status: 416, headers: {'Content-Range': `bytes */${buf.length}`}});
		const part = buf.subarray(start, end + 1);
		return new NextResponse(new Uint8Array(part), {status: 206, headers: {...headers, 'Content-Range': `bytes ${start}-${end}/${buf.length}`, 'Content-Length': String(part.length)}});
	}
	return new NextResponse(new Uint8Array(buf), {headers: {...headers, 'Content-Length': String(buf.length)}});
}
