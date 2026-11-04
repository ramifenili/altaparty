// API pública de exportación. Mantiene separadas las dos operaciones:
//  - exportPreview: SIEMPRE con marca de agua incrustada, sin requisitos.
//  - exportFinal:   sin marca de agua, solo con una autorización de compra
//                   emitida por el servidor tras verificar el pago en Mercado Pago.

import type { TemplateContent, TemplateDefinition } from "../templates/types";
import type { ResolvedAudio } from "../audio/library";
import {
  ExportError,
  isMobileDevice,
  runEngine,
  type Progress,
} from "./engine";
import {
  verifyAuthorizationWithServer,
  type FinalAuthorization,
} from "../client/purchases";

type Common = {
  template: TemplateDefinition;
  content: TemplateContent;
  audio: ResolvedAudio;
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
};

/** Fotogramas por segundo de la vista previa gratis: menos fotogramas = se crea más rápido (misma medida). */
const PREVIEW_FPS = 20;

/** Vista previa 540x960 con marca de agua en cada fotograma. */
export function exportPreview(o: Common) {
  return runEngine({
    ...o,
    watermark: true,
    scale: 0.75,
    fps: PREVIEW_FPS,
    quality: 0.5,
    crf: 32,
    preset: "ultrafast",
  });
}

/** Factor respecto de 720×1280: 1,5 = Full HD 1080×1920. */
const FULL_HD = 1.5;

/**
 * Video final sin marca de agua. Exige una autorización de pago válida.
 * En computadora sale en Full HD (1080×1920); en celular, en 720×1280. Si el Full HD no entra en la
 * memoria del equipo, se vuelve a generar solo en 720×1280.
 */
export async function exportFinal(
  o: Common & { authorization: FinalAuthorization },
) {
  if (o.authorization.templateId !== o.template.id) {
    throw new Error("La compra corresponde a otra plantilla.");
  }
  // el servidor comprueba firma y vencimiento; sin autorización válida no se renderiza
  await verifyAuthorizationWithServer(o.authorization);
  const final = { ...o, watermark: false, crf: 22, preset: "superfast" };
  if (isMobileDevice()) return runEngine({ ...final, scale: 1 });
  try {
    return await runEngine({ ...final, scale: FULL_HD });
  } catch (e) {
    const retry =
      e instanceof ExportError &&
      (e.kind === "resources" || e.kind === "unknown") &&
      !o.signal?.aborted;
    if (!retry) throw e;
    return runEngine({ ...final, scale: 1 });
  }
}
