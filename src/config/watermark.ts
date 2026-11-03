// Configuración de la marca de agua de la vista previa. La edita el dueño del
// sitio (este archivo); NO está expuesta a los usuarios y no hay opción para
// desactivarla: la vista previa siempre la lleva.

export type WatermarkConfig = {
  /** 'text' dibuja `text`; 'image' repite la imagen de `imageSrc` (si no carga, usa el texto). */
  mode: "text" | "image";
  text: string;
  /** ruta pública, p. ej. '/watermark/logo.png' (PNG con transparencia recomendado) */
  imageSrc: string;
  /** transparencia en porcentaje (10–100): más bajo = más sutil. */
  opacityPercent: number;
  /** tamaño del texto en px (sobre un cuadro de 720×1280) */
  textSize: number;
  /** ancho de la imagen en px (sobre un cuadro de 720×1280) */
  imageWidth: number;
  /** separación entre repeticiones, en px */
  spacingX: number;
  spacingY: number;
  /** inclinación del patrón en grados */
  angleDeg: number;
  /** velocidad con que se desplaza el patrón (px/s); 0 = fijo */
  driftPerSecond: number;
  /** sello central más grande, difícil de recortar */
  centerStamp: boolean;
  centerStampTitle: string;
  centerStampSubtitle: string;
};

export const WATERMARK: WatermarkConfig = {
  mode: "text",
  text: "VISTA PREVIA · SIN COMPRAR",
  imageSrc: "/watermark/logo.png",
  opacityPercent: 30,
  textSize: 30,
  imageWidth: 240,
  spacingX: 560,
  spacingY: 132,
  angleDeg: -26,
  driftPerSecond: 26,
  centerStamp: true,
  centerStampTitle: "VISTA PREVIA",
  centerStampSubtitle: "Comprá el video final sin marca de agua",
};

/** Opacidad efectiva (0..1). Se fuerza un mínimo de 10 % para que nunca quede invisible por error. */
export function watermarkOpacity(cfg: WatermarkConfig = WATERMARK) {
  return Math.min(100, Math.max(10, cfg.opacityPercent)) / 100;
}
