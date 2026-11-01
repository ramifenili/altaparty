import {W, H} from '../templates/kit';
import {WATERMARK, watermarkOpacity, type WatermarkConfig} from '../config/watermark';

type Img = CanvasImageSource & {width: number; height: number};
let image: Img | null = null;
let loading: Promise<ImageBitmap | null> | null = null;
/** configuración vigente (la define el admin; el servidor la entrega por /api/config) */
let current: WatermarkConfig = WATERMARK;

export function setWatermarkConfig(cfg: WatermarkConfig) {
	if (JSON.stringify(cfg) === JSON.stringify(current)) return;
	current = cfg;
	image = null;
	loading = null;
}

export function getWatermarkConfig() {
	return current;
}

/** Texto de la marca (también lo usa el aviso de la interfaz). */
export const WATERMARK_TEXT = WATERMARK.text;

/** Carga (una vez) la imagen configurada. Devuelve null si el modo es texto o si falla la carga. */
export function loadWatermarkImage(cfg: WatermarkConfig = current): Promise<ImageBitmap | null> {
	if (cfg.mode !== 'image') return Promise.resolve(null);
	loading ??= (async () => {
		try {
			const res = await fetch(cfg.imageSrc);
			if (!res.ok) return null;
			const bmp = await createImageBitmap(await res.blob());
			image = bmp;
			return bmp;
		} catch {
			return null;
		}
	})();
	return loading;
}

/** Usado por el Worker de exportación, que recibe la imagen ya decodificada. */
export function setWatermarkImage(img: Img | null) {
	image = img;
}

/**
 * Marca de agua de la vista previa. Se pinta DENTRO del fotograma (el mismo
 * canvas que luego se codifica a MP4), así queda incrustada en el video. Es un
 * patrón repetido que cubre todo el cuadro y se desplaza lentamente, más un
 * sello central. Se configura en `config/watermark.ts`.
 *
 * No existe ningún parámetro para ocultarla: el único camino sin marca es
 * `renderFrame(..., {watermark: false})`, que solo invoca el exportador final
 * después de validar una autorización de pago emitida por el servidor.
 */
export function drawWatermark(ctx: CanvasRenderingContext2D, t: number, cfg: WatermarkConfig = current) {
	const alpha = watermarkOpacity(cfg);
	const useImage = cfg.mode === 'image' && image;
	ctx.save();
	ctx.translate(W / 2, H / 2);
	ctx.rotate((cfg.angleDeg * Math.PI) / 180);
	ctx.font = `800 ${cfg.textSize}px Montserrat, system-ui, sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.lineJoin = 'round';
	ctx.lineWidth = 6;
	const drift = (t * cfg.driftPerSecond) % cfg.spacingX;
	for (let row = -9; row <= 9; row++) {
		const off = (row % 2) * (cfg.spacingX / 2) - drift;
		for (let col = -3; col <= 3; col++) {
			const x = col * cfg.spacingX + off;
			const y = row * cfg.spacingY;
			if (useImage && image) {
				const w = cfg.imageWidth;
				const h = (image.height / image.width) * w;
				ctx.globalAlpha = alpha;
				ctx.drawImage(image, x - w / 2, y - h / 2, w, h);
			} else {
				ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.8})`;
				ctx.strokeText(cfg.text, x, y);
				ctx.fillStyle = `rgba(255,255,255,${alpha})`;
				ctx.fillText(cfg.text, x, y);
			}
		}
	}
	ctx.restore();

	if (cfg.centerStamp) {
		ctx.save();
		ctx.translate(W / 2, H * 0.52);
		ctx.rotate(-Math.PI / 14);
		ctx.fillStyle = `rgba(0,0,0,${alpha * 0.7})`;
		ctx.fillRect(-300, -48, 600, 96);
		ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, alpha + 0.2)})`;
		ctx.lineWidth = 4;
		ctx.strokeRect(-300, -48, 600, 96);
		ctx.fillStyle = `rgba(255,255,255,${Math.min(1, alpha + 0.3)})`;
		ctx.font = '800 44px Montserrat, system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(cfg.centerStampTitle, 0, -10);
		ctx.font = '700 22px Montserrat, system-ui, sans-serif';
		ctx.fillText(cfg.centerStampSubtitle, 0, 26);
		ctx.restore();
	}
}
