// Imágenes de las plantillas de código. Cada plantilla que las usa declara `assets` (nombres sin extensión) y sus
// archivos viven en `public/templates/<id>/`. Para cambiar una imagen basta con reemplazar el archivo de esa carpeta
// y recargar: no hace falta tocar código ni el panel.
//
// Formatos: PNG, WebP o JPG (fijos) y también GIF animado, WebM o MP4 (animados). Si hay varios con el mismo nombre
// se usa el animado (gif, webm, mp4) y, después, png, webp, jpg. Un GIF animado o un video se decodifica al cargar a
// una lista de cuadros (con un tope de tamaño y de memoria) y `tplImage(id, nombre, t)` devuelve el cuadro que
// corresponde al segundo `t`, repitiéndose en bucle. Sin `t` devuelve el primer cuadro. Un video no tiene transparencia.
//
// El dibujo es síncrono, así que las imágenes se cargan ANTES de dibujar (vista previa, miniaturas y exportación) y se
// consultan con `tplImage`. En la exportación el Worker recibe copias decodificadas (ver frames.ts y frameWorker.ts).
// Si falta un archivo, `tplImage` devuelve null y la plantilla debe dibujar su alternativa sin imagen.

import type {TemplateDefinition} from './types';

export type TplImage = CanvasImageSource & {width: number; height: number};

/** Imagen animada: cuadros y el segundo (acumulado) en que termina cada uno. */
export type TplAnim = {frames: TplImage[]; ends: number[]};

export const TEMPLATE_ANIM_EXTS = ['gif', 'webm', 'mp4'] as const;
export const TEMPLATE_IMAGE_EXTS = ['png', 'webp', 'jpg', 'jpeg'] as const;

/** Ancho máximo de los cuadros animados, tope de memoria de una animación y de duración del video. */
const ANIM_MAX_W = 540;
const ANIM_BUDGET_BYTES = 110 * 1024 * 1024;
const VIDEO_MAX_SECONDS = 8;
const VIDEO_FPS = 24;

const images = new Map<string, TplImage>();
const anims = new Map<string, TplAnim>();
/** claves cargadas solo como miniatura (primer cuadro de un GIF o video): falta la animación completa */
const partial = new Set<string>();
const pending = new Map<string, Promise<unknown>>();

const keyOf = (templateId: string, name: string) => `${templateId}/${name}`;

function frameAt(a: TplAnim, t: number): TplImage {
	const dur = a.ends[a.ends.length - 1] || 1;
	const x = ((t % dur) + dur) % dur;
	let i = 0;
	while (i < a.ends.length - 1 && x >= a.ends[i]) i++;
	return a.frames[i];
}

/**
 * Imagen ya cargada de una plantilla, o null si falta (el archivo no existe o todavía no se cargó). Si es animada
 * (GIF o video), devuelve el cuadro del segundo `t` (el primero si no se indica `t`).
 */
export function tplImage(templateId: string, name: string, t?: number): TplImage | null {
	const k = keyOf(templateId, name);
	const a = anims.get(k);
	if (a) return t === undefined ? a.frames[0] : frameAt(a, t);
	return images.get(k) ?? null;
}

type Loaded = {still: TplImage; animated?: boolean} | {anim: TplAnim};

type ImageDecoderLike = {
	tracks: {ready: Promise<unknown>; selectedTrack?: {frameCount: number} | null};
	decode(o: {frameIndex: number}): Promise<{image: VideoFrame}>;
	close(): void;
};
type ImageDecoderCtor = new (init: {data: ArrayBuffer; type: string}) => ImageDecoderLike;

async function decodeGif(blob: Blob): Promise<Loaded | null> {
	const Dec = (globalThis as unknown as {ImageDecoder?: ImageDecoderCtor}).ImageDecoder;
	// sin ImageDecoder (p. ej. Firefox) se ve el primer cuadro
	if (!Dec) return {still: await createImageBitmap(blob)};
	const dec = new Dec({data: await blob.arrayBuffer(), type: 'image/gif'});
	try {
		await dec.tracks.ready;
		const n = dec.tracks.selectedTrack?.frameCount ?? 1;
		if (n <= 1) return {still: await createImageBitmap(blob)};
		const first = (await dec.decode({frameIndex: 0})).image;
		const scale = Math.min(1, ANIM_MAX_W / first.displayWidth);
		const w = Math.max(1, Math.round(first.displayWidth * scale));
		const h = Math.max(1, Math.round(first.displayHeight * scale));
		first.close();
		// si no entra en la memoria, se queda con un cuadro de cada `step` (el que se queda dura lo de los que se saltean)
		const step = Math.max(1, Math.ceil((n * w * h * 4) / ANIM_BUDGET_BYTES));
		const frames: ImageBitmap[] = [];
		const ends: number[] = [];
		let acc = 0;
		for (let i = 0; i < n; i++) {
			const {image} = await dec.decode({frameIndex: i});
			const d = (image.duration ?? 0) / 1e6;
			acc += d > 0.011 ? d : 0.1;
			if (i % step === 0) frames.push(await createImageBitmap(image, {resizeWidth: w, resizeHeight: h}));
			ends[frames.length - 1] = acc;
			image.close();
		}
		return {anim: {frames, ends}};
	} finally {
		dec.close();
	}
}

async function decodeVideo(blob: Blob, maxFrames = Infinity): Promise<Loaded | null> {
	const url = URL.createObjectURL(blob);
	try {
		const v = document.createElement('video');
		v.muted = true;
		v.playsInline = true;
		v.preload = 'auto';
		v.src = url;
		await new Promise<void>((res, rej) => {
			v.onloadeddata = () => res();
			v.onerror = () => rej(new Error('video'));
		});
		const dur = Math.min(v.duration || 1, VIDEO_MAX_SECONDS);
		const scale = Math.min(1, ANIM_MAX_W / v.videoWidth);
		const w = Math.max(1, Math.round(v.videoWidth * scale));
		const h = Math.max(1, Math.round(v.videoHeight * scale));
		const n = Math.max(1, Math.floor(Math.min(dur * VIDEO_FPS, ANIM_BUDGET_BYTES / (w * h * 4), maxFrames)));
		const frames: ImageBitmap[] = [];
		const ends: number[] = [];
		for (let i = 0; i < n; i++) {
			await new Promise<void>((res) => {
				v.onseeked = () => res();
				v.currentTime = Math.min((i * dur) / n, Math.max(0, v.duration - 0.01));
			});
			frames.push(await createImageBitmap(v, {resizeWidth: w, resizeHeight: h}));
			ends.push(((i + 1) * dur) / n);
		}
		return {anim: {frames, ends}};
	} finally {
		URL.revokeObjectURL(url);
	}
}

/** Qué archivos tiene cada plantilla (una sola consulta por plantilla); null si no se pudo consultar. */
const manifests = new Map<string, Promise<Map<string, Set<string>> | null>>();
function manifest(templateId: string) {
	let p = manifests.get(templateId);
	if (!p) {
		p = fetch(`/api/template-assets/${templateId}`, {cache: 'no-store'})
			.then(async (res) => {
				if (!res.ok) return null;
				const {files} = (await res.json()) as {files: string[]};
				const m = new Map<string, Set<string>>();
				for (const f of files) {
					const i = f.lastIndexOf('.');
					const n = f.slice(0, i);
					m.set(n, (m.get(n) ?? new Set()).add(f.slice(i + 1).toLowerCase()));
				}
				return m;
			})
			.catch(() => null);
		manifests.set(templateId, p);
	}
	return p;
}

/** `still`: para miniaturas, solo el primer cuadro de los GIF y videos (la animación completa es más lenta de decodificar). */
async function fetchImage(templateId: string, name: string, still = false): Promise<Loaded | null> {
	const list = await manifest(templateId);
	const have = list ? (list.get(name) ?? new Set<string>()) : undefined;
	// con la lista de archivos solo se pide lo que existe (sin 404 de prueba)
	if (have && !have.size) return null;
	for (const ext of [...TEMPLATE_ANIM_EXTS, ...TEMPLATE_IMAGE_EXTS]) {
		if (have && !have.has(ext)) continue;
		try {
			const res = await fetch(`/templates/${templateId}/${name}.${ext}`);
			// el servidor devuelve la página 404 (HTML) si el archivo no existe: se descarta por el tipo
			const type = res.headers.get('content-type') ?? '';
			if (!res.ok || !(type.startsWith('image/') || type.startsWith('video/'))) continue;
			const blob = await res.blob();
			if (ext === 'gif') return still ? {still: await createImageBitmap(blob), animated: true} : await decodeGif(blob);
			if (ext === 'webm' || ext === 'mp4') {
				const r = await decodeVideo(blob, still ? 1 : Infinity);
				return still && r && 'anim' in r ? {still: r.anim.frames[0], animated: true} : r;
			}
			return {still: await createImageBitmap(blob)};
		} catch {
			/* se prueba con la siguiente extensión */
		}
	}
	return null;
}

/**
 * Carga (una sola vez por sesión de página) las imágenes de la plantilla. Nunca falla: lo que falta queda en null.
 * Con `still` (miniaturas) los GIF y videos se cargan solo con el primer cuadro; si después se pide la carga completa
 * (vista previa, exportación) se completa la animación.
 */
export function loadTemplateAssets(t: Pick<TemplateDefinition, 'id' | 'assets'>, opts: {still?: boolean} = {}): Promise<void> {
	const names = t.assets ?? [];
	return Promise.all(
		names.map((name) => {
			const k = keyOf(t.id, name);
			if (anims.has(k) || (images.has(k) && (opts.still || !partial.has(k)))) return null;
			const pk = opts.still ? `${k}:still` : k;
			let p = pending.get(pk);
			if (!p) {
				p = fetchImage(t.id, name, opts.still).then((r) => {
					if (r && 'anim' in r) {
						anims.set(k, r.anim);
						images.delete(k);
						partial.delete(k);
					} else if (r && !anims.has(k)) {
						images.set(k, r.still);
						if (r.animated) partial.add(k);
						else partial.delete(k);
					}
					pending.delete(pk);
					return r;
				});
				pending.set(pk, p);
			}
			return p;
		})
	).then(() => undefined);
}

/** Lo que viaja al Worker de exportación: una imagen fija o los cuadros de una animación. */
export type TemplateImageEntry = {key: string; bitmap: ImageBitmap} | {key: string; frames: ImageBitmap[]; ends: number[]};

/** Copias decodificadas para transferirlas al Worker de exportación. */
export async function cloneTemplateImages(t: Pick<TemplateDefinition, 'id' | 'assets'>): Promise<TemplateImageEntry[]> {
	const out: TemplateImageEntry[] = [];
	for (const name of t.assets ?? []) {
		const k = keyOf(t.id, name);
		const a = anims.get(k);
		if (a) {
			const frames: ImageBitmap[] = [];
			for (const f of a.frames) frames.push(await createImageBitmap(f));
			out.push({key: k, frames, ends: a.ends});
			continue;
		}
		const img = images.get(k);
		if (img) out.push({key: k, bitmap: await createImageBitmap(img)});
	}
	return out;
}

/** Los bitmaps de `entries` que hay que transferir en `postMessage`. */
export function templateImageTransfer(entries: TemplateImageEntry[]): ImageBitmap[] {
	return entries.flatMap((e) => ('frames' in e ? e.frames : [e.bitmap]));
}

/** Usado por el Worker: registra las imágenes recibidas. */
export function setTemplateImages(entries: TemplateImageEntry[]) {
	for (const e of entries) {
		if ('frames' in e) anims.set(e.key, {frames: e.frames, ends: e.ends});
		else images.set(e.key, e.bitmap);
	}
}

/**
 * Dibuja `img` dentro de la caja (x, y, w, h) cubriéndola y recortando lo que sobre, con el punto de enfoque `fy`
 * (0 = arriba, 1 = abajo) para no cortar las cabezas.
 */
export function drawCover(ctx: CanvasRenderingContext2D, img: TplImage, x: number, y: number, w: number, h: number, fy = 0.3) {
	const k = Math.max(w / img.width, h / img.height);
	const dw = img.width * k;
	const dh = img.height * k;
	ctx.drawImage(img, x + (w - dw) / 2, y - (dh - h) * fy, dw, dh);
}

/** Dibuja `img` entera dentro de la caja, sin recortar y conservando la proporción (anclada abajo, centrada). */
export function drawContain(ctx: CanvasRenderingContext2D, img: TplImage, x: number, y: number, w: number, h: number, anchor: 'center' | 'bottom' = 'center') {
	const k = Math.min(w / img.width, h / img.height);
	const dw = img.width * k;
	const dh = img.height * k;
	ctx.drawImage(img, x + (w - dw) / 2, anchor === 'bottom' ? y + h - dh : y + (h - dh) / 2, dw, dh);
}
