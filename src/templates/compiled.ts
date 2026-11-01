// Motor de dibujo de los videos compilados: convierte una especificación
// (escenas + capas) en un `TemplateDefinition` que usan igual la vista previa,
// las miniaturas y el exportador.

import type {FrameContext, TemplateContent, TemplateDefinition} from './types';
import {
	specDuration,
	SPEC_LIMITS,
	type CompiledSpec,
	type Ease,
	type FontKey,
	type ImageLayer,
	type Layer,
	type PhotoLayer,
	type Scene,
	type SceneTransition,
	type ShapeLayer,
	type TextLayer,
} from './compiled-types';
import {withOutro} from './outro';
import {H, TAU, W, clamp01, drawPhotoIn, drawText, inOutCubic, outBack, outCubic, prog, roundRectPath, shapePath, wrapText} from './kit';

const FONT_CSS: Record<FontKey, (s: number) => string> = {
	Anton: (s) => `${s}px Anton, Impact, sans-serif`,
	Bangers: (s) => `${s}px Bangers, Impact, sans-serif`,
	Fredoka: (s) => `700 ${s}px Fredoka, system-ui, sans-serif`,
	PressStart: (s) => `${s}px PressStart, 'Courier New', monospace`,
	Playfair: (s) => `700 ${s}px Playfair, Georgia, serif`,
	Montserrat: (s) => `800 ${s}px Montserrat, system-ui, sans-serif`,
	Pacifico: (s) => `${s}px Pacifico, cursive`,
	CABJ1905: (s) => `${s}px CABJ1905, Impact, sans-serif`,
};

/** CSS de fuente para una tipografía incluida o subida por el admin (`cf-<id>`). */
export function fontCss(font: string): (s: number) => string {
	return (FONT_CSS as Record<string, (s: number) => string>)[font] ?? ((s: number) => `${s}px "${font}", Impact, sans-serif`);
}

/** Reemplaza {nombre}, {edad}, {fecha}... por los datos del cumpleañero. */
export function expandTokens(text: string, c: TemplateContent): string {
	const map: Record<string, string> = {
		nombre: c.name,
		edad: String(c.age),
		dia: String(c.day),
		mes: c.monthName,
		dia_semana: c.weekday,
		fecha: `${c.day} de ${c.monthName}`,
		fecha_larga: `${c.weekday} ${c.day} de ${c.monthName} de ${c.year}`,
		hora: c.time,
		lugar: c.venue,
		direccion: c.address,
	};
	return text.replace(/\{([a-z_]+)\}/gi, (m, k: string) => map[k.toLowerCase()] ?? m);
}

export const TOKEN_HELP = ['{nombre}', '{edad}', '{fecha}', '{fecha_larga}', '{dia}', '{mes}', '{dia_semana}', '{hora}', '{lugar}', '{direccion}'];

/** Escena y tiempo local para un instante global. */
export function sceneAt(spec: CompiledSpec, t: number) {
	let acc = 0;
	for (let i = 0; i < spec.scenes.length; i++) {
		const d = spec.scenes[i].duration;
		if (t < acc + d || i === spec.scenes.length - 1) return {index: i, scene: spec.scenes[i], local: Math.min(Math.max(0, t - acc), d), start: acc};
		acc += d;
	}
	return {index: 0, scene: spec.scenes[0], local: 0, start: 0};
}

function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & {width: number; height: number}) {
	const iw = img.width || 1;
	const ih = img.height || 1;
	const sc = Math.max(W / iw, H / ih);
	const dw = iw * sc;
	const dh = ih * sc;
	ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function drawBackground(ctx: CanvasRenderingContext2D, scene: Scene, index: number, local: number, f: FrameContext) {
	const bg = scene.bg;
	switch (bg.kind) {
		case 'color':
			ctx.fillStyle = bg.color;
			ctx.fillRect(0, 0, W, H);
			break;
		case 'gradient': {
			const a = (bg.angle * Math.PI) / 180;
			const cx = W / 2;
			const cy = H / 2;
			const r = Math.hypot(W, H) / 2;
			const g = ctx.createLinearGradient(cx - Math.sin(a) * r, cy + Math.cos(a) * r * -1, cx + Math.sin(a) * r, cy + Math.cos(a) * r);
			g.addColorStop(0, bg.from);
			g.addColorStop(1, bg.to);
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, W, H);
			break;
		}
		case 'image': {
			ctx.fillStyle = '#10101a';
			ctx.fillRect(0, 0, W, H);
			const img = f.media?.image(bg.mediaId);
			if (img) drawCover(ctx, img);
			break;
		}
		case 'video': {
			if (f.overlayOnly) break; // FFmpeg pone el video debajo: este cuadro queda transparente
			ctx.fillStyle = '#10101a';
			ctx.fillRect(0, 0, W, H);
			const frame = f.media?.videoFrame(index, local);
			if (frame) drawCover(ctx, frame);
			break;
		}
	}
}

function layerWindow(l: Layer, scene: Scene, local: number) {
	const end = l.end > 0 ? Math.min(l.end, scene.duration) : scene.duration;
	return {visible: local >= l.start && local <= end, end};
}

const EASE_FN: Record<Ease, (p: number) => number> = {
	outCubic,
	outQuad: (p) => 1 - (1 - clamp01(p)) * (1 - clamp01(p)),
	outExpo: (p) => (clamp01(p) >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(p))),
	inOutCubic,
	outBack,
	linear: clamp01,
};

/** Curva de interpolación por nombre (función pura de p ∈ [0,1]). */
export const easeFn = (e: Ease | undefined, fallback: Ease = 'outCubic') => EASE_FN[e ?? fallback];

function drawLayer(ctx: CanvasRenderingContext2D, l: Layer, scene: Scene, local: number, c: TemplateContent, f: FrameContext) {
	const {visible, end} = layerWindow(l, scene, local);
	if (!visible) return;
	// todo depende solo de `local` (tiempo absoluto de la escena): se puede dibujar cualquier instante en cualquier orden
	const p = prog(local, l.start, l.enterDur ?? 0.55);
	// con `ease` definido, todas las entradas usan esa curva; si no, la histórica de cada animación
	const ease = l.ease ? EASE_FN[l.ease] : null;
	let alpha = 1;
	let scale = 1;
	let dx = 0;
	let dy = 0;
	switch (l.enter) {
		case 'fade':
			alpha = ease ? ease(p) : p;
			break;
		case 'pop':
			scale = Math.max(0.001, (ease ?? outBack)(p));
			alpha = clamp01(p * 3);
			break;
		case 'slideUp':
			dy = (1 - (ease ?? outCubic)(p)) * H * 0.18;
			alpha = clamp01(p * 2);
			break;
		case 'slideDown':
			dy = -(1 - (ease ?? outCubic)(p)) * H * 0.18;
			alpha = clamp01(p * 2);
			break;
		case 'slideLeft':
			dx = -(1 - (ease ?? outCubic)(p)) * W * 0.7;
			break;
		case 'slideRight':
			dx = (1 - (ease ?? outCubic)(p)) * W * 0.7;
			break;
		default:
			break;
	}
	// salida: sin `exit` queda el fundido histórico de 0,25 s
	const exitDur = l.exitDur ?? 0.25;
	const q = clamp01((local - (end - exitDur)) / exitDur); // 0 → 1 durante la salida
	switch (l.exit) {
		case undefined:
		case 'fade':
			alpha *= 1 - q;
			break;
		case 'slideUp':
			dy -= (ease ?? EASE_FN.inOutCubic)(q) * H * 0.18;
			alpha *= 1 - clamp01(q * 1.5 - 0.5);
			break;
		case 'slideDown':
			dy += (ease ?? EASE_FN.inOutCubic)(q) * H * 0.18;
			alpha *= 1 - clamp01(q * 1.5 - 0.5);
			break;
		case 'slideLeft':
			dx -= (ease ?? EASE_FN.inOutCubic)(q) * W * 0.7;
			break;
		case 'slideRight':
			dx += (ease ?? EASE_FN.inOutCubic)(q) * W * 0.7;
			break;
		case 'shrink':
			scale *= Math.max(0.001, 1 - (ease ?? EASE_FN.inOutCubic)(q));
			alpha *= 1 - clamp01(q * 3 - 2);
			break;
		default:
			break; // 'none': desaparece de golpe al llegar a `end`
	}
	alpha *= (l.alpha ?? 100) / 100;
	scale *= (l.scale ?? 100) / 100;
	if (alpha <= 0.002) return;

	const lt = local - l.start;
	let rot = (l.rotate * Math.PI) / 180;
	switch (l.loop) {
		case 'float':
			dy += Math.sin(lt * 2.2) * H * 0.012;
			break;
		case 'sway':
			rot += Math.sin(lt * 2.4) * 0.07;
			break;
		case 'bounce':
			dy -= Math.abs(Math.sin(lt * 4.2)) * H * 0.022;
			break;
		case 'pulse':
			scale *= 1 + Math.sin(lt * 5) * 0.05;
			break;
		default:
			break;
	}

	ctx.save();
	ctx.globalAlpha *= alpha;
	ctx.translate((l.x / 100) * W + dx, (l.y / 100) * H + dy);
	ctx.rotate(rot);
	ctx.scale(scale, scale);
	if (l.type === 'text') drawTextLayer(ctx, l, c, lt);
	else if (l.type === 'photo') drawPhotoLayer(ctx, l, c);
	else if (l.type === 'shape') drawShapeLayer(ctx, l, clamp01(lt / 0.8));
	else drawImageLayer(ctx, l, f);
	ctx.restore();
}

function drawTextLayer(ctx: CanvasRenderingContext2D, l: TextLayer, c: TemplateContent, lt: number) {
	let str = expandTokens(l.text, c);
	if (l.uppercase) str = str.toLocaleUpperCase('es');
	if (l.enter === 'typewriter') str = str.slice(0, Math.ceil(str.length * clamp01(lt / 1.2)));
	if (!str.trim()) return;
	const font = fontCss(l.font);
	const maxW = (l.w / 100) * W;
	let size = (l.size / 100) * W;
	let lines = wrapText(ctx, str, font(size), maxW, l.maxLines);
	// si aún así se corta con "…", reduce el tamaño hasta que entre completo
	for (let i = 0; i < 10 && lines.some((ln) => ln.endsWith('…')) && size > 12; i++) {
		size *= 0.88;
		lines = wrapText(ctx, str, font(size), maxW, l.maxLines);
	}
	const lh = size * 1.12;
	const x = l.align === 'left' ? -maxW / 2 : l.align === 'right' ? maxW / 2 : 0;
	let y = -((lines.length - 1) * lh) / 2 + size * 0.34;
	for (const ln of lines) {
		drawText(ctx, ln, x, y, {
			font,
			size,
			fill: l.color,
			stroke: l.stroke || undefined,
			strokeW: (l.strokeW / 100) * size,
			align: l.align,
			shadow: l.shadow ? 'rgba(0,0,0,.45)' : undefined,
			shadowDy: size * 0.05,
		});
		y += lh;
	}
}

function drawPhotoLayer(ctx: CanvasRenderingContext2D, l: PhotoLayer, c: TemplateContent) {
	const r = ((l.w / 100) * W) / 2;
	if (!c.photo && l.ifMissing === 'hide') return;
	ctx.save();
	if (l.borderW > 0) {
		shapePath(ctx, l.shape, 0, 0, r + l.borderW);
		ctx.fillStyle = l.border;
		ctx.fill();
	}
	ctx.restore();
	drawPhotoIn(ctx, c.photo, l.shape, 0, 0, r, () => {
		const g = ctx.createLinearGradient(-r, -r, r, r);
		g.addColorStop(0, '#ffffff');
		g.addColorStop(1, '#d0d4e8');
		ctx.fillStyle = g;
		ctx.fillRect(-r, -r, r * 2, r * 2);
		drawText(ctx, (c.name.trim()[0] ?? '?').toLocaleUpperCase('es'), 0, r * 0.38, {font: FONT_CSS.Fredoka, size: r * 1.1, fill: '#7a7fa8', align: 'center'});
	});
	void TAU;
}

function drawShapeLayer(ctx: CanvasRenderingContext2D, l: ShapeLayer, wipe: number) {
	const w = (l.w / 100) * W;
	const h = (l.h / 100) * H;
	// con "se escribe" la forma se despliega de izquierda a derecha (ideal para líneas y marcos)
	const grow = l.enter === 'typewriter' ? outCubic(wipe) : 1;
	ctx.globalAlpha *= l.opacity / 100;
	ctx.fillStyle = l.fill;
	if (l.shape === 'circle') {
		ctx.beginPath();
		ctx.ellipse(0, 0, (w / 2) * grow, h / 2, 0, 0, TAU);
		ctx.fill();
		return;
	}
	roundRectPath(ctx, -w / 2, -h / 2, w * grow, h, (Math.min(w, h) * l.radius) / 100);
	ctx.fill();
}

function drawImageLayer(ctx: CanvasRenderingContext2D, l: ImageLayer, f: FrameContext) {
	const img = f.media?.image(l.mediaId);
	const w = (l.w / 100) * W;
	if (!img) {
		// marcador mientras la imagen no está disponible
		ctx.strokeStyle = 'rgba(255,255,255,.35)';
		ctx.setLineDash([12, 10]);
		ctx.strokeRect(-w / 2, -w / 2, w, w);
		ctx.setLineDash([]);
		return;
	}
	if (l.flip) ctx.scale(-1, 1);
	if (l.h === undefined) {
		const h = (img.height / img.width) * w;
		ctx.drawImage(img, -w / 2, -h / 2, w, h);
		return;
	}
	// caja de w × h: la imagen entra completa (contain) o la llena recortando los bordes (cover)
	const boxH = (l.h / 100) * H;
	const k = (l.fit === 'cover' ? Math.max : Math.min)(w / img.width, boxH / img.height);
	const dw = img.width * k;
	const dh = img.height * k;
	if (l.fit === 'cover') {
		ctx.beginPath();
		ctx.rect(-w / 2, -boxH / 2, w, boxH);
		ctx.clip();
	}
	ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
}

function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, index: number, local: number, f: FrameContext) {
	drawBackground(ctx, scene, index, local, f);
	for (const l of scene.layers) drawLayer(ctx, l, scene, local, f.content, f);
}

/**
 * Transición hacia la escena `index`: la anterior se congela en su último instante y la nueva
 * entra encima. Depende solo de `local`, así que es determinista y se puede dibujar fuera de orden.
 */
function drawTransition(ctx: CanvasRenderingContext2D, spec: CompiledSpec, index: number, local: number, tr: SceneTransition, f: FrameContext) {
	const prev = spec.scenes[index - 1];
	const cur = spec.scenes[index];
	const p = clamp01(local / tr.duration);
	const e = inOutCubic(p);
	const prevAt = prev.duration;
	const under = () => drawScene(ctx, prev, index - 1, prevAt, f);
	const over = () => drawScene(ctx, cur, index, local, f);
	switch (tr.kind) {
		case 'fade':
			under();
			ctx.save();
			ctx.globalAlpha *= e;
			over();
			ctx.restore();
			return;
		case 'dip': {
			// funde hacia un color y vuelve: la primera mitad oscurece la escena anterior, la segunda aclara la nueva
			if (p < 0.5) under();
			else over();
			ctx.save();
			ctx.globalAlpha *= 1 - Math.abs(p - 0.5) * 2;
			ctx.fillStyle = tr.color ?? '#000000';
			ctx.fillRect(0, 0, W, H);
			ctx.restore();
			return;
		}
		case 'slideLeft':
		case 'slideRight':
		case 'slideUp':
		case 'slideDown': {
			const horiz = tr.kind === 'slideLeft' || tr.kind === 'slideRight';
			const sign = tr.kind === 'slideLeft' || tr.kind === 'slideUp' ? 1 : -1; // slideLeft: la nueva entra desde la derecha
			const dist = horiz ? W : H;
			const off = (1 - e) * dist * sign;
			ctx.save();
			ctx.translate(horiz ? off - dist * sign : 0, horiz ? 0 : off - dist * sign);
			under();
			ctx.restore();
			ctx.save();
			ctx.translate(horiz ? off : 0, horiz ? 0 : off);
			over();
			ctx.restore();
			return;
		}
		case 'zoomIn': {
			under();
			const s = 1.35 - 0.35 * e;
			ctx.save();
			ctx.globalAlpha *= e;
			ctx.translate(W / 2, H / 2);
			ctx.scale(s, s);
			ctx.translate(-W / 2, -H / 2);
			over();
			ctx.restore();
			return;
		}
		case 'wipeLeft':
		case 'wipeRight': {
			under();
			ctx.save();
			ctx.beginPath();
			if (tr.kind === 'wipeLeft') ctx.rect(W * (1 - e), 0, W * e, H);
			else ctx.rect(0, 0, W * e, H);
			ctx.clip();
			over();
			ctx.restore();
			return;
		}
		default:
			over();
	}
}

export function buildCompiledTemplate(spec: CompiledSpec): TemplateDefinition {
	const duration = specDuration(spec);
	const fonts = [...new Set(spec.scenes.flatMap((s) => s.layers.flatMap((l) => (l.type === 'text' ? [l.font] : []))))];
	const thumbStart = spec.scenes.slice(0, spec.thumbScene).reduce((a, s) => a + s.duration, 0);
	const thumbDur = spec.scenes[spec.thumbScene]?.duration ?? 2;
	return withOutro({
		id: spec.id,
		name: spec.name,
		description: spec.description,
		category: spec.category,
		audience: spec.audience,
		palette: ['#222233', '#ffffff'],
		fonts,
		duration,
		fps: SPEC_LIMITS.fps,
		defaultAudioId: spec.defaultAudioId,
		photoRule: 'La foto aparece en los lugares que definió el diseño; si no hay foto, se muestra la inicial o se omite.',
		thumbnailTime: thumbStart + Math.min(thumbDur - 0.1, 1.6),
		spec,
		draw(ctx, f) {
			const {index, scene, local} = sceneAt(spec, f.t);
			const tr = scene.transition;
			// con fondos de video FFmpeg compone las escenas por su cuenta: ahí no hay transiciones dibujadas
			if (tr && index > 0 && !f.overlayOnly && local < tr.duration) {
				drawTransition(ctx, spec, index, local, tr, f);
				return;
			}
			drawScene(ctx, scene, index, local, f);
		},
	});
}

/** ¿Alguna escena usa un video de fondo? Cambia la forma de exportar. */
export const hasVideoScenes = (spec: CompiledSpec) => spec.scenes.some((s) => s.bg.kind === 'video');
