import fs from 'node:fs';
import path from 'node:path';
import {NextResponse} from 'next/server';

export const runtime = 'nodejs';

/**
 * Lista los archivos de public/templates/<id>/ para que el navegador sepa de una vez qué imágenes (png, gif, mp4…)
 * tiene cada plantilla y no tenga que probar extensión por extensión (cada prueba fallida era un 404).
 */
export async function GET(_req: Request, ctx: {params: Promise<{id: string}>}) {
	const {id} = await ctx.params;
	if (!/^[a-z0-9-]{2,40}$/.test(id)) return NextResponse.json({files: []}, {status: 400});
	let files: string[] = [];
	try {
		files = fs.readdirSync(path.join(process.cwd(), 'public', 'templates', id)).filter((f) => /\.(png|webp|jpe?g|gif|webm|mp4)$/i.test(f));
	} catch {
		/* la plantilla no tiene carpeta de imágenes */
	}
	return NextResponse.json({files}, {headers: {'Cache-Control': 'no-store'}});
}
