// Detección del tipo REAL de un archivo por sus primeros bytes (no se confía en la extensión ni en el MIME que manda el navegador).

export const MEDIA_LIMITS = {video: 40 * 1024 * 1024, image: 6 * 1024 * 1024, font: 3 * 1024 * 1024} as const;

export type Sniffed = {kind: 'video' | 'image' | 'font'; mime: string};

export function sniffMedia(b: Buffer): Sniffed | null {
	if (b.length < 16) return null;
	if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return {kind: 'image', mime: 'image/png'};
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return {kind: 'image', mime: 'image/jpeg'};
	if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return {kind: 'image', mime: 'image/webp'};
	if (b.toString('ascii', 4, 8) === 'ftyp' && isMp4Header(b)) return {kind: 'video', mime: 'video/mp4'};
	if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return {kind: 'video', mime: 'video/webm'};
	// tipografías: TrueType, OpenType, WOFF y WOFF2
	const tag = b.toString('ascii', 0, 4);
	if (tag === 'OTTO') return {kind: 'font', mime: 'font/otf'};
	if (tag === 'wOFF') return {kind: 'font', mime: 'font/woff'};
	if (tag === 'wOF2') return {kind: 'font', mime: 'font/woff2'};
	if ((b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0) || tag === 'true') return {kind: 'font', mime: 'font/ttf'};
	return null;
}

/** MP4 real: el primer "box" declara un tamaño coherente y una marca (brand) de 4 caracteres imprimibles. */
function isMp4Header(b: Buffer) {
	const size = b.readUInt32BE(0);
	if (size < 16 || size > Math.min(b.length, 4096)) return false;
	return /^[ -~]{4}$/.test(b.toString('latin1', 8, 12));
}

/** Nombre de archivo seguro para guardar/mostrar: sin rutas, sin caracteres de control ni símbolos raros. */
export function safeFileName(raw: string): string {
	const base = raw.split(/[\\/]/).pop() ?? '';
	const clean = base.replace(/[^\p{L}\p{N} ._()-]/gu, '').replace(/^\.+/, '').trim().slice(0, 80);
	return clean || 'archivo';
}
