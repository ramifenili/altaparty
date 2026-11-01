// Imágenes PNG de 1200×1200 para la publicación en Mercado Libre (solo las genera el admin desde la invitación):
//  1. "Información que necesitamos": con los personajes de la plantilla y los datos del formulario, línea por línea.
//  2. "Paso a paso": misma estética, sin personajes (solo algunos elementos decorativos de la plantilla).
// El diseño sale de la propia plantilla: si define `ml` (fondo, letras, colores y personajes de su imagen del video) se usa ese
// estilo; si no, uno genérico con su paleta y su tipografía (templates/poster.ts).

import type { MlStyle, TemplateDefinition } from "../templates/types";
import { loadTemplateAssets, tplImage } from "../templates/assets";
import {
  TAU,
  glow,
  vGradient,
  drawText,
  fitSize,
  wrapText,
  starPath,
  roundRectPath,
  hash,
} from "../templates/kit";
import { loadFonts } from "./assets";
import { drawLogo, OUTRO_URL } from "../templates/outro";

export const ML_SIZE = 1200;
export type MlVariant = "datos" | "pasos";

const EMOJI_FONT =
  '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

/** Los campos del formulario, tal cual los ve el cliente. */
const FIELDS: { icon: string; text: string }[] = [
  { icon: "📸", text: "Foto (opcional)" },
  { icon: "🎉", text: "Nombre del cumpleañero/a" },
  { icon: "🎂", text: "Edad que cumple" },
  { icon: "📅", text: "Fecha del evento" },
  { icon: "🏛️", text: "Nombre del salón o lugar" },
  { icon: "📍", text: "Dirección del salón o lugar" },
  { icon: "⏰", text: "Horario de la fiesta" },
];

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const DATA_LIST = (() => {
  const items = FIELDS.map((f) => lower(f.text.replace(/ \(opcional\)$/, "")));
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
})();

function shade(hex: string, k: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const luma = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1], 16);
  return (
    (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) /
    255
  );
};

/** Estilo genérico (plantillas sin `ml`): degradé de la paleta, rayas y confeti, con la tipografía de la plantilla. */
function genericStyle(t: TemplateDefinition): MlStyle {
  const pal = t.palette.filter((x) => /^#[0-9a-f]{6}$/i.test(x));
  const main = pal[0] ?? "#3b2a8c";
  const accent =
    [...pal.slice(1), "#ffd23f"].find((x) => luma(x) > 0.35 && x !== main) ??
    "#ffd23f";
  const dark = shade(main, -0.55);
  const family = t.fonts[0] ?? "Anton";
  const font = (s: number) => `${s}px ${family}, Anton, Impact, sans-serif`;
  const S = ML_SIZE;
  return {
    // se dibuja directamente a 1200×1200 (deshace la escala 1200/720 que aplica el generador)
    background: (ctx) => {
      ctx.save();
      ctx.scale(720 / S, 720 / S);
      ctx.fillStyle = vGradient(ctx, 0, S, [
        [0, shade(main, -0.25)],
        [0.55, shade(main, -0.45)],
        [1, dark],
      ]);
      ctx.fillRect(0, 0, S, S);
      glow(ctx, S * 0.7, S * 0.6, 700, accent, 0.28);
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = "#fff";
      for (let i = -6; i < 16; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 150, 0);
        ctx.lineTo(i * 150 + 75, 0);
        ctx.lineTo(i * 150 + 75 + 700, S);
        ctx.lineTo(i * 150 + 700, S);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const cols = [accent, "#ffffff", shade(main, 0.45), pal[2] ?? accent];
      for (let i = 0; i < 60; i++) {
        const r = 7 + hash(i, 3) * 15;
        ctx.save();
        ctx.globalAlpha = 0.35 + hash(i, 4) * 0.4;
        ctx.fillStyle = cols[i % cols.length];
        ctx.translate(hash(i, 1) * S, hash(i, 2) * S);
        ctx.rotate(hash(i, 5) * TAU);
        if (i % 3 === 0) {
          starPath(ctx, 0, 0, 4, r * 1.6, r * 0.5);
          ctx.fill();
        } else if (i % 3 === 1) ctx.fillRect(-r / 2, -r, r, r * 2);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.7, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore();
    },
    window: { datos: 0, pasos: 0 },
    characters: [],
    font,
    title: (ctx, lines, cx, y, maxW) => {
      const size = Math.min(
        ...lines.map((l) => fitSize(ctx, l, font, maxW, 130, 36)),
      );
      lines.forEach((l, i) =>
        drawText(ctx, l, cx, y + size + i * size * 1.05, {
          font,
          size,
          fill: "#ffffff",
          stroke: dark,
          strokeW: size * 0.14,
          shadow: shade(main, -0.7),
          shadowDy: size * 0.07,
          spacing: 1,
        }),
      );
      return y + size + (lines.length - 1) * size * 1.05;
    },
    heading: (ctx, str, x, baseline, size, align) =>
      drawText(ctx, str, x, baseline, {
        font,
        size,
        fill: accent,
        align,
        shadow: dark,
        shadowDy: size * 0.06,
        spacing: 0.5,
      }),
    label: (ctx, str, x, baseline, size, align) =>
      drawText(ctx, str, x, baseline, {
        font,
        size,
        fill: "#ffffff",
        align,
        shadow: dark,
        shadowDy: size * 0.06,
        spacing: 0.5,
      }),
    accent,
    ink: dark,
    panelPasos: { fill: "rgba(0,0,0,.4)", border: accent },
  };
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  st: MlStyle,
  variant: MlVariant,
) {
  const k = ML_SIZE / 720;
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(0, -st.window[variant]);
  ctx.beginPath();
  ctx.rect(0, st.window[variant], 720, 720);
  ctx.clip();
  st.background(ctx);
  ctx.restore();
}

function panel(
  ctx: CanvasRenderingContext2D,
  p: { fill: string; border: string } | null,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (!p) return;
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 44);
  ctx.fillStyle = p.fill;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = p.border;
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.restore();
}

function shadowed(ctx: CanvasRenderingContext2D, fn: () => void) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.45)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  fn();
  ctx.restore();
}

/** Posiciones (x, y, tamaño, giro) de los elementos repartidos por los bordes; algunos quedan cortados por el borde. */
const DATOS_SPOTS: [number, number, number, number][] = [
  [1040, 285, 140, 0.3],
  [770, 340, 70, -0.2],
  [920, 440, 100, 0.5],
  [1120, 520, 90, -0.4],
  [-25, 1090, 120, 0.2],
  [1130, 690, 70, 0.1],
];
const PASOS_SPOTS: [number, number, number, number][] = [
  [-40, 250, 120, 0.3],
  [1110, 230, 120, -0.3],
  [-30, 640, 90, 0.1],
  [1130, 700, 90, 0.4],
  [-35, 1080, 130, -0.2],
  [1100, 1090, 130, 0.25],
];

function spread(
  ctx: CanvasRenderingContext2D,
  im: NonNullable<ReturnType<typeof tplImage>>,
  spots: [number, number, number, number][],
) {
  for (const [x, y, w, rot] of spots) {
    const h = (w * im.height) / im.width;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(rot);
    shadowed(ctx, () => ctx.drawImage(im, -w / 2, -h / 2, w, h));
    ctx.restore();
  }
}

const images = (t: TemplateDefinition, names: string[] | undefined) =>
  (names ?? [])
    .map((n) => tplImage(t.id, n))
    .filter((x): x is NonNullable<typeof x> => !!x);

function drawDatos(
  ctx: CanvasRenderingContext2D,
  t: TemplateDefinition,
  st: MlStyle,
) {
  const S = ML_SIZE;
  drawBackground(ctx, st, "datos");
  const ty = st.title(ctx, ["INFORMACIÓN", "que necesitamos"], S / 2, 40, 1060);

  const art = images(t, st.characters);
  const narrow = art.length >= 3;

  // la lista, compacta y a la izquierda: el tamaño más grande con el que todo entra (un campo largo pasa a dos líneas)
  const px = 60;
  const iconW = 78;
  const textW = 660 - iconW;
  const top = ty + 34;
  const bottom = S - 50;
  const labels = FIELDS.map((f) => f.text);
  let size = 60;
  let rows: string[][] = [];
  let total = 0;
  for (; size >= 28; size -= 2) {
    rows = labels.map((l) => wrapText(ctx, l, st.font(size), textW * 0.95, 3));
    total =
      rows.reduce((a, r) => a + r.length * size * 1.1, 0) +
      (rows.length - 1) * size * 0.55;
    if (
      rows.every((r) => r.length <= 2 && !r.some((l) => l.endsWith("…"))) &&
      total <= bottom - top
    )
      break;
  }
  let y = top;
  FIELDS.forEach((f, i) => {
    const h = rows[i].length * size * 1.1;
    ctx.save();
    ctx.font = `${size + 6}px ${EMOJI_FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText(f.icon, px, y + h / 2);
    ctx.restore();
    rows[i].forEach((line, j) =>
      st.label(
        ctx,
        line,
        px + iconW,
        y + size * 0.82 + j * size * 1.1,
        size,
        "left",
      ),
    );
    y += h + size * 0.55;
  });

  // personajes a la derecha, apoyados abajo (el más grande va adelante)
  const scales = st.charScale ?? art.map(() => 1);
  const base = st.charHeight ?? (art.length === 1 ? 760 : narrow ? 540 : 600);
  const gapX = st.charGap ?? (narrow ? 8 : 24);
  const areaX = st.charX ?? (narrow ? 600 : 720);
  const areaW = S - areaX + 10;
  let charsTop = S;
  if (art.length) {
    let widths = art.map(
      (im, i) => ((base * scales[i]) / im.height) * im.width,
    );
    const k = Math.min(
      1,
      (areaW - gapX * (art.length - 1)) / widths.reduce((a, b) => a + b, 0),
    );
    widths = widths.map((w) => w * k);
    const sum = widths.reduce((a, b) => a + b, 0) + gapX * (art.length - 1);
    let x = areaX + (areaW - sum) / 2;
    const places = art.map((im, i) => {
      const h = (widths[i] * im.height) / im.width;
      const place = { im, i, x, w: widths[i], h };
      x += widths[i] + gapX;
      return place;
    });
    places
      .slice()
      .sort((a, b) => scales[a.i] - scales[b.i])
      .forEach(({ im, i, x, w, h }) => {
        charsTop = Math.min(charsTop, S - 20 - h);
        shadowed(ctx, () => {
          if (st.charFlip?.[i]) {
            ctx.translate(x + w, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(im, 0, S - 20 - h, w, h);
          } else ctx.drawImage(im, x, S - 20 - h, w, h);
        });
      });
  }

  // arriba a la derecha: los elementos de la plantilla (escudo, anillos, emblema), para no dejar el hueco vacío
  const decor = images(t, st.decor);
  if (st.scatter && decor.length) {
    spread(ctx, decor[0], DATOS_SPOTS);
    return;
  }
  const boxX = 740;
  const boxW = S - 50 - boxX;
  const boxY = ty + 30;
  const boxH = Math.min(decor.length === 1 ? 420 : 340, charsTop - 20 - boxY);
  if (decor.length && boxH > 120) {
    const gap = 30;
    let ws = decor.map((im) => (im.width / im.height) * boxH);
    const k = Math.min(
      1,
      (boxW - gap * (decor.length - 1)) / ws.reduce((a, b) => a + b, 0),
    );
    ws = ws.map((w) => w * k);
    const sum = ws.reduce((a, b) => a + b, 0) + gap * (decor.length - 1);
    let x = boxX + (boxW - sum) / 2;
    decor.forEach((im, i) => {
      const h = (ws[i] * im.height) / im.width;
      shadowed(ctx, () =>
        ctx.drawImage(im, x, boxY + (boxH - h) / 2, ws[i], h),
      );
      x += ws[i] + gap;
    });
  } else if (!art.length) {
    // sin personajes ni elementos: una insignia de estrella con la torta
    const R = 150;
    const cx = 920;
    const cy = 760;
    shadowed(ctx, () => {
      starPath(ctx, cx, cy, 14, R, R * 0.84, -Math.PI / 2);
      ctx.fillStyle = st.accent;
      ctx.fill();
    });
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.74, 0, TAU);
    ctx.fillStyle = st.ink;
    ctx.fill();
    ctx.save();
    ctx.font = `${R * 0.8}px ${EMOJI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎂", cx, cy);
    ctx.restore();
  }
}

function drawPasos(
  ctx: CanvasRenderingContext2D,
  t: TemplateDefinition,
  st: MlStyle,
) {
  const S = ML_SIZE;
  const desc = (s: number) => `400 ${s}px Montserrat, Arial, sans-serif`;
  drawBackground(ctx, st, "pasos");

  // elementos de la plantilla (sin personajes) en las esquinas
  const decor = images(t, st.decor);
  if (st.scatter && decor.length) spread(ctx, decor[0], PASOS_SPOTS);
  else {
    const spots: [number, number, number, number][] = [
      [S - 140, S - 150, 140, -0.25],
      [-5, S - 150, 140, 0.3],
    ];
    decor.slice(0, 2).forEach((im, i) => {
      const [x, y, w, rot] = spots[i];
      const h = (w * im.height) / im.width;
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(rot);
      shadowed(ctx, () => ctx.drawImage(im, -w / 2, -h / 2, w, h));
      ctx.restore();
    });
  }

  const ty = st.title(
    ctx,
    ["PASO A PASO:", "CÓMO OBTENER TU VIDEO"],
    S / 2,
    40,
    1060,
  );

  const px = 60;
  const pw = S - 120;
  const py = ty + 40;
  const ph = S - 40 - py;
  panel(ctx, st.panelPasos, px, py, pw, ph);

  const left = px + 110;
  const maxW = pw - 170;
  const bodySize = 29;
  const lineH = bodySize * 1.4;
  const steps: { title: string; text: string }[] = [
    {
      title: "ELEGÍ TU DISEÑO FAVORITO",
      text: "Buscá la temática que quieras. Si tenés otra idea, elegí “Otra temática” y contanos qué te gustaría hacer.",
    },
    {
      title: "HACÉ TU COMPRA",
      text: `Después de comprar, te contactamos por la mensajería de Mercado Libre para pedirte los datos: ${DATA_LIST}, y así poder personalizar tu invitación.`,
    },
    {
      title: "RECIBÍ TU VIDEO PERSONALIZADO",
      text: "Preparamos tu invitación y te la enviamos por WhatsApp, lista para compartir.",
    },
  ];
  const wrapped = steps.map((s) =>
    wrapText(ctx, s.text, desc(bodySize), maxW, 7),
  );
  const titleSize = Math.min(
    ...steps.map((s) => fitSize(ctx, s.title, st.font, maxW - 20, 46, 26)),
  );
  const blockH = wrapped.map((w) => titleSize * 1.25 + 12 + w.length * lineH);
  const footer = "ENTREGAMOS TODOS LOS DÍAS, INCLUSO LOS DOMINGOS";
  const footerSize = fitSize(ctx, footer, st.font, pw - 260, 30, 16);
  const free = ph - 60 - blockH.reduce((a, b) => a + b, 0) - footerSize * 1.6;
  const gap = Math.max(20, free / steps.length);
  let y = py + 40 + Math.min(gap / 2, 20);
  steps.forEach((s, i) => {
    // número en una insignia de acento
    const r = 36;
    const cy = y + titleSize * 0.55;
    ctx.beginPath();
    ctx.arc(px + 58, cy, r, 0, TAU);
    ctx.fillStyle = st.accent;
    ctx.fill();
    drawText(ctx, String(i + 1), px + 58, cy + r * 0.38, {
      font: st.font,
      size: r * 1.1,
      fill: st.ink,
    });
    st.heading(ctx, s.title, left, y + titleSize, titleSize, "left");
    wrapped[i].forEach((l, j) =>
      drawText(
        ctx,
        l,
        left,
        y + titleSize * 1.25 + 12 + bodySize + j * lineH - 4,
        { font: desc, size: bodySize, fill: "#ffffff", align: "left" },
      ),
    );
    y += blockH[i] + gap;
  });
  const fy = py + ph - 48;
  if (st.footerPill) {
    ctx.save();
    ctx.font = st.font(footerSize);
    const w = ctx.measureText(footer).width + 56;
    ctx.restore();
    const h = footerSize + 28;
    ctx.fillStyle = "#ffffff";
    roundRectPath(ctx, S / 2 - w / 2, fy - footerSize * 0.82 - 14, w, h, h / 2);
    ctx.fill();
    drawText(ctx, footer, S / 2, fy, {
      font: st.font,
      size: footerSize,
      fill: st.ink,
    });
  } else st.label(ctx, footer, S / 2, fy, footerSize, "center");
}

/**
 * Marca de AltaParty: el logo con la web, grande, en diagonal sobre el centro y muy transparente. Cruza el contenido, así que no se
 * puede recortar sin cortar la imagen, pero con tan poca opacidad todo el texto sigue leyéndose.
 */
function drawBrandMark(ctx: CanvasRenderingContext2D) {
  const S = ML_SIZE;
  ctx.save();
  ctx.translate(S / 2, S * 0.54);
  ctx.rotate(-Math.PI / 9);
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = 10;
  drawLogo(ctx, 0, 0, 230, true);
  ctx.font = `700 74px Montserrat, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(OUTRO_URL, 0, 105);
  ctx.restore();
}

/** Genera la imagen (PNG, 1200×1200) de la variante pedida con la plantilla indicada. */
export async function renderMercadoLibre(
  template: TemplateDefinition,
  variant: MlVariant,
): Promise<Blob> {
  await Promise.all([
    loadFonts([...template.fonts, "Montserrat"]),
    loadTemplateAssets(template),
  ]);
  await document.fonts.load("400 30px Montserrat").catch(() => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = ML_SIZE;
  canvas.height = ML_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no permite generar la imagen.");
  const st = template.ml ?? genericStyle(template);
  if (variant === "datos") drawDatos(ctx, template, st);
  else drawPasos(ctx, template, st);
  drawBrandMark(ctx);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("No pudimos generar la imagen.")),
      "image/png",
    ),
  );
}
