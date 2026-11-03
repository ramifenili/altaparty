// Imagen 1080×1920 de una invitación: una "captura" de la plantilla en su instante más representativo.
// Es la misma plantilla que se usa para el video (mismos datos, tipografías e imágenes), dibujada una sola vez.

import type { TemplateContent, TemplateDefinition } from "../templates/types";
import { loadTemplateAssets } from "../templates/assets";
import { loadFonts } from "./assets";
import { renderPoster } from "./frame";
import { loadWatermarkImage } from "./watermark";
import { CompiledMedia } from "./mediaAccess";

export const STILL_WIDTH = 1080;
export const STILL_HEIGHT = 1920;

/** Segundo del video del que sale la imagen: el indicado por la plantilla (`imageTime`) o su cuadro más representativo. */
export const stillTime = (
  t: Pick<TemplateDefinition, "imageTime" | "thumbnailTime">,
) => t.imageTime ?? t.thumbnailTime;

/** La imagen en PNG (sin pérdida) y en JPG (más liviana). */
export type StillImage = { png: Blob; jpg: Blob };

/**
 * Genera la imagen en PNG y en JPG. Con `watermark` lleva la marca de agua de la vista previa; sin ella es la versión comprada
 * (el llamador tiene que haber obtenido antes la autorización del servidor).
 */
export async function renderStill(
  template: TemplateDefinition,
  content: TemplateContent,
  o: { watermark: boolean },
): Promise<StillImage> {
  const [, , , media] = await Promise.all([
    loadFonts([...template.fonts, "Montserrat"]),
    loadTemplateAssets(template),
    o.watermark ? loadWatermarkImage() : null,
    template.spec
      ? CompiledMedia.load(
          template.spec,
          "first-frame",
          template.spec.thumbScene,
        )
      : null,
  ]);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = STILL_WIDTH;
    canvas.height = STILL_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Tu navegador no permite crear la imagen.");
    renderPoster(ctx, template, content, {
      watermark: o.watermark,
      scale: STILL_WIDTH / 720,
    });
    const blob = (type: string, q?: number) =>
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("No pudimos crear la imagen.")),
          type,
          q,
        ),
      );
    return {
      png: await blob("image/png"),
      jpg: await blob("image/jpeg", 0.93),
    };
  } finally {
    media?.dispose();
  }
}
