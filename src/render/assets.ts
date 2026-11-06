import {PHOTO_LIMITS, AUDIO_LIMITS} from '../domain/invitation';

// Familias usadas en las plantillas → archivo en /public/fonts
const FONT_FILES: Record<string, string> = {
	Anton: 'Anton',
	Bangers: 'Bangers',
	Fredoka: 'Fredoka',
	PressStart: 'PressStart2P',
	Playfair: 'PlayfairDisplay',
	Montserrat: 'Montserrat',
	Inter: 'Inter',
	DynaPuff: 'DynaPuff',
	Pacifico: 'Pacifico',
	RedHatDisplay: 'RedHatDisplay',
	RacingSansOne: 'RacingSansOne',
};

/** URL del archivo de una familia: incluida, CABJ 1905 o una tipografía subida por el admin (`cf-<id>`). */
export function fontFileUrl(family: string) {
	if (family === 'CABJ1905') return '/fonts/CABJ-1905.ttf';
	// Gill Sans Ultra Bold (archivo del usuario): se carga si está en public/fonts; si falta, la plantilla usa su fuente de reemplazo
	// High Speed (archivo del usuario)
	// Hunters K-Pop (archivo del usuario)
	if (family === 'HuntersKPop') return '/fonts/HuntersKPop.otf';
	if (family === 'HighSpeed') return '/fonts/HighSpeed.ttf';
	if (family === 'GillSansUltraBold') return '/fonts/GillSansUltraBold.ttf';
	if (/^cf-[a-z0-9]{8,32}$/.test(family)) return `/api/media/${family.slice(3)}`;
	const f = FONT_FILES[family];
	return f ? `/fonts/${f}.woff2` : null;
}

const fontPromises = new Map<string, Promise<void>>();

/** Carga (una sola vez) las tipografías locales antes de dibujar en canvas. */
export function loadFonts(families: string[]) {
	return Promise.all(
		families.map((family) => {
			let p = fontPromises.get(family);
			if (!p) {
				const url = fontFileUrl(family);
				p = (async () => {
					if (!url) return;
					const face = new FontFace(family, `url(${url})`, {weight: '100 900'});
					await face.load();
					document.fonts.add(face);
				})().catch(() => undefined); // si falla, el canvas usa la tipografía de reemplazo
				fontPromises.set(family, p);
			}
			return p;
		})
	);
}

export type LoadedPhoto = {
	/** canvas reducido (máx. 1280px) listo para dibujar */
	canvas: HTMLCanvasElement;
	/** miniatura para el formulario; hay que liberarla con URL.revokeObjectURL */
	previewUrl: string;
	name: string;
};

export function validatePhotoFile(file: File): string | null {
	if (!(PHOTO_LIMITS.types as readonly string[]).includes(file.type)) {
		return 'Subí una imagen JPG, PNG o WebP.';
	}
	if (file.size > PHOTO_LIMITS.maxBytes) {
		return 'La foto pesa más de 8 MB. Elegí una más liviana.';
	}
	return null;
}

export async function loadPhoto(file: File): Promise<LoadedPhoto> {
	const error = validatePhotoFile(file);
	if (error) throw new Error(error);
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'});
	} catch {
		throw new Error('No pudimos leer esa imagen. Probá con otra foto.');
	}
	const max = 1280;
	const sc = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * sc);
	canvas.height = Math.round(bitmap.height * sc);
	canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	return {canvas, previewUrl: URL.createObjectURL(file), name: file.name};
}

/** Foto reducida en JPEG (≤ ~600 KB) para guardarla con la compra. */
export function photoToJpegDataUrl(canvas: HTMLCanvasElement): string {
	const max = 1024;
	const sc = Math.min(1, max / Math.max(canvas.width, canvas.height));
	const c = document.createElement('canvas');
	c.width = Math.round(canvas.width * sc);
	c.height = Math.round(canvas.height * sc);
	const g = c.getContext('2d');
	if (g) {
		g.fillStyle = '#fff';
		g.fillRect(0, 0, c.width, c.height);
		g.drawImage(canvas, 0, 0, c.width, c.height);
	}
	let q = 0.88;
	let url = c.toDataURL('image/jpeg', q);
	while (url.length > 600 * 1024 * 1.37 && q > 0.4) {
		q -= 0.1;
		url = c.toDataURL('image/jpeg', q);
	}
	return url;
}

export async function dataUrlToFile(url: string, name: string): Promise<File> {
	const blob = await (await fetch(url)).blob();
	return new File([blob], name, {type: blob.type || 'image/jpeg'});
}

export function validateAudioFile(file: File): string | null {
	const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
	const typeOk = (AUDIO_LIMITS.types as readonly string[]).includes(file.type);
	const extOk = (AUDIO_LIMITS.extensions as readonly string[]).includes(ext);
	if (!typeOk && !extOk) return 'Subí un audio MP3, WAV, M4A, AAC u OGG.';
	if (!(typeOk || file.type === '') && !extOk) return 'Formato de audio no compatible.';
	if (file.size > AUDIO_LIMITS.maxBytes) return 'El audio pesa más de 5 MB. Elegí uno más liviano.';
	if (file.size === 0) return 'El archivo de audio está vacío.';
	return null;
}

/** Duración en segundos de un archivo de audio, o null si el navegador no puede leerlo. */
export function readAudioDuration(url: string): Promise<number | null> {
	return new Promise((resolve) => {
		const a = new Audio();
		a.preload = 'metadata';
		const done = (v: number | null) => {
			a.removeAttribute('src');
			a.load();
			resolve(v);
		};
		a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : null);
		a.onerror = () => done(null);
		a.src = url;
	});
}
