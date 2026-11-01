// Cierre de AltaParty, igual para todas las plantillas (de código y videos compilados).
// `withOutro` alarga cada plantilla con dos tramos: la última imagen (los datos de la
// fiesta) se queda `HOLD_SECONDS` más y después entra la pantalla negra con el logo y
// la web. Para cambiar el logo, el texto o las duraciones se edita solo este archivo.

import type {TemplateDefinition} from './types';
import {W, H, outCubic, prog} from './kit';

/** segundos que la última imagen de la plantilla (los datos de la fiesta) se queda de más */
export const HOLD_SECONDS = 1;
/** segundos que dura la pantalla negra con el logo */
export const OUTRO_SECONDS = 2;

export const OUTRO_BRAND = {first: 'Alta', second: 'Party'};
export const OUTRO_URL = 'altaparty.com';
const FONT = 'Montserrat, system-ui, sans-serif';

/**
 * Logo (texto) centrado en `cx`, con la línea de base en `y`. `mono` lo dibuja todo del color de relleno actual
 * (para ponerlo semitransparente sobre otras imágenes); si no, "Party" va en degradé rosa → dorado.
 */
export function drawLogo(ctx: CanvasRenderingContext2D, cx: number, y: number, size: number, mono = false) {
	ctx.save();
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.font = `800 ${size}px ${FONT}`;
	const wA = ctx.measureText(OUTRO_BRAND.first).width;
	const wP = ctx.measureText(OUTRO_BRAND.second).width;
	const x0 = cx - (wA + wP) / 2;
	if (!mono) ctx.fillStyle = '#fff';
	ctx.fillText(OUTRO_BRAND.first, x0, y);
	if (!mono) {
		const g = ctx.createLinearGradient(x0 + wA, y - size, x0 + wA + wP, y);
		g.addColorStop(0, '#ff3d9a');
		g.addColorStop(1, '#ffc23d');
		ctx.fillStyle = g;
	}
	ctx.fillText(OUTRO_BRAND.second, x0 + wA, y);
	ctx.restore();
}

/** Dibuja la pantalla final; `local` son los segundos desde que empieza (0..OUTRO_SECONDS). */
export function drawOutro(ctx: CanvasRenderingContext2D, local: number) {
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, W, H);

	const logoIn = outCubic(prog(local, 0.05, 0.5));
	const urlIn = outCubic(prog(local, 0.4, 0.4));
	const size = 128;
	const y = H / 2 + size * 0.15 + (1 - logoIn) * 24;

	ctx.save();
	ctx.globalAlpha = logoIn;
	drawLogo(ctx, W / 2, y, size);
	ctx.restore();

	ctx.save();
	ctx.globalAlpha = urlIn;
	ctx.fillStyle = 'rgba(255,255,255,0.85)';
	ctx.font = `600 38px ${FONT}`;
	ctx.textAlign = 'center';
	ctx.fillText(OUTRO_URL, W / 2, y + 78 + (1 - urlIn) * 12);
	ctx.restore();
}

/** Alarga la plantilla con la última imagen sostenida y la pantalla final. Se aplica una sola vez, al armar el catálogo. */
export function withOutro(t: TemplateDefinition): TemplateDefinition {
	const base = t.duration;
	const contentEnd = base + HOLD_SECONDS;
	return {
		...t,
		duration: contentEnd + OUTRO_SECONDS,
		audioEnd: contentEnd,
		draw(ctx, f) {
			if (f.t < base) t.draw(ctx, f);
			else if (f.t < contentEnd) t.draw(ctx, {...f, t: base - 1 / t.fps});
			else drawOutro(ctx, f.t - contentEnd);
		},
	};
}
