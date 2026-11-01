import type {MediaAccess, TemplateContent, TemplateDefinition} from '../templates/types';
import {W, H} from '../templates/kit';
import {drawWatermark} from './watermark';
import {drawGenericPoster} from '../templates/poster';

export type FrameOptions = {
	/** true = vista previa (marca de agua incrustada); false = versión final comprada */
	watermark: boolean;
	/** factor de resolución respecto de 720x1280 */
	scale: number;
	/** imágenes/videos de un video compilado */
	media?: MediaAccess;
	/** exportación con fondos de video: solo capas, con transparencia */
	overlayOnly?: boolean;
};

/** Dibuja un fotograma completo (plantilla + marca de agua opcional) en el canvas. */
export function renderFrame(
	ctx: CanvasRenderingContext2D,
	template: TemplateDefinition,
	content: TemplateContent,
	t: number,
	opts: FrameOptions
) {
	ctx.save();
	ctx.setTransform(opts.scale, 0, 0, opts.scale, 0, 0);
	ctx.clearRect(0, 0, W, H);
	ctx.beginPath();
	ctx.rect(0, 0, W, H);
	ctx.clip();
	template.draw(ctx, {t, content, media: opts.media, overlayOnly: opts.overlayOnly});
	if (opts.watermark) drawWatermark(ctx, t);
	ctx.restore();
}

/** La imagen 1080×1920: el diseño propio de la plantilla (`poster`) o el genérico, con la marca de agua si es la vista previa. */
export function renderPoster(ctx: CanvasRenderingContext2D, template: TemplateDefinition, content: TemplateContent, opts: {watermark: boolean; scale: number}) {
	ctx.save();
	ctx.setTransform(opts.scale, 0, 0, opts.scale, 0, 0);
	ctx.clearRect(0, 0, W, H);
	ctx.beginPath();
	ctx.rect(0, 0, W, H);
	ctx.clip();
	if (template.poster) template.poster(ctx, content);
	else drawGenericPoster(ctx, template, content);
	if (opts.watermark) drawWatermark(ctx, 0);
	ctx.restore();
}

export function frameSize(scale: number) {
	return {width: Math.round(W * scale), height: Math.round(H * scale)};
}
