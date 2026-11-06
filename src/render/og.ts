// Imagen para compartir (Open Graph / Twitter) de una plantilla: 750×750 JPG con el diseño de la imagen vertical de la plantilla
// y los datos de ejemplo (no los de un cliente). La dibuja el panel de admin; el servidor la guarda y no se vuelve a generar
// mientras la plantilla no cambie (ver `ogFingerprint`).

import type { TemplateDefinition } from "../templates/types";
import { loadTemplateAssets } from "../templates/assets";
import { loadFonts } from "./assets";
import { drawShareArt, ML_SIZE } from "./mercadolibre";
import { OUTRO_BRAND } from "../templates/outro";
import { CompiledMedia } from "./mediaAccess";

export const OG_SIZE = 750;
/** Subirlo fuerza a regenerar todas las imágenes (por ejemplo, si cambia el recuadro). */
const OG_RENDER_VERSION = 5;

/** Huella corta de la plantilla: cambia cuando cambia su dibujo, su nombre o su definición. */
export function ogFingerprint(t: TemplateDefinition): string {
  const src = [
    OG_RENDER_VERSION,
    t.id,
    t.name,
    t.thumbnailTime,
    t.imageTime,
    t.assets?.join(","),
    t.spec ? `${t.spec.updatedAt}` : "",
    t.draw.toString(),
    t.ml ? t.ml.background.toString() + (t.ml.characters ?? []).join(",") : "",
  ].join("|");
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < src.length; i++) {
    h1 = Math.imul(h1 ^ src.charCodeAt(i), 0x01000193);
    h2 = Math.imul(h2 + src.charCodeAt(i), 0x85ebca6b) ^ (h2 >>> 13);
  }
  return ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)).slice(0, 12);
}

/** Dibuja la imagen cuadrada: el fondo y los personajes de la plantilla centrados, con el texto «¡Hacé tu invitación en video! AltaParty.com». */
export async function renderOgImage(
  template: TemplateDefinition,
): Promise<Blob> {
  const [, , media] = await Promise.all([
    loadFonts([...template.fonts, "DynaPuff", "Inter"]),
    loadTemplateAssets(template),
    template.spec
      ? CompiledMedia.load(
          template.spec,
          "first-frame",
          template.spec.thumbScene,
        )
      : null,
  ]);
  try {
    const art = document.createElement("canvas");
    art.width = ML_SIZE;
    art.height = ML_SIZE;
    const actx = art.getContext("2d");
    const out = document.createElement("canvas");
    out.width = OG_SIZE;
    out.height = OG_SIZE;
    const ctx = out.getContext("2d");
    if (!actx || !ctx)
      throw new Error("Tu navegador no permite crear la imagen.");
    // fondo y personajes de la plantilla, centrados, dejando abajo lugar para el texto
    const BAND = 230;
    drawShareArt(actx, template, (BAND * ML_SIZE) / OG_SIZE);
    ctx.drawImage(art, 0, 0, OG_SIZE, OG_SIZE);
    // franja inferior con el llamado a la acción
    const g = ctx.createLinearGradient(0, OG_SIZE - BAND, 0, OG_SIZE);
    g.addColorStop(0, "rgba(10,6,28,0)");
    g.addColorStop(0.4, "rgba(10,6,28,0.85)");
    g.addColorStop(1, "rgba(10,6,28,0.95)");
    ctx.fillStyle = g;
    ctx.fillRect(0, OG_SIZE - BAND, OG_SIZE, BAND);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const fit = (str: string, family: string, max: number, width: number) => {
      let size = max;
      do {
        ctx.font = `800 ${size}px ${family}`;
        size -= 2;
      } while (ctx.measureText(str).width > width && size > 16);
    };
    // texto en Inter
    const line = "¡Hacé tu invitación en video!";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 8;
    fit(line, "Inter, sans-serif", 54, OG_SIZE - 70);
    ctx.textAlign = "center";
    ctx.fillText(line, OG_SIZE / 2, OG_SIZE - 96);
    ctx.shadowBlur = 0;
    // logo con la tipografía del logo (DynaPuff): Alta + Party en degradé + .com
    ctx.textAlign = "left";
    const size = 46;
    ctx.font = `700 ${size}px DynaPuff, sans-serif`;
    const wA = ctx.measureText(OUTRO_BRAND.first).width;
    const wP = ctx.measureText(OUTRO_BRAND.second).width;
    const wC = ctx.measureText(".com").width;
    const x0 = (OG_SIZE - (wA + wP + wC)) / 2;
    const y = OG_SIZE - 38;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(OUTRO_BRAND.first, x0, y);
    const lg = ctx.createLinearGradient(x0 + wA, y - size, x0 + wA + wP, y);
    lg.addColorStop(0, "#ff3d9a");
    lg.addColorStop(1, "#ffc23d");
    ctx.fillStyle = lg;
    ctx.fillText(OUTRO_BRAND.second, x0 + wA, y);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(".com", x0 + wA + wP, y);
    return await new Promise<Blob>((resolve, reject) =>
      out.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("No pudimos crear la imagen.")),
        "image/jpeg",
        0.88,
      ),
    );
  } finally {
    media?.dispose();
  }
}
