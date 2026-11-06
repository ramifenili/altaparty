import {randomBytes} from 'node:crypto';
import {NextResponse} from 'next/server';
import {limited, RULES} from '../../../../src/server';
import {requireAdmin} from '../../../../src/server/admin';
import {getStore} from '../../../../src/server/store';
import {sniffMedia, safeFileName, MEDIA_LIMITS} from '../../../../src/server/media-sniff';

export const runtime = 'nodejs';

export async function GET(req: Request) {
	const denied = requireAdmin(req);
	if (denied) return denied;
	return NextResponse.json(await getStore().listMedia(), {headers: {'Cache-Control': 'no-store'}});
}

/** Sube un video o una imagen. Se valida el contenido real (no solo la extensión) y el tamaño. */
export async function POST(req: Request) {
	const denied = requireAdmin(req, {mutating: true});
	if (denied) return denied;
	const blocked = await limited(req, RULES.adminApi);
	if (blocked) return blocked;
	if (Number(req.headers.get('content-length') ?? 0) > MEDIA_LIMITS.video + 1_000_000) {
		return NextResponse.json({error: 'too_large', message: 'El archivo es demasiado grande.'}, {status: 413});
	}
	const form = await req.formData().catch(() => null);
	const file = form?.get('file');
	if (!(file instanceof File)) return NextResponse.json({error: 'invalid', message: 'Falta el archivo.'}, {status: 400});
	const buf = Buffer.from(await file.arrayBuffer());
	const kind = sniffMedia(buf);
	if (!kind) return NextResponse.json({error: 'invalid', message: 'Formato no permitido. Subí MP4/WebM, PNG/JPG/WebP o una tipografía TTF/OTF/WOFF.'}, {status: 415});
	if (buf.length > MEDIA_LIMITS[kind.kind]) {
		return NextResponse.json({error: 'too_large', message: `Pesa demasiado (máx. ${Math.round(MEDIA_LIMITS[kind.kind] / 1024 / 1024)} MB para ${kind.kind === 'video' ? 'videos' : kind.kind === 'font' ? 'tipografías' : 'imágenes'}).`}, {status: 413});
	}
	const id = randomBytes(10).toString('hex');
	const meta = await getStore().putMedia({id, kind: kind.kind, mime: kind.mime, bytes: buf.length, name: safeFileName(file.name)}, buf);
	return NextResponse.json(meta, {status: 201});
}
