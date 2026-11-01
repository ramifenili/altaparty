// Plantilla "Fiesta de Campeones": estética de comunicación deportiva (azul rey con franjas diagonales, blanco con
// brillo cian, panel dorado tipo foil con marco fino, rayos de sol, cápsulas de título y texto vertical) con la
// tipografía Red Hat Display. Cinco bloques: presentación con el nombre, "Estás convocado" con la fecha, la hora, el
// lugar y un cierre nocturno. Las imágenes (escudo, equipo, Dibu, jugador, hinchas) están en public/templates/campeones/
// y se pueden reemplazar. Todo es función pura de `t`.

import type { MlStyle, TemplateContent, TemplateDefinition } from "./types";
import {
  W,
  H,
  TAU,
  clamp01,
  lerp,
  prog,
  outCubic,
  outBack,
  hash,
  glow,
  vGradient,
  staticLayer,
  drawText,
  fitSize,
  drawPhotoIn,
  starPath,
  roundRectPath,
  confetti,
  twinkles,
  uniformRows,
  dateLine,
  dateParts,
} from "./kit";
import { ball } from "./boca";
import { tplImage, drawContain, drawCover } from "./assets";

const ROYAL = "#1f3fbf";
const ROYAL_D = "#0e2a8f";
const DEEP = "#071a5e";
const BLUE = "#1f56d8";
const CYAN = "#2ec4ff";
const CYAN_D = "#1a8be0";
const GOLD = "#d9a441";
const GOLD_L = "#f6df9a";
const GOLD_D = "#9a6b1c";
const ICE = "#eef5ff";
const WHITE = "#ffffff";
const NAVY = "#0a1f6e";

const rhd = (wt: number) => (s: number) =>
  `${wt} ${s}px RedHatDisplay, system-ui, sans-serif`;
const f900 = rhd(900);
const f800 = rhd(800);
const f700 = rhd(700);

const ID = "campeones";
const img = (name: string) => tplImage(ID, name);

// límites de cada bloque (segundos)
// el último bloque (resumen con fecha, horario y lugar) dura lo suficiente para quedarse unos segundos quieto
const CUTS = [0, 5.6, 10.4, 15, 20, 24.6, 32] as const;
const DURATION = CUTS[CUTS.length - 1];

// ---------------------------------------------------------------- fondos

/** Marco fino con brillo cian (como los bordes de las piezas de referencia). */
function glowFrame(
  c: CanvasRenderingContext2D,
  inset: number,
  color: string,
  light: string,
) {
  c.save();
  c.lineJoin = "round";
  c.shadowColor = light;
  c.shadowBlur = 26;
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  c.shadowBlur = 0;
  c.strokeStyle = "rgba(255,255,255,.55)";
  c.lineWidth = 1.5;
  c.strokeRect(inset + 8, inset + 8, W - (inset + 8) * 2, H - (inset + 8) * 2);
  c.restore();
}

function royalBg(ctx: CanvasRenderingContext2D) {
  staticLayer(ctx, "camp-royal", (c) => {
    c.fillStyle = vGradient(c, 0, H, [
      [0, "#2a4fd0"],
      [0.55, ROYAL],
      [1, ROYAL_D],
    ]);
    c.fillRect(0, 0, W, H);
    // franjas diagonales más oscuras
    c.fillStyle = "rgba(6,22,110,.30)";
    for (let i = -2; i < 6; i++) {
      c.beginPath();
      c.moveTo(i * 230, 0);
      c.lineTo(i * 230 + 120, 0);
      c.lineTo(i * 230 + 120 + 520, H);
      c.lineTo(i * 230 + 520, H);
      c.fill();
    }
    c.fillStyle = "rgba(80,140,255,.10)";
    for (let i = -2; i < 6; i++) {
      c.beginPath();
      c.moveTo(i * 230 + 150, 0);
      c.lineTo(i * 230 + 190, 0);
      c.lineTo(i * 230 + 190 + 520, H);
      c.lineTo(i * 230 + 150 + 520, H);
      c.fill();
    }
    glow(c, W / 2, 760, 560, "rgba(70,140,255,.35)");
    const v = c.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 920);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,8,50,.5)");
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);
    glowFrame(c, 16, CYAN, "rgba(46,196,255,.9)");
  });
}

function iceBg(ctx: CanvasRenderingContext2D) {
  staticLayer(ctx, "camp-ice", (c) => {
    c.fillStyle = vGradient(c, 0, H, [
      [0, "#ffffff"],
      [0.6, ICE],
      [1, "#d6e8ff"],
    ]);
    c.fillRect(0, 0, W, H);
    glow(c, W / 2, H, 760, "rgba(46,196,255,.45)");
    glow(c, 0, 380, 380, "rgba(46,196,255,.25)");
    // formas azules curvas en las esquinas
    c.fillStyle = BLUE;
    c.beginPath();
    c.arc(W + 70, -50, 330, 0, TAU);
    c.fill();
    c.fillStyle = ROYAL_D;
    c.beginPath();
    c.arc(-80, H + 60, 360, 0, TAU);
    c.fill();
    c.strokeStyle = "rgba(10,31,110,.55)";
    c.lineWidth = 4;
    c.beginPath();
    c.arc(W + 70, -50, 372, 0.4, 1.9);
    c.stroke();
    c.beginPath();
    c.arc(-80, H + 60, 410, -1.9, -0.4);
    c.stroke();
    glowFrame(c, 16, BLUE, "rgba(46,196,255,.8)");
  });
}

function nightBg(ctx: CanvasRenderingContext2D) {
  staticLayer(ctx, "camp-night2", (c) => {
    c.fillStyle = vGradient(c, 0, H, [
      [0, "#030c3a"],
      [0.5, "#0b2a8a"],
      [1, "#04133f"],
    ]);
    c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(40,90,220,.18)";
    for (let i = -2; i < 6; i++) {
      c.beginPath();
      c.moveTo(i * 230, 0);
      c.lineTo(i * 230 + 120, 0);
      c.lineTo(i * 230 + 120 + 520, H);
      c.lineTo(i * 230 + 520, H);
      c.fill();
    }
    for (const x of [100, 280, 460, 620])
      glow(c, x, 60, 300, "rgba(180,225,255,.4)");
    for (let row = 0; row < 8; row++) {
      for (let i = 0; i < 36; i++) {
        const lit = hash(row * 40 + i, 11);
        c.fillStyle = `rgba(${120 + lit * 120},${180 + lit * 60},255,${0.05 + lit * 0.09})`;
        c.beginPath();
        c.arc(i * 21 + (row % 2) * 10, 220 + row * 34, 3 + row * 0.15, 0, TAU);
        c.fill();
      }
    }
    const v = c.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 950);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,30,.6)");
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);
    glowFrame(c, 16, CYAN, "rgba(46,196,255,.9)");
  });
}

/** Panel dorado tipo foil con un marco fino desplazado. La esquina superior izquierda es más redondeada. */
function foil(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  staticLayer(ctx, `camp-foil-${x}-${y}-${w}-${h}`, (c) => {
    const path = (
      ox: number,
      oy: number,
      ow: number,
      oh: number,
      r: number,
    ) => {
      c.beginPath();
      c.moveTo(ox + r, oy);
      c.lineTo(ox + ow - 16, oy);
      c.quadraticCurveTo(ox + ow, oy, ox + ow, oy + 16);
      c.lineTo(ox + ow, oy + oh - 16);
      c.quadraticCurveTo(ox + ow, oy + oh, ox + ow - 16, oy + oh);
      c.lineTo(ox + 16, oy + oh);
      c.quadraticCurveTo(ox, oy + oh, ox, oy + oh - 16);
      c.lineTo(ox, oy + r);
      c.quadraticCurveTo(ox, oy, ox + r, oy);
      c.closePath();
    };
    path(x, y, w, h, 70);
    const g = c.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "#b27d22");
    g.addColorStop(0.3, "#f1cd73");
    g.addColorStop(0.55, "#c9962f");
    g.addColorStop(0.8, "#f6df9a");
    g.addColorStop(1, "#a8741c");
    c.fillStyle = g;
    c.fill();
    c.save();
    path(x, y, w, h, 70);
    c.clip();
    // textura de lámina arrugada
    for (let i = 0; i < 1400; i++) {
      const px = x + hash(i, 1) * w;
      const py = y + hash(i, 2) * h;
      const s = 2 + hash(i, 3) * 9;
      c.fillStyle =
        hash(i, 4) > 0.5
          ? `rgba(255,244,190,${0.1 + hash(i, 5) * 0.2})`
          : `rgba(110,70,10,${0.08 + hash(i, 6) * 0.16})`;
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px + s, py + s * hash(i, 7));
      c.lineTo(px + s * hash(i, 8) - s * 0.3, py + s);
      c.fill();
    }
    c.restore();
    // marco fino
    c.strokeStyle = GOLD_L;
    c.lineWidth = 3;
    path(x - 18, y - 18, w + 36, h + 36, 84);
    c.stroke();
  });
}

/** Rayos de sol dorados (giran muy despacio). */
function sunRays(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  t: number,
  alpha = 1,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.05);
  ctx.globalAlpha *= alpha;
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n;
    const wob = Math.sin(t * 1.4 + i) * 0.015;
    ctx.save();
    ctx.rotate(a + wob);
    const g = ctx.createLinearGradient(r0, 0, r1, 0);
    g.addColorStop(0, GOLD_L);
    g.addColorStop(1, GOLD);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(r0, -r0 * 0.1);
    ctx.quadraticCurveTo(
      (r0 + r1) / 2,
      -r0 * 0.22 * (i % 2 ? 1 : -1),
      r1 * (i % 2 ? 1 : 0.82),
      0,
    );
    ctx.quadraticCurveTo((r0 + r1) / 2, r0 * 0.14, r0, r0 * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, r0 * 1.2);
  gg.addColorStop(0, "rgba(255,240,170,.9)");
  gg.addColorStop(1, "rgba(255,240,170,0)");
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.arc(0, 0, r0 * 1.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- piezas de texto y forma

function star(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill = GOLD,
) {
  starPath(ctx, x, y, 5, r, r * 0.46, -Math.PI / 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

type TextOpts = {
  align?: CanvasTextAlign;
  from?: "left" | "right" | "up" | "down" | "none";
  font?: (s: number) => string;
  spacing?: number;
  shadow?: string;
};

/** Texto que entra deslizando con un fundido. */
function slide(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number,
  lt: number,
  start: number,
  fill: string,
  o: TextOpts = {},
) {
  const p = prog(lt, start, 0.55);
  if (p <= 0) return;
  const e = outCubic(p);
  const from = o.from ?? "left";
  const dx =
    from === "left" ? -(1 - e) * 460 : from === "right" ? (1 - e) * 460 : 0;
  const dy = from === "up" ? -(1 - e) * 80 : from === "down" ? (1 - e) * 80 : 0;
  ctx.save();
  ctx.globalAlpha *= clamp01(p * 2.5);
  drawText(ctx, str, x + dx, y + dy, {
    font: o.font ?? f900,
    size,
    fill,
    align: o.align ?? "left",
    spacing: o.spacing,
    shadow: o.shadow,
    shadowDy: size * 0.05,
  });
  ctx.restore();
}

function pop(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number,
  lt: number,
  start: number,
  fill: string,
  o: TextOpts = {},
) {
  const p = prog(lt, start, 0.55);
  if (p <= 0) return;
  const s = Math.max(0.01, outBack(p));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha *= clamp01(p * 3);
  drawText(ctx, str, 0, 0, {
    font: o.font ?? f900,
    size,
    fill,
    align: o.align ?? "left",
    spacing: o.spacing,
    shadow: o.shadow,
    shadowDy: size * 0.05,
  });
  ctx.restore();
}

/** Texto vertical (de abajo hacia arriba) como el "AMISTOSOS" de la referencia. */
function vertical(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number,
  lt: number,
  start: number,
  fill: string,
) {
  const p = prog(lt, start, 0.7);
  if (p <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.globalAlpha *= clamp01(p * 2);
  ctx.translate(0, (1 - outCubic(p)) * 60);
  drawText(ctx, str, 0, 0, {
    font: f900,
    size,
    fill,
    align: "center",
    spacing: size * 0.12,
  });
  ctx.restore();
}

/** Cápsula redondeada (como el banner "GANADOR"). */
function pill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  fill: string | CanvasGradient,
  lt: number,
  start: number,
) {
  const p = prog(lt, start, 0.55);
  if (p <= 0) return 0;
  const e = outCubic(p);
  ctx.save();
  ctx.globalAlpha *= clamp01(p * 2.5);
  ctx.translate(0, (1 - e) * 90);
  ctx.shadowColor = "rgba(0,10,70,.45)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  roundRectPath(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  return e;
}

/** La pelota: usa la imagen `pelota` de la carpeta (con una sombra suave) y, si falta, la dibujada por código. */
function pelota(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot: number,
) {
  const im = img("pelota");
  if (!im) return ball(ctx, x, y, r, rot);
  ctx.save();
  ctx.fillStyle = "rgba(0,10,70,.28)";
  ctx.beginPath();
  ctx.ellipse(x, y + r * 1.05, r * 0.9, r * 0.2, 0, 0, TAU);
  ctx.fill();
  ctx.translate(x, y);
  ctx.rotate(rot);
  drawContain(ctx, im, -r, -r, r * 2, r * 2);
  ctx.restore();
}

/** Escudo chico arriba a la izquierda (como en las piezas de referencia). */
function crestCorner(ctx: CanvasRenderingContext2D, lt: number) {
  const crest = img("escudo");
  const p = prog(lt, 0.1, 0.5);
  if (!crest || p <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp01(p * 2);
  drawContain(ctx, crest, 44, 38 - (1 - outCubic(p)) * 20, 84, 122);
  ctx.restore();
}

/** Foto del cumpleañero (o su edad) dentro de un círculo con aro blanco y dorado. */
function photoCircle(
  ctx: CanvasRenderingContext2D,
  c: TemplateContent,
  cx: number,
  cy: number,
  r: number,
  p: number,
) {
  if (p <= 0) return;
  ctx.save();
  ctx.translate(cx, cy);
  const s = Math.max(0.01, outBack(p));
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  glow(ctx, cx, cy, r * 1.7, "rgba(46,196,255,.5)");
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(cx, cy, r + r * 0.1, 0, TAU);
  ctx.fill();
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, GOLD_L);
  g.addColorStop(0.5, GOLD);
  g.addColorStop(1, GOLD_D);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r + r * 0.04, 0, TAU);
  ctx.fill();
  ctx.fillStyle = ROYAL_D;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  drawPhotoIn(ctx, c.photo, "circle", cx, cy, r, () => {
    const txt = String(c.age);
    const fs = fitSize(ctx, txt, f900, r * 1.5, r * 1.9);
    drawText(ctx, txt, cx, cy + fs * 0.34, {
      font: f900,
      size: fs,
      fill: WHITE,
      shadow: CYAN_D,
      shadowDy: fs * 0.04,
    });
    drawText(ctx, "AÑOS", cx, cy + fs * 0.34 + r * 0.33, {
      font: f800,
      size: r * 0.24,
      fill: GOLD_L,
      spacing: 4,
    });
  });
  ctx.restore();
}

/** Entra desde un costado/abajo con un fundido y se acomoda. */
function enter(
  ctx: CanvasRenderingContext2D,
  lt: number,
  start: number,
  from: "left" | "right" | "bottom" | "none",
  draw: () => void,
) {
  const p = prog(lt, start, 0.7);
  if (p <= 0) return;
  const e = outCubic(p);
  ctx.save();
  ctx.globalAlpha *= clamp01(p * 2);
  ctx.translate(
    from === "left" ? -(1 - e) * 420 : from === "right" ? (1 - e) * 420 : 0,
    from === "bottom" ? (1 - e) * 360 : 0,
  );
  draw();
  ctx.restore();
}

// ---------------------------------------------------------------- bloques

/** "CUMPLE 5": la palabra en cian y la edad en blanco (y, si hay, un resto en cian: " · NOMBRE"). */
function cumpleSlide(
  ctx: CanvasRenderingContext2D,
  age: number,
  rest: string,
  x: number,
  y: number,
  size: number,
  lt: number,
  start: number,
  font = f900,
) {
  ctx.save();
  ctx.font = font(size);
  const w1 = ctx.measureText("CUMPLE ").width;
  const w2 = ctx.measureText(String(age)).width;
  ctx.restore();
  slide(ctx, "CUMPLE", x, y, size, lt, start, CYAN, { font });
  slide(ctx, String(age), x + w1, y, size, lt, start, WHITE, { font });
  if (rest) slide(ctx, rest, x + w1 + w2, y, size, lt, start, CYAN, { font });
}

/** 1. Presentación: título, panel dorado con el equipo, texto vertical y cápsula con la invitación. */
function sceneIntro(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  royalBg(ctx);
  crestCorner(ctx, lt);
  const nm = c.name.toLocaleUpperCase("es");
  slide(ctx, nm, 56, 266, fitSize(ctx, nm, f900, 600, 96), lt, 0.2, WHITE);
  cumpleSlide(ctx, c.age, "", 56, 346, 72, lt, 0.45);
  slide(ctx, "FIESTA DE CAMPEONES", 58, 392, 24, lt, 0.7, "#cfe0ff", {
    font: f700,
    spacing: 1.5,
  });

  // panel dorado: aparece y detrás sale el equipo, que lo desborda por arriba (como la referencia)
  const fp = prog(lt, 0.35, 0.6);
  if (fp > 0) {
    ctx.save();
    ctx.globalAlpha *= clamp01(fp * 2);
    ctx.translate(0, (1 - outCubic(fp)) * 60);
    foil(ctx, 100, 560, 520, 520);
    ctx.restore();
  }
  const team = img("equipo");
  if (team)
    enter(ctx, lt, 0.6, "bottom", () =>
      drawContain(ctx, team, 55, 360, 680, 750, "bottom"),
    );
  else photoCircle(ctx, c, W / 2, 760, 200, prog(lt, 0.6, 0.7));

  vertical(ctx, "CAMPEONES", 672, 820, 58, lt, 1.0, GOLD_L);
  // cápsula con la invitación
  const e = pill(ctx, W / 2, 1180, 620, 96, WHITE, lt, 1.5);
  if (e > 0) {
    ctx.save();
    ctx.globalAlpha *= clamp01(e * 2);
    const s = fitSize(ctx, "¡Y TE INVITA A CELEBRAR!", f900, 540, 44);
    drawText(
      ctx,
      "¡Y TE INVITA A CELEBRAR!",
      W / 2,
      1180 + s * 0.35 + (1 - e) * 90,
      { font: f900, size: s, fill: NAVY, align: "center", spacing: 0.5 },
    );
    ctx.restore();
  }
}

/** 2. "Estás convocado": rayos de sol, Dibu y la fecha. */
function sceneConvocado(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  iceBg(ctx);
  crestCorner(ctx, lt);
  // sol detrás del Dibu
  const sp = prog(lt, 0.4, 0.9);
  if (sp > 0)
    sunRays(
      ctx,
      520,
      1000,
      90 * outCubic(sp),
      120 + 330 * outCubic(sp),
      lt,
      0.95 * sp,
    );
  slide(ctx, "TE", 56, 330, 120, lt, 0.1, BLUE, { from: "left" });
  const cv = fitSize(ctx, "CONVOCAMOS", f900, 620, 130);
  slide(ctx, "CONVOCAMOS", 56, 330 + cv * 0.98, cv, lt, 0.35, BLUE, {
    from: "right",
  });
  slide(
    ctx,
    c.weekday.toLocaleUpperCase("es"),
    58,
    330 + cv * 0.98 + 80,
    56,
    lt,
    0.8,
    GOLD_D,
    { from: "left", spacing: 4, font: f800 },
  );
  const date = `${c.day}/${c.monthName.slice(0, 3).toLocaleUpperCase("es")}`;
  const ds = fitSize(ctx, date, f900, 560, 230);
  pop(ctx, date, 52, 330 + cv * 0.98 + 80 + ds * 0.9, ds, lt, 1.2, NAVY);
  slide(
    ctx,
    `${c.year}`,
    58,
    330 + cv * 0.98 + 80 + ds * 0.9 + 52,
    36,
    lt,
    1.6,
    CYAN_D,
    { font: f800, spacing: 5 },
  );
  const dibu = img("dibu");
  if (dibu)
    enter(ctx, lt, 1.6, "right", () =>
      drawContain(ctx, dibu, 360, 780, 380, 500, "bottom"),
    );
  const bp = prog(lt, 0.6, 1.4);
  // rueda desde la derecha: gira en proporción a lo que avanza
  const bx = lerp(W + 140, 130, outCubic(bp));
  pelota(ctx, bx, 1160, 74, ((bx - 130) / (2 * Math.PI * 74)) * TAU);
}

/** 3. La hora, con el jugador sobre un panel dorado. */
function sceneHora(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  royalBg(ctx);
  crestCorner(ctx, lt);
  slide(ctx, "A LAS", 56, 330, 120, lt, 0.2, WHITE, { from: "up" });
  const time = c.time.toLocaleUpperCase("es");
  const ts = fitSize(ctx, time, f900, 640, 210);
  pop(ctx, time, 52, 330 + ts * 0.95, ts, lt, 0.6, WHITE, { shadow: ROYAL_D });
  const lp = outCubic(prog(lt, 1.3, 0.6));
  ctx.fillStyle = GOLD;
  ctx.fillRect(58, 330 + ts + 30, 460 * lp, 8);
  slide(ctx, "¡PUNTUALES, CAMPEONES!", 58, 330 + ts + 104, 40, lt, 1.6, CYAN, {
    from: "right",
    font: f800,
    spacing: 1,
  });
  const fp = prog(lt, 0.7, 0.6);
  if (fp > 0) {
    ctx.save();
    ctx.globalAlpha *= clamp01(fp * 2);
    ctx.translate(0, (1 - outCubic(fp)) * 60);
    foil(ctx, 100, 800, 500, 340);
    ctx.restore();
  }
  const action = img("accion");
  if (action)
    enter(ctx, lt, 0.9, "left", () =>
      drawContain(ctx, action, 40, 700, 640, 560, "bottom"),
    );
  else {
    const bp = prog(lt, 0.4, 2.6);
    if (bp > 0 && bp < 1)
      pelota(
        ctx,
        lerp(-100, W + 100, bp),
        1090 - Math.sin(bp * Math.PI) * 250,
        70,
        bp * 20,
      );
  }
  vertical(ctx, "CAMPEONES", 672, 960, 50, lt, 1.2, GOLD_L);
}

/** 4. El lugar: la foto del cumpleañero, una cápsula azul con el lugar y los hinchas abajo. */
function sceneLugar(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  iceBg(ctx);
  photoCircle(ctx, c, W / 2, 230, 140, prog(lt, 0.1, 0.8));
  slide(ctx, "TE ESPERO EN", W / 2, 470, 32, lt, 0.5, CYAN_D, {
    align: "center",
    font: f800,
    spacing: 2.5,
    from: "down",
  });
  // una sola línea si entra; si no, dos con el mismo tamaño. La cápsula se ajusta al texto y lo deja centrado
  const venue = c.venue.toLocaleUpperCase("es");
  const v1 = fitSize(ctx, venue, f900, 530, 100, 30);
  // en una línea mientras se lea cómodo; si quedaría muy chico, en dos con tamaño grande
  const vfit =
    v1 >= 56
      ? { lines: [[venue]], size: v1 }
      : uniformRows(ctx, [{ text: venue }], f900, 530, 90, 30, () => true);
  const vlines = vfit.lines[0];
  const vs = vfit.size;
  const lh = vs * 1.05;
  const ph = vlines.length * lh + 2 * Math.max(34, vs * 0.5);
  const cy = 590;
  const grad = ctx.createLinearGradient(0, cy - ph / 2, 0, cy + ph / 2);
  grad.addColorStop(0, "#2a68f0");
  grad.addColorStop(1, ROYAL);
  const e = pill(ctx, W / 2, cy, 640, ph, grad, lt, 0.8);
  if (e > 0) {
    ctx.save();
    ctx.globalAlpha *= clamp01(e * 2);
    vlines.forEach((l, j) =>
      drawText(
        ctx,
        l,
        W / 2,
        cy + (j - (vlines.length - 1) / 2) * lh + vs * 0.36 + (1 - e) * 90,
        {
          font: f900,
          size: vs,
          fill: WHITE,
          align: "center",
        },
      ),
    );
    ctx.restore();
  }
  const addr = c.address.toLocaleUpperCase("es");
  const a1 = fitSize(ctx, addr, f800, 590, 34, 18);
  const afit =
    a1 >= 26
      ? { lines: [[addr]], size: a1 }
      : uniformRows(ctx, [{ text: addr }], f800, 590, 34, 18, () => true);
  const ay = cy + ph / 2 + 46;
  afit.lines[0].forEach((l, j) =>
    slide(ctx, l, W / 2, ay + j * afit.size * 1.15, afit.size, lt, 1.4, NAVY, {
      align: "center",
      font: f800,
      spacing: 0.5,
      from: "right",
    }),
  );
  const fans = img("hinchas");
  if (fans)
    enter(ctx, lt, 0.8, "bottom", () =>
      drawCover(ctx, fans, 0, 800, W, 480, 0),
    );
  confetti(ctx, lt, {
    count: 26,
    colors: [CYAN, WHITE, GOLD, BLUE],
    seed: 21,
    speed: 0.9,
  });
}

/** 5. Cierre nocturno. */
function sceneCierre(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  nightBg(ctx);
  const night = img("noche");
  if (night)
    enter(ctx, lt, 0.2, "bottom", () =>
      drawCover(ctx, night, 0, 720, W, 560, 0),
    );
  crestCorner(ctx, lt);
  slide(ctx, "UNA FIESTA PARA", W / 2, 320, 62, lt, 0.1, WHITE, {
    align: "center",
    font: f800,
    spacing: 2,
    from: "left",
  });
  const cs = fitSize(ctx, "CAMPEONES", f900, 650, 150);
  const cp = prog(lt, 0.5, 0.6);
  if (cp > 0) {
    ctx.save();
    ctx.translate(W / 2, 320 + cs * 0.95);
    const s = Math.max(0.01, outBack(cp));
    ctx.scale(s, s);
    drawText(ctx, "CAMPEONES", 0, 0, {
      font: f900,
      size: cs,
      fill: CYAN,
      align: "center",
      glow: "rgba(46,196,255,.7)",
      glowBlur: 30,
    });
    ctx.restore();
  }
  slide(
    ctx,
    "¡TE ESPERAMOS!",
    W / 2,
    320 + cs * 0.95 + 110,
    fitSize(ctx, "¡TE ESPERAMOS!", f900, 620, 100),
    lt,
    1.1,
    WHITE,
    { align: "center", from: "right" },
  );
  const nm = c.name.toLocaleUpperCase("es");
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, GOLD_D);
  g.addColorStop(0.5, GOLD_L);
  g.addColorStop(1, GOLD_D);
  const e = pill(ctx, W / 2, 320 + cs * 0.95 + 230, 460, 84, g, lt, 1.8);
  if (e > 0) {
    ctx.save();
    ctx.globalAlpha *= clamp01(e * 2);
    const ns = fitSize(ctx, nm, f900, 400, 56, 24);
    drawText(ctx, nm, W / 2, 320 + cs * 0.95 + 230 + ns * 0.35 + (1 - e) * 90, {
      font: f900,
      size: ns,
      fill: NAVY,
      align: "center",
      spacing: 1,
    });
    ctx.restore();
  }
  if (!night) {
    for (let i = 0; i < 3; i++) {
      const p = prog(lt, 2.2 + i * 0.2, 0.5);
      if (p > 0)
        star(ctx, W / 2 + (i - 1) * 110, 1040, 46 * Math.max(0.01, outBack(p)));
    }
  }
  confetti(ctx, lt, {
    count: 44,
    colors: [CYAN, WHITE, GOLD, BLUE],
    seed: 8,
    speed: 1.1,
  });
  twinkles(ctx, lt, 8, [WHITE, GOLD], { seed: 70, y0: 60, y1: 700, maxR: 20 });
}

/** 6. Resumen final: fecha, horario y lugar juntos. Es la última pantalla y se queda unos segundos para que se pueda leer y anotar. */
function sceneResumen(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  royalBg(ctx);
  crestCorner(ctx, lt);
  slide(
    ctx,
    "ANOTÁ LA FECHA",
    56,
    256,
    fitSize(ctx, "ANOTÁ LA FECHA", f900, 600, 86),
    lt,
    0.1,
    WHITE,
  );
  const nm = c.name.toLocaleUpperCase("es");
  cumpleSlide(ctx, c.age, ` · ${nm}`, 58, 316, 44, lt, 0.35, f800);
  const rows = [
    {
      label: "FECHA",
      value: dateLine(c).toLocaleUpperCase("es"),
      hint: dateParts(c).map((x) => x.toLocaleUpperCase("es")),
      at: 0.6,
    },
    { label: "HORARIO", value: c.time.toLocaleUpperCase("es"), at: 1.1 },
    { label: "LUGAR", value: c.venue.toLocaleUpperCase("es"), at: 1.6 },
    { label: "DIRECCIÓN", value: c.address.toLocaleUpperCase("es"), at: 2.1 },
  ];
  // un único tamaño para todos los datos; solo se pasa a dos líneas lo que no entra en una
  const { size: vs, lines: rlines } = uniformRows(
    ctx,
    rows.map((r) => ({ text: r.value, hint: r.hint })),
    f900,
    545,
    66,
    24,
    (sz, ls) =>
      450 + ls.reduce((a, l) => a + 92 + 0.35 * sz + sz * l.length, 0) <= 1219,
  );
  let y = 450;
  rows.forEach((r, i) => {
    const p = prog(lt, r.at, 0.55);
    const lines = rlines[i];
    if (p > 0) {
      ctx.save();
      ctx.globalAlpha *= clamp01(p * 2.5);
      ctx.translate(-(1 - outCubic(p)) * 380, 0);
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(70, y - 5, 7, 0, TAU);
      ctx.fill();
      drawText(ctx, r.label, 96, y, {
        font: f800,
        size: 26,
        fill: GOLD_L,
        align: "left",
        spacing: 2,
      });
      lines.forEach((l, j) =>
        drawText(ctx, l, 56, y + 14 + vs * 0.9 + j * vs, {
          font: f900,
          size: vs,
          fill: WHITE,
          align: "left",
        }),
      );
      const lp = outCubic(prog(lt, r.at + 0.3, 0.6));
      ctx.fillStyle = CYAN;
      ctx.fillRect(56, y + 34 + vs * lines.length, 560 * lp, 3);
      ctx.restore();
    }
    y += 92 + 0.35 * vs + vs * lines.length;
  });
  vertical(ctx, "CAMPEONES", 672, 800, 52, lt, 1.0, GOLD_L);
  // la pelota rueda lentamente abajo
  const bp = prog(lt, 1.2, 0.9);
  if (bp > 0) {
    ctx.save();
    ctx.globalAlpha *= clamp01(bp * 2);
    pelota(ctx, 600 - (1 - outCubic(bp)) * 120, 1180, 62, lt * 1.2);
    ctx.restore();
  }
}

/** Barrido en diagonal que tapa el corte entre bloques. */
function swoosh(ctx: CanvasRenderingContext2D, t: number, cut: number) {
  const p = prog(t, cut - 0.28, 0.56);
  if (p <= 0 || p >= 1) return;
  const x = lerp(-W * 1.5, W * 1.5, p);
  ctx.save();
  ctx.translate(x, 0);
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 520, -10);
  ctx.lineTo(W / 2 - 400, -10);
  ctx.lineTo(W / 2 - 700, H + 10);
  ctx.lineTo(W / 2 - 820, H + 10);
  ctx.fill();
  ctx.fillStyle = ROYAL;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 410, -10);
  ctx.lineTo(W / 2 + 530, -10);
  ctx.lineTo(W / 2 + 230, H + 10);
  ctx.lineTo(W / 2 - 710, H + 10);
  ctx.fill();
  ctx.fillStyle = CYAN;
  ctx.beginPath();
  ctx.moveTo(W / 2 + 540, -10);
  ctx.lineTo(W / 2 + 600, -10);
  ctx.lineTo(W / 2 + 300, H + 10);
  ctx.lineTo(W / 2 + 240, H + 10);
  ctx.fill();
  ctx.restore();
}

const SCENES = [
  sceneIntro,
  sceneConvocado,
  sceneHora,
  sceneLugar,
  sceneCierre,
  sceneResumen,
];

function draw(
  ctx: CanvasRenderingContext2D,
  f: { t: number; content: TemplateContent },
) {
  const { t, content: c } = f;
  let i = 0;
  while (i < SCENES.length - 1 && t >= CUTS[i + 1]) i++;
  SCENES[i](ctx, t - CUTS[i], c);
  for (let k = 1; k < SCENES.length; k++) swoosh(ctx, t, CUTS[k]);
  // entrada: desde blanco
  const fin = 1 - prog(t, 0, 0.3);
  if (fin > 0) {
    ctx.fillStyle = `rgba(255,255,255,${fin})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Imagen 1080×1920: el azul rey con el panel dorado del equipo, nombre y edad grandes, y los datos con las líneas cian. */
function poster(ctx: CanvasRenderingContext2D, c: TemplateContent) {
  const lt = 10; // todo ya entró
  royalBg(ctx);
  crestCorner(ctx, lt);
  const nm = c.name.toLocaleUpperCase("es");
  slide(ctx, nm, 140, 148, fitSize(ctx, nm, f900, 540, 92), lt, 0, WHITE);
  cumpleSlide(ctx, c.age, "", 142, 228, 74, lt, 0);
  if (c.photo) {
    // foto del cumpleañero en el círculo dorado y la pelota al costado
    photoCircle(ctx, c, W / 2, 540, 185, 1);
    // Messi con la copa a la izquierda, besándola, y la pelota al costado
    const messi = img("messi-copa");
    if (messi) drawContain(ctx, messi, -6, 590, 300, 260, "bottom");
    pelota(ctx, 590, 700, 58, 0.6);
  } else {
    foil(ctx, 110, 480, 500, 360);
    const team = img("equipo");
    // el equipo queda entre el encabezado y los datos, sin pisarlos
    if (team) drawContain(ctx, team, 20, 300, 680, 540, "bottom");
    else photoCircle(ctx, c, W / 2, 600, 190, 1);
  }
  slide(ctx, "FIESTA DE CAMPEONES", 142, 272, 22, lt, 0, "#cfe0ff", {
    font: f700,
    spacing: 1.5,
  });
  const rows = [
    {
      label: "FECHA",
      value: dateLine(c).toLocaleUpperCase("es"),
      hint: dateParts(c).map((x) => x.toLocaleUpperCase("es")),
    },
    { label: "HORARIO", value: c.time.toLocaleUpperCase("es") },
    { label: "LUGAR", value: c.venue.toLocaleUpperCase("es") },
    { label: "DIRECCIÓN", value: c.address.toLocaleUpperCase("es") },
  ];
  // un único tamaño para todos los datos; solo se pasa a dos líneas lo que no entra en una
  const { size: vs, lines: plines } = uniformRows(
    ctx,
    rows.map((r) => ({ text: r.value, hint: r.hint })),
    f900,
    575,
    46,
    22,
    (sz, ls) => 880 + ls.reduce((a, l) => a + 54 + sz * l.length, 0) <= 1290,
  );
  let y = 880;
  rows.forEach((r, i) => {
    const lines = plines[i];
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(70, y - 7, 7, 0, TAU);
    ctx.fill();
    drawText(ctx, r.label, 96, y, {
      font: f800,
      size: 24,
      fill: GOLD_L,
      align: "left",
      spacing: 2,
    });
    lines.forEach((l, j) =>
      drawText(ctx, l, 56, y + 8 + vs * 0.92 + j * vs, {
        font: f900,
        size: vs,
        fill: WHITE,
        align: "left",
      }),
    );
    ctx.fillStyle = CYAN;
    ctx.fillRect(56, y + 24 + vs * lines.length, 560, 3);
    y += 54 + vs * lines.length;
  });
}

/** Estilo de las imágenes de Mercado Libre: el fondo azul rey con franjas y marco cian, y las letras blancas y doradas. */
const mlStyle: MlStyle = {
  background: royalBg,
  window: { datos: 560, pasos: 300 },
  characters: ["messi-copa"],
  charFlip: [true],
  charHeight: 540,
  charX: 540,
  decor: ["escudo"],
  font: f900,
  title: (ctx, lines, cx, y, maxW) => {
    const s = Math.min(
      ...lines.map((l) => fitSize(ctx, l, f900, maxW, 140, 36)),
    );
    lines.forEach((l, i) => {
      const b = y + s * (0.92 + i * 1.02);
      drawText(ctx, l, cx, b, {
        font: f900,
        size: s,
        fill: i ? CYAN : WHITE,
        shadow: NAVY,
        shadowDy: s * 0.06,
        spacing: 0.5,
      });
    });
    return y + s * (0.92 + (lines.length - 1) * 1.02);
  },
  heading: (ctx, str, x, baseline, size, align) =>
    drawText(ctx, str, x, baseline, {
      font: f900,
      size,
      fill: GOLD_L,
      shadow: NAVY,
      shadowDy: size * 0.05,
      align,
      spacing: 0.5,
    }),
  label: (ctx, str, x, baseline, size, align) =>
    drawText(ctx, str, x, baseline, {
      font: f800,
      size,
      fill: WHITE,
      shadow: NAVY,
      shadowDy: size * 0.05,
      align,
      spacing: 0.5,
    }),
  accent: GOLD,
  ink: NAVY,
  panelPasos: { fill: "rgba(6,22,110,.62)", border: GOLD },
  footerPill: true,
};

export const campeones: TemplateDefinition = {
  id: "campeones",
  name: "Fiesta de Campeones",
  description:
    'Azul rey, dorado y blanco con brillo cian: nombre, panel dorado con el equipo, "Estás convocado" con la fecha, la hora, el lugar y un cierre de estadio.',
  category: "Fútbol",
  audience: "juvenil",
  palette: [ROYAL, GOLD, CYAN, WHITE],
  fonts: ["RedHatDisplay"],
  // imágenes en public/templates/campeones/ (se pueden reemplazar; ver el README de esa carpeta)
  assets: [
    "escudo",
    "equipo",
    "dibu",
    "accion",
    "hinchas",
    "noche",
    "pelota",
    "messi-copa",
  ],
  duration: DURATION,
  fps: 24,
  defaultAudioId: "grito-campeon",
  photoRule:
    "La foto va en un círculo con aro dorado en el bloque del lugar; sin foto, se muestra la edad en grande.",
  thumbnailTime: 1.9,
  draw,
  poster,
  ml: mlStyle,
};
