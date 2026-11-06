import {NextResponse} from 'next/server';
import {limited, RULES} from '../../../../../src/server';
import {requireAdmin} from '../../../../../src/server/admin';
import {getStore} from '../../../../../src/server/store';
import {sniffMedia} from '../../../../../src/server/media-sniff';
import {OG_ID_RE, OG_MAX_BYTES, ogMediaId, ogName, ogPath, ogVersion, templateExists} from '../../../../../src/server/og';

export const runtime = 'nodejs';

/** Versión de la imagen guardada (null si no hay), para saber si hay que volver a generarla. */
export async function GET(req: Request, ctx: {params: Promise<{id: string}>}) {
	const denied = requireAdmin(req);
	if (denied) return denied;
	const {id} = await ctx.params;
	if (!OG_ID_RE.test(id)) return NextResponse.json({error: 'invalid'}, {status: 400});
	const version = await ogVersion(id);
	return NextResponse.json({version, url: version ? ogPath(id, version) : null}, {headers: {'Cache-Control': 'no-store'}});
}

/** Guarda la imagen para compartir de la plantilla: JPG o PNG, más la versión con la que se dibujó. */
export async function POST(req: Request, ctx: {params: Promise<{id: string}>}) {
	const denied = requireAdmin(req, {mutating: true});
	if (denied) return denied;
	const blocked = await limited(req, RULES.adminApi);
	if (blocked) return blocked;
	const {id} = await ctx.params;
	if (!OG_ID_RE.test(id) || !(await templateExists(id))) return NextResponse.json({error: 'invalid', message: 'La plantilla no existe.'}, {status: 404});
	if (Number(req.headers.get('content-length') ?? 0) > OG_MAX_BYTES + 100_000) return NextResponse.json({error: 'too_large', message: 'La imagen pesa demasiado.'}, {status: 413});
	const form = await req.formData().catch(() => null);
	const file = form?.get('file');
	const version = String(form?.get('version') ?? '');
	if (!(file instanceof File) || !/^[a-z0-9]{4,16}$/.test(version)) return NextResponse.json({error: 'invalid', message: 'Faltan datos.'}, {status: 400});
	const buf = Buffer.from(await file.arrayBuffer());
	const kind = sniffMedia(buf);
	if (kind?.kind !== 'image' || kind.mime === 'image/webp') return NextResponse.json({error: 'invalid', message: 'Tiene que ser una imagen JPG o PNG.'}, {status: 415});
	if (buf.length > OG_MAX_BYTES) return NextResponse.json({error: 'too_large', message: 'La imagen pesa demasiado.'}, {status: 413});
	await getStore().putMedia({id: ogMediaId(id), kind: 'image', mime: kind.mime, bytes: buf.length, name: ogName(version)}, buf);
	return NextResponse.json({version, url: ogPath(id, version)}, {status: 201});
}
