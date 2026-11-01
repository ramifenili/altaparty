// Herramientas de dibujo compartidas por todas las plantillas.
// Todo se dibuja en coordenadas lógicas de 720x1280 y es una función pura del
// tiempo `t` (segundos): el mismo t produce siempre el mismo fotograma, tanto
// en la vista previa como en la exportación.

import {clamp} from '../canvas/animation';
import type {TemplateContent} from './types';

export const W = 720;
export const H = 1280;
export const TAU = Math.PI * 2;

// ---------- tiempo / easing ----------
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const prog = (t: number, start: number, dur: number) =>
	clamp01((t - start) / dur);
export const outCubic = (p: number) => 1 - Math.pow(1 - clamp01(p), 3);
export const inOutCubic = (p: number) => {
	const c = clamp01(p);
	return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};
export const outBack = (p: number) => {
	const c = clamp01(p);
	const s = 1.70158;
	return 1 + (s + 1) * Math.pow(c - 1, 3) + s * Math.pow(c - 1, 2);
};
export const outElastic = (p: number) => {
	const c = clamp01(p);
	if (c === 0 || c === 1) return c;
	return Math.pow(2, -10 * c) * Math.sin(((c * 10 - 0.75) * TAU) / 3) + 1;
};
/** 1 mientras t está dentro de [a,b]; con fundidos de `fade` segundos en los bordes. */
export const window01 = (t: number, a: number, b: number, fade = 0.35) =>
	clamp01((t - a) / fade) * clamp01((b - t) / fade);

/** número pseudoaleatorio determinista 0..1 */
export const hash = (i: number, salt = 0) => {
	const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
	return x - Math.floor(x);
};

// ---------- transformaciones ----------
export function withTransform(
	ctx: CanvasRenderingContext2D,
	o: {x?: number; y?: number; scale?: number; sx?: number; sy?: number; rot?: number; alpha?: number},
	fn: () => void
) {
	ctx.save();
	ctx.translate(o.x ?? 0, o.y ?? 0);
	if (o.rot) ctx.rotate(o.rot);
	ctx.scale(o.sx ?? o.scale ?? 1, o.sy ?? o.scale ?? 1);
	if (o.alpha !== undefined) ctx.globalAlpha *= clamp01(o.alpha);
	fn();
	ctx.restore();
}

// ---------- formas ----------
export function roundRectPath(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	const rr = Math.min(r, w / 2, h / 2);
	ctx.beginPath();
	ctx.moveTo(x + rr, y);
	ctx.arcTo(x + w, y, x + w, y + h, rr);
	ctx.arcTo(x + w, y + h, x, y + h, rr);
	ctx.arcTo(x, y + h, x, y, rr);
	ctx.arcTo(x, y, x + w, y, rr);
	ctx.closePath();
}

export function starPath(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	spikes: number,
	outer: number,
	inner: number,
	rot = -Math.PI / 2
) {
	ctx.beginPath();
	for (let i = 0; i < spikes * 2; i++) {
		const r = i % 2 === 0 ? outer : inner;
		const a = rot + (i * Math.PI) / spikes;
		const px = cx + Math.cos(a) * r;
		const py = cy + Math.sin(a) * r;
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
}

export function polygonPath(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	sides: number,
	r: number,
	rot = -Math.PI / 2
) {
	ctx.beginPath();
	for (let i = 0; i < sides; i++) {
		const a = rot + (i * TAU) / sides;
		const px = cx + Math.cos(a) * r;
		const py = cy + Math.sin(a) * r;
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
}

export function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
	ctx.beginPath();
	ctx.moveTo(cx, cy + s * 0.9);
	ctx.bezierCurveTo(cx - s * 1.4, cy + s * 0.1, cx - s * 0.9, cy - s * 1.0, cx, cy - s * 0.35);
	ctx.bezierCurveTo(cx + s * 0.9, cy - s * 1.0, cx + s * 1.4, cy + s * 0.1, cx, cy + s * 0.9);
	ctx.closePath();
}

export function sparkle4(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	r: number,
	color: string,
	rot = 0
) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(rot);
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.moveTo(0, -r);
	ctx.quadraticCurveTo(r * 0.12, -r * 0.12, r, 0);
	ctx.quadraticCurveTo(r * 0.12, r * 0.12, 0, r);
	ctx.quadraticCurveTo(-r * 0.12, r * 0.12, -r, 0);
	ctx.quadraticCurveTo(-r * 0.12, -r * 0.12, 0, -r);
	ctx.fill();
	ctx.restore();
}

/** Mismo color con alfa 0 (evita el borde gris de degradar hacia negro transparente). */
export function transparent(color: string): string {
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
	if (hex) {
		let h = hex[1];
		if (h.length === 3) h = [...h].map((ch) => ch + ch).join('');
		const n = parseInt(h, 16);
		return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`;
	}
	const m = /^rgba?\(([^)]+)\)$/.exec(color);
	if (m) {
		const [r, g, b] = m[1].split(',').map((v) => v.trim());
		return `rgba(${r},${g},${b},0)`;
	}
	return 'rgba(255,255,255,0)';
}

export function glow(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	r: number,
	color: string,
	alpha = 1
) {
	const g = ctx.createRadialGradient(x, y, 0, x, y, r);
	g.addColorStop(0, color);
	g.addColorStop(1, transparent(color));
	ctx.save();
	ctx.globalAlpha *= alpha;
	ctx.fillStyle = g;
	ctx.fillRect(x - r, y - r, r * 2, r * 2);
	ctx.restore();
}

export function vGradient(
	ctx: CanvasRenderingContext2D,
	y0: number,
	y1: number,
	stops: [number, string][]
) {
	const g = ctx.createLinearGradient(0, y0, 0, y1);
	for (const [o, c] of stops) g.addColorStop(o, c);
	return g;
}

// ---------- capas estáticas cacheadas ----------
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
const layerCache = new Map<string, AnyCanvas>();

/** Crea un canvas en la página o, dentro del Worker de exportación, un OffscreenCanvas. */
export function makeCanvas(w: number, h: number): AnyCanvas {
	if (typeof document !== 'undefined') {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		return c;
	}
	return new OffscreenCanvas(w, h);
}
/** Dibuja una capa costosa una sola vez (a 720x1280) y la reutiliza en cada fotograma. */
export function staticLayer(
	ctx: CanvasRenderingContext2D,
	key: string,
	draw: (c: CanvasRenderingContext2D) => void,
	height = H
) {
	let cv = layerCache.get(key);
	if (!cv) {
		cv = makeCanvas(W, height);
		const c = cv.getContext('2d') as CanvasRenderingContext2D | null;
		if (c) draw(c);
		layerCache.set(key, cv);
	}
	ctx.drawImage(cv, 0, 0);
}

// ---------- texto ----------
export type TextStyle = {
	font: (size: number) => string;
	size: number;
	fill?: string | CanvasGradient;
	stroke?: string;
	strokeW?: number;
	align?: CanvasTextAlign;
	glow?: string;
	glowBlur?: number;
	shadow?: string;
	shadowDy?: number;
	spacing?: number;
	baseline?: CanvasTextBaseline;
};

export function drawText(
	ctx: CanvasRenderingContext2D,
	str: string,
	x: number,
	y: number,
	s: TextStyle
) {
	ctx.save();
	ctx.font = s.font(s.size);
	ctx.textAlign = s.align ?? 'center';
	ctx.textBaseline = s.baseline ?? 'alphabetic';
	ctx.lineJoin = 'round';
	if (s.spacing !== undefined && 'letterSpacing' in ctx) {
		(ctx as unknown as {letterSpacing: string}).letterSpacing = `${s.spacing}px`;
	}
	if (s.shadow) {
		ctx.fillStyle = s.shadow;
		ctx.fillText(str, x, y + (s.shadowDy ?? s.size * 0.06));
	}
	if (s.glow) {
		ctx.shadowColor = s.glow;
		ctx.shadowBlur = s.glowBlur ?? 18;
	}
	if (s.stroke) {
		ctx.strokeStyle = s.stroke;
		ctx.lineWidth = s.strokeW ?? s.size * 0.1;
		ctx.strokeText(str, x, y);
	}
	ctx.shadowBlur = s.glow ? (s.glowBlur ?? 18) * 0.5 : 0;
	ctx.fillStyle = s.fill ?? '#fff';
	ctx.fillText(str, x, y);
	ctx.restore();
}

/** Tamaño de fuente más grande (<= start) con el que `str` cabe en `maxW`. */
export function fitSize(
	ctx: CanvasRenderingContext2D,
	str: string,
	font: (size: number) => string,
	maxW: number,
	start: number,
	min = 14
) {
	ctx.save();
	let size = start;
	ctx.font = font(size);
	const w = ctx.measureText(str).width;
	if (w > maxW) size = Math.max(min, Math.floor((start * maxW) / w));
	ctx.restore();
	return size;
}

/** Parte `str` en hasta `maxLines` líneas que caben en `maxW`; agrega "…" si no entra. */
export function wrapText(
	ctx: CanvasRenderingContext2D,
	str: string,
	font: string,
	maxW: number,
	maxLines: number
) {
	ctx.save();
	ctx.font = font;
	const words = str.trim().split(/\s+/);
	const lines: string[] = [];
	let cur = '';
	for (let i = 0; i < words.length; i++) {
		const test = cur ? cur + ' ' + words[i] : words[i];
		if (ctx.measureText(test).width <= maxW || !cur) {
			cur = test;
		} else {
			lines.push(cur);
			cur = words[i];
			if (lines.length === maxLines - 1) {
				cur = words.slice(i).join(' ');
				break;
			}
		}
	}
	if (cur) lines.push(cur);
	if (!lines.length) {
		ctx.restore();
		return [];
	}
	// truncar la última línea si sigue siendo demasiado ancha
	let last = lines[lines.length - 1] ?? '';
	if (ctx.measureText(last).width > maxW) {
		while (last.length > 1 && ctx.measureText(last + '…').width > maxW) {
			last = last.slice(0, -1);
		}
		lines[lines.length - 1] = last.trimEnd() + '…';
	}
	ctx.restore();
	return lines;
}

/** Texto curvo sobre un arco (para nombres tipo camiseta). */
export function arcText(
	ctx: CanvasRenderingContext2D,
	str: string,
	cx: number,
	cy: number,
	radius: number,
	s: TextStyle
) {
	ctx.save();
	ctx.font = s.font(s.size);
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	const widths = [...str].map((ch) => ctx.measureText(ch).width);
	const total = widths.reduce((a, b) => a + b, 0);
	let angle = -total / radius / 2;
	ctx.translate(cx, cy);
	ctx.lineJoin = 'round';
	for (let i = 0; i < str.length; i++) {
		const a = angle + widths[i] / radius / 2;
		ctx.save();
		ctx.rotate(a);
		ctx.translate(0, -radius);
		if (s.stroke) {
			ctx.strokeStyle = s.stroke;
			ctx.lineWidth = s.strokeW ?? s.size * 0.1;
			ctx.strokeText(str[i], 0, 0);
		}
		ctx.fillStyle = s.fill ?? '#fff';
		ctx.fillText(str[i], 0, 0);
		ctx.restore();
		angle += widths[i] / radius;
	}
	ctx.restore();
}

// ---------- foto ----------
export type PhotoShape = 'circle' | 'hex' | 'star' | 'rounded' | 'heart' | 'oval';

export function shapePath(
	ctx: CanvasRenderingContext2D,
	shape: PhotoShape,
	cx: number,
	cy: number,
	r: number
) {
	switch (shape) {
		case 'circle':
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, TAU);
			break;
		case 'oval':
			ctx.beginPath();
			ctx.ellipse(cx, cy, r * 0.82, r, 0, 0, TAU);
			break;
		case 'hex':
			polygonPath(ctx, cx, cy, 6, r, 0);
			break;
		case 'star':
			starPath(ctx, cx, cy, 10, r, r * 0.86);
			break;
		case 'heart':
			heartPath(ctx, cx, cy + r * 0.12, r * 0.74);
			break;
		case 'rounded':
			roundRectPath(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.28);
			break;
	}
}

/** Dibuja la foto recortada en una forma (cover). Si no hay foto, llama a `fallback`. */
export function drawPhotoIn(
	ctx: CanvasRenderingContext2D,
	photo: TemplateContent['photo'],
	shape: PhotoShape,
	cx: number,
	cy: number,
	r: number,
	fallback?: () => void,
	pixelate = 0
) {
	ctx.save();
	shapePath(ctx, shape, cx, cy, r);
	ctx.clip();
	if (photo) {
		const iw = photo.width;
		const ih = photo.height;
		const box = r * 2;
		const sc = Math.max(box / iw, box / ih);
		const dw = iw * sc;
		const dh = ih * sc;
		if (pixelate > 0) {
			const tiny = makeCanvas(Math.max(8, Math.round(box / pixelate)), Math.max(8, Math.round(box / pixelate)));
			const tctx = tiny.getContext('2d') as CanvasRenderingContext2D | null;
			if (tctx) {
				const n = tiny.width;
				const s2 = Math.max(n / iw, n / ih);
				tctx.drawImage(photo, (n - iw * s2) / 2, (n - ih * s2) / 2, iw * s2, ih * s2);
				ctx.imageSmoothingEnabled = false;
				ctx.drawImage(tiny, cx - r, cy - r, box, box);
				ctx.imageSmoothingEnabled = true;
			}
		} else {
			ctx.drawImage(photo, cx - dw / 2, cy - dh / 2, dw, dh);
		}
	} else if (fallback) {
		fallback();
	}
	ctx.restore();
}

// ---------- partículas ----------
export function confetti(
	ctx: CanvasRenderingContext2D,
	t: number,
	o: {count: number; colors: string[]; seed?: number; speed?: number; size?: number; shape?: 'rect' | 'circle' | 'strip'}
) {
	const speed = o.speed ?? 1;
	const size = o.size ?? 14;
	for (let i = 0; i < o.count; i++) {
		const sd = (o.seed ?? 0) + i;
		const x0 = hash(sd, 1) * W;
		const vy = (90 + hash(sd, 2) * 160) * speed;
		const y = ((hash(sd, 3) * (H + 200) + t * vy) % (H + 200)) - 100;
		const x = x0 + Math.sin(t * (1 + hash(sd, 4) * 2) + sd) * 28;
		const rot = t * (2 + hash(sd, 5) * 5) + sd;
		const flip = Math.abs(Math.sin(t * (2 + hash(sd, 6) * 4) + sd));
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		ctx.scale(1, 0.25 + flip * 0.75);
		ctx.fillStyle = o.colors[i % o.colors.length];
		const s = size * (0.6 + hash(sd, 7) * 0.8);
		if (o.shape === 'circle') {
			ctx.beginPath();
			ctx.arc(0, 0, s / 2, 0, TAU);
			ctx.fill();
		} else if (o.shape === 'strip') {
			ctx.fillRect(-s / 5, -s, s / 2.5, s * 2);
		} else {
			ctx.fillRect(-s / 2, -s / 3, s, s * 0.66);
		}
		ctx.restore();
	}
}

/** Estrellitas titilantes repartidas por la pantalla. */
export function twinkles(
	ctx: CanvasRenderingContext2D,
	t: number,
	count: number,
	colors: string[],
	o: {seed?: number; maxR?: number; y0?: number; y1?: number} = {}
) {
	for (let i = 0; i < count; i++) {
		const sd = (o.seed ?? 0) + i;
		const x = hash(sd, 11) * W;
		const y = lerp(o.y0 ?? 0, o.y1 ?? H, hash(sd, 12));
		const ph = hash(sd, 13) * TAU;
		const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + hash(sd, 14) * 3) + ph);
		const r = (o.maxR ?? 14) * (0.35 + hash(sd, 15) * 0.65) * tw;
		if (r > 1) sparkle4(ctx, x, y, r, colors[i % colors.length], t * 0.5 * hash(sd, 16));
	}
}

// ---------- bloque de datos del evento ----------
export type DetailStyle = {
	labelFont: (s: number) => string;
	valueFont: (s: number) => string;
	labelColor: string;
	valueColor: string;
	subColor?: string;
	valueStroke?: string;
	labels?: [string, string, string];
	/** dibuja el fondo de cada fila */
	plate: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, i: number) => void;
	entrance?: 'slide' | 'pop' | 'fade' | 'type';
	y?: number;
	w?: number;
	delay?: number;
	uppercase?: boolean;
	glow?: string;
	/** multiplica los tamaños de fuente (para tipografías muy anchas) */
	fontScale?: number;
};

/** Dibuja FECHA / HORA / LUGAR con ajuste automático de tamaño y animación de entrada. */
export function drawDetails(
	ctx: CanvasRenderingContext2D,
	c: TemplateContent,
	t: number,
	t0: number,
	st: DetailStyle
) {
	const w = st.w ?? 620;
	const x = (W - w) / 2;
	let y = st.y ?? 560;
	const labels = st.labels ?? ['FECHA', 'HORA', 'LUGAR'];
	const heights = [172, 124, 290];
	const up = (s: string) => (st.uppercase ? s.toLocaleUpperCase('es') : s);
	const k = st.fontScale ?? 1;

	for (let i = 0; i < 3; i++) {
		const h = heights[i];
		const start = t0 + (st.delay ?? 0.4) * i;
		const p = prog(t, start, 0.6);
		if (p > 0) {
			const ep = outBack(p);
			const mode = st.entrance ?? 'slide';
			ctx.save();
			const dir = i % 2 === 0 ? -1 : 1;
			if (mode === 'slide') ctx.translate((1 - outCubic(p)) * 520 * dir, 0);
			else if (mode === 'pop') {
				ctx.translate(W / 2, y + h / 2);
				ctx.scale(Math.max(0.01, ep), Math.max(0.01, ep));
				ctx.translate(-W / 2, -(y + h / 2));
			}
			ctx.globalAlpha *= mode === 'slide' ? 1 : clamp01(p * 2);
			st.plate(ctx, x, y, w, h, i);

			const cx = W / 2;
			const typed = (s: string) =>
				mode === 'type' ? s.slice(0, Math.floor(s.length * prog(t, start + 0.2, 0.7))) : s;
			const label = typed(labels[i]);
			drawText(ctx, label, cx, y + 38, {
				font: st.labelFont,
				size: 24 * k,
				fill: st.labelColor,
				spacing: 1.5,
				glow: st.glow,
			});
			if (i === 0) {
				const big = up(`${c.day} de ${c.monthName}`);
				const fs = fitSize(ctx, big, st.valueFont, w - 70, 64 * k, 28 * k);
				drawText(ctx, typed(big), cx, y + 108, {
					font: st.valueFont,
					size: fs,
					fill: st.valueColor,
					stroke: st.valueStroke,
					glow: st.glow,
				});
				drawText(ctx, typed(up(`${c.weekday} · ${c.year}`)), cx, y + 150, {
					font: st.valueFont,
					size: 30 * k,
					fill: st.subColor ?? st.valueColor,
					glow: st.glow,
				});
			} else if (i === 1) {
				drawText(ctx, typed(c.time), cx, y + 100, {
					font: st.valueFont,
					size: 66 * k,
					fill: st.valueColor,
					stroke: st.valueStroke,
					glow: st.glow,
				});
			} else {
				const vfont = (s: number) => st.valueFont(s);
				const venue = up(c.venue);
				// baja el tamaño hasta que el nombre entre en dos líneas sin recortarse
				let vs = 54 * k;
				let lines: string[] = [];
				for (const size of [54, 46, 40, 34, 30]) {
					vs = size * k;
					lines = wrapText(ctx, venue, vfont(vs), w - 60, 2);
					if (!lines.length || !lines[lines.length - 1].endsWith('…')) break;
				}
				let ly = y + 98;
				for (const ln of lines) {
					drawText(ctx, typed(ln), cx, ly, {
						font: st.valueFont,
						size: vs,
						fill: st.valueColor,
						stroke: st.valueStroke,
						glow: st.glow,
					});
					ly += vs + 6;
				}
				const alines = wrapText(ctx, c.address, st.valueFont(30 * k), w - 70, 3);
				ly += 8;
				for (const ln of alines) {
					drawText(ctx, typed(ln), cx, ly, {
						font: st.valueFont,
						size: 30 * k,
						fill: st.subColor ?? st.valueColor,
						glow: st.glow,
					});
					ly += 38 * k + (k < 1 ? 6 : 0);
				}
			}
			ctx.restore();
		}
		y += h + 24;
	}
}

/**
 * Si `str` supera `max` caracteres, la parte en dos líneas cortando en un espacio: la primera queda un poco más larga
 * ("Av. Corrientes 4500 / Villa Urquiza"); si no supera `max`, la deja en una.
 */
export function splitLong(str: string, max = 26): string[] {
	// un salto de línea escrito por la persona manda: se respeta (máximo dos líneas)
	const manual = str.split(/\r?\n/).map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean);
	if (manual.length > 1) return [manual[0], manual.slice(1).join(' ')];
	const s = str.trim().replace(/\s+/g, ' ');
	if (s.length <= max) return [s];
	const target = s.length * 0.58;
	let best = -1;
	for (let i = 1; i < s.length - 1; i++) {
		if (s[i] !== ' ') continue;
		if (best < 0 || Math.abs(i - target) < Math.abs(best - target)) best = i;
	}
	return best < 0 ? [s] : [s.slice(0, best), s.slice(best + 1)];
}

/** Factor de escala (entre 0,6 y `k0`) con el que una pila de filas de altura total `height(k)` entra entre `y0` y `limit`. */
export function fitStack(y0: number, limit: number, height: (k: number) => number, k0 = 1, min = 0.6) {
	let k = k0;
	while (k > min && y0 + height(k) > limit) k -= 0.02;
	return k;
}

/**
 * Como `fitStack`, pero primero se achican las filas de una línea (`ks`, hasta `minS`) y solo si todavía no entra se
 * achican también las de dos líneas (`km`, hasta `minM`). El espacio entre bloques se mide con `0,7 + 0,3 * ks`.
 */
export function fitStackTwo(y0: number, limit: number, height: (ks: number, km: number) => number, minS = 0.45, minM = 0.7) {
	let ks = 1;
	let km = 1;
	while (ks > minS && y0 + height(ks, km) > limit) ks -= 0.02;
	while (km > minM && y0 + height(ks, km) > limit) km -= 0.02;
	return {ks, km, sp: 0.7 + 0.3 * ks};
}

/** Fecha en una sola línea: "sábado 14 de noviembre". */
export const dateLine = (c: {weekday: string; day: number; monthName: string}) => `${c.weekday} ${c.day} de ${c.monthName}`;

/** ¿Ocupa más de una línea? (por tener un salto escrito o por ser larga). */
export const isMultiLine = (str: string) => splitLong(str).length > 1;

/**
 * Reparte `text` en una o dos líneas que entran en `maxW` con la fuente dada (una sola si entra entera). Los saltos de
 * línea escritos se ignoran: solo se corta si hace falta. `hint` es el corte preferido ("sábado" / "14 de noviembre").
 * Devuelve null si ni en dos líneas entra.
 */
export function wrapFit(ctx: CanvasRenderingContext2D, text: string, font: string, maxW: number, hint?: string[]): string[] | null {
	const t = text.replace(/\s*\r?\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
	ctx.save();
	ctx.font = font;
	const w = (s: string) => ctx.measureText(s).width;
	try {
		if (w(t) <= maxW) return [t];
		if (hint && hint.length === 2 && hint.every((l) => w(l) <= maxW)) return hint;
		const words = t.split(' ');
		// cortes válidos: nunca antes de un número (la numeración queda en la línea de las palabras que la anteceden) ni
		// dejando una sola palabra sola al principio de una dirección larga
		const valid: number[] = [];
		for (let i = 1; i < words.length; i++) {
			if (/^\d/.test(words[i])) continue;
			if (i < 2 && words.length > 2) continue;
			valid.push(i);
		}
		const lines = (i: number) => [words.slice(0, i).join(' '), words.slice(i).join(' ')];
		// corte por palabras: la primera línea lleva hasta 3 ("Av. Corrientes 4500" / "Villa Urquiza")
		const n = words.length;
		const pref = n >= 7 ? Math.ceil(n / 2) : Math.min(3, Math.max(1, Math.round(n * 0.6)));
		if (valid.includes(pref)) {
			const [l1, l2] = lines(pref);
			if (w(l1) <= maxW && w(l2) <= maxW) return [l1, l2];
		}
		let best: string[] | null = null;
		let bestScore = Infinity;
		for (const i of valid) {
			const [a, b] = lines(i);
			// a igual ancho se prefiere la primera línea más larga
			const score = Math.max(w(a), w(b)) + (w(a) < w(b) ? 8 : 0);
			if (score < bestScore) {
				best = [a, b];
				bestScore = score;
			}
		}
		return best && Math.max(w(best[0]), w(best[1])) <= maxW ? best : null;
	} finally {
		ctx.restore();
	}
}

/**
 * Un único tamaño de letra para todos los datos (fecha, horario, lugar, dirección): el más grande, hasta `smax`, con el que
 * cada dato entra en una o dos líneas y `fits(tamaño, líneas)` dice que todo entra en el alto disponible.
 */
export function uniformRows(
	ctx: CanvasRenderingContext2D,
	rows: {text: string; hint?: string[]}[],
	font: (size: number) => string,
	maxW: number,
	smax: number,
	smin: number,
	fits: (size: number, lines: string[][]) => boolean
): {size: number; lines: string[][]} {
	let last = {size: smin, lines: rows.map((r) => [r.text.replace(/\s*\r?\n\s*/g, ' ').trim()])};
	for (let s = smax; s >= smin; s -= 2) {
		const lines = rows.map((r) => wrapFit(ctx, r.text, font(s), maxW, r.hint));
		if (lines.some((l) => !l)) continue;
		last = {size: s, lines: lines as string[][]};
		if (fits(s, last.lines)) return last;
	}
	return last;
}

/** "sábado" / "14 de noviembre": el corte preferido de la fecha cuando no entra en una línea. */
export const dateParts = (c: {weekday: string; day: number; monthName: string}) => [c.weekday, `${c.day} de ${c.monthName}`];
