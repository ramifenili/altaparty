// Plantilla "Sonic": velocidad, anillos dorados y destellos azules.
// Tres bloques: introducción con rayas de velocidad y Sonic cruzando la pantalla (de izquierda a derecha y, después,
// desde abajo a la inversa), nombre y edad (con la foto opcional dentro de un anillo) y, al final, la tarjeta de datos
// (fecha, horario y lugar) con el cierre "¡NO TE LO PIERDAS!", que se queda unos segundos en pantalla.
// Sonic (dos imágenes), Tails, Knuckles y el anillo son imágenes separadas en public/templates/sonic/, cada una con su
// propia animación, y se pueden reemplazar; si falta alguna, se dibuja una alternativa sencilla o no aparece.
// Titulares con la tipografía High Speed (public/fonts/HighSpeed.ttf) y, para las letras que no tenga, Racing Sans One.
// Sin voces: el relato lo llevan los textos animados, los destellos y la música.
// Todo es función pura de `t`: cualquier instante se puede dibujar fuera de orden.

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
  twinkles,
  splitLong,
  fitStack,
  fitStackTwo,
  dateLine,
  dateParts,
  uniformRows,
  isMultiLine,
  roundRectPath,
} from "./kit";
import { tplImage, drawContain, drawCover } from "./assets";

const BLUE = "#1f6bff";
const ICE = "#bfe6ff";
const CYAN = "#46d5ff";
const RED = "#ff2b3a";
const GOLD = "#ffc21a";
const GOLD_L = "#fff3a0";
const NAVY = "#06103a";
const WHITE = "#ffffff";
// titulares: High Speed (archivo del usuario) con Racing Sans One de respaldo; datos: Red Hat Display, limpia y legible en el celular
const racing = (s: number) =>
  `${s}px HighSpeed, RacingSansOne, Impact, sans-serif`;

const ID = "sonic";
const pic = (name: string, t?: number) => tplImage(ID, name, t);

// límites de cada bloque (segundos)
// el último bloque (datos + cierre) queda unos segundos quieto con toda la información a la vista
const CUTS = [0, 5.8, 11.2, 22.2] as const;
const DURATION = CUTS[CUTS.length - 1];
// color del destello que tapa cada corte
const CUT_FLASH = ["", "#cfeaff", "#ffffff"];

// ---------------------------------------------------------------- dibujos básicos

function bg(ctx: CanvasRenderingContext2D, kind: "blue" | "red") {
  staticLayer(ctx, `sonic-bg-${kind}`, (c) => {
    const red = kind === "red";
    c.fillStyle = vGradient(
      c,
      0,
      H,
      red
        ? [
            [0, "#050001"],
            [0.5, "#220306"],
            [1, "#040001"],
          ]
        : [
            [0, "#02030d"],
            [0.5, "#08155a"],
            [1, "#020512"],
          ],
    );
    c.fillRect(0, 0, W, H);
    glow(
      c,
      W / 2,
      H * 0.48,
      620,
      red ? "rgba(255,40,50,.32)" : "rgba(40,110,255,.4)",
    );
    const v = c.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 900);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.6)");
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);
  });
}

/** Fondo opcional (`fondo.mp4`, `fondo.webm` o `fondo.gif`): reemplaza el degradado, con un velo oscuro para que se lea el texto. */
function videoBg(ctx: CanvasRenderingContext2D, lt: number) {
  const v = pic("fondo", lt);
  if (!v) return;
  drawCover(ctx, v, 0, 0, W, H, 0.5);
  ctx.fillStyle = "rgba(2,6,30,.45)";
  ctx.fillRect(0, 0, W, H);
}

/** Rayas de velocidad que cruzan la pantalla en diagonal. `rgb` = "r,g,b". */
function streaks(
  ctx: CanvasRenderingContext2D,
  t: number,
  o: {
    rgb: string;
    count: number;
    seed: number;
    angle: number;
    speed: number;
    len?: number;
    w?: number;
  },
) {
  const dx = Math.cos(o.angle);
  const dy = Math.sin(o.angle);
  const L = 1900;
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < o.count; i++) {
    const sd = o.seed + i;
    const len = (o.len ?? 260) * (0.5 + hash(sd, 1));
    const sp = o.speed * (0.6 + hash(sd, 2) * 0.9);
    const a = ((hash(sd, 3) * L + t * sp) % (L + len)) - L / 2;
    const q = (hash(sd, 4) - 0.5) * 1500;
    const hx = W / 2 + dx * a - dy * q;
    const hy = H / 2 + dy * a + dx * q;
    const g = ctx.createLinearGradient(hx - dx * len, hy - dy * len, hx, hy);
    g.addColorStop(0, `rgba(${o.rgb},0)`);
    g.addColorStop(1, `rgba(${o.rgb},${0.3 + hash(sd, 6) * 0.7})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = (o.w ?? 3) * (0.5 + hash(sd, 5));
    ctx.beginPath();
    ctx.moveTo(hx - dx * len, hy - dy * len);
    ctx.lineTo(hx, hy);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Anillo dorado que gira sobre su eje vertical (usa `anillo.gif`/`anillo.png` si existe). Cada uno gira a su propio
 * ritmo (`speed`, entre 0,75 y 1,35 veces) y con otra fase (`ph`, en segundos), así nunca van al compás ni quedan
 * clavados en un mismo cuadro; `tilt` lo inclina (radianes).
 */
function ring(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  t: number,
  ph = 0,
  tilt = 0,
  speed = 1,
) {
  const im = pic("anillo", t * speed + ph);
  glow(ctx, x, y, r * 1.7, "rgba(255,196,40,.32)");
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  if (im) drawContain(ctx, im, -r, -r, r * 2, r * 2);
  else {
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, GOLD_L);
    g.addColorStop(0.45, GOLD);
    g.addColorStop(1, "#a85d00");
    ctx.strokeStyle = g;
    ctx.lineWidth = r * 0.36;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.6)";
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.93, -2.4, -1.1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Anillos de los bordes: tamaño (apenas distinto entre sí), inclinación, ritmo de giro y fase de cada uno. */
const RING_SPOTS = [
  // x, y, tamaño, inclinación, ritmo, fase
  [58, 78, 1, -0.3, 1, 0],
  [W - 54, 118, 0.94, 0.35, 1.27, 0.31],
  [66, H - 178, 1.06, 0.2, 0.82, 0.55],
  [W - 78, H - 116, 0.97, -0.4, 1.12, 0.17],
  [32, 400, 0.9, 0.45, 1.33, 0.62],
  [W - 38, 640, 1.03, -0.3, 0.78, 0.23],
  [46, 880, 0.95, -0.12, 1.08, 0.41],
  [W - 46, 960, 0.91, 0.38, 0.93, 0.7],
] as const;

/** Los anillos de los bordes (los cuatro de las esquinas y cuatro más repartidos), que aparecen con rebote. */
function cornerRings(
  ctx: CanvasRenderingContext2D,
  lt: number,
  at: number,
  r = 50,
) {
  RING_SPOTS.forEach(([x, y, k, tilt, speed, ph], i) => {
    const p = prog(lt, at + i * 0.1, 0.5);
    if (p <= 0) return;
    ctx.save();
    ctx.translate(x, y + Math.sin(lt * 1.6 + i) * 6);
    const s = Math.max(0.01, outBack(p));
    ctx.scale(s, s);
    ring(ctx, 0, 0, r * k, lt, ph, tilt, speed);
    ctx.restore();
  });
}

/** Marco dorado de la foto: la imagen `aro` (reemplazable) o, si falta, un aro dibujado un poco más grueso que antes. */
function goldFrame(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) {
  const im = pic("aro");
  if (im) {
    // el agujero de `aro.png` mide el 83 % del medio ancho de la imagen; se apoya apenas sobre el borde de la foto
    const half = (r * 0.985) / ARO_HOLE;
    ctx.drawImage(im, cx - half, cy - half, half * 2, half * 2);
    return;
  }
  const lw = r * 0.16;
  const fg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  fg.addColorStop(0, GOLD_L);
  fg.addColorStop(0.5, GOLD);
  fg.addColorStop(1, "#a85d00");
  ctx.save();
  ctx.strokeStyle = fg;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(cx, cy, r + lw / 2 - 2, 0, TAU);
  ctx.stroke();
  ctx.restore();
}
/** Proporción del agujero de `aro.png` respecto del medio ancho de la imagen (anillo de 600 px: agujero de radio 250). */
const ARO_HOLE = 0.834;
/** Radio hasta el que llega el marco (para el arco de energía que lo rodea). */
const frameOuter = (r: number) => r * (0.985 / ARO_HOLE) * 0.97;

/** Parte un texto en líneas: respeta los saltos de línea escritos y, si en una sola línea quedaría más chico que `minSize`, lo reparte en dos. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  str: string,
  font: (s: number) => string,
  maxW: number,
  start: number,
  minSize: number,
): { lines: string[]; size: number } {
  const lines = str
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { lines: [""], size: start };
  const fit = (ls: string[]) =>
    Math.min(...ls.map((l) => fitSize(ctx, l, font, maxW, start, 1)));
  let size = fit(lines);
  // más de 26 caracteres: dos líneas parejas, con el mismo tamaño que tendría una sola
  if (lines.length === 1 && lines[0].length > 26) {
    const sp = splitLong(lines[0]);
    if (sp.length === 2) {
      const sz = Math.min(...sp.map((l) => fitSize(ctx, l, font, maxW, start, 1)));
      return { lines: sp, size: Math.floor(sz) };
    }
  }
  if (lines.length === 1 && size < minSize) {
    const words = lines[0].split(/\s+/);
    let best: string[] | null = null;
    let bestSize = size;
    for (let i = 1; i < words.length; i++) {
      const ls = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
      const sz = fit(ls);
      // a igual tamaño se prefiere cortar después de una coma
      const bonus = ls[0].endsWith(",") ? 0.5 : 0;
      if (sz + bonus > bestSize) {
        best = ls;
        bestSize = sz + bonus;
      }
    }
    if (best) return { lines: best, size: Math.floor(bestSize) };
  }
  return { lines, size: Math.max(14, size) };
}

/** Rayo con vaivén (cambia unas 14 veces por segundo). */
function bolt(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t: number,
  seed: number,
  color: string,
  w = 5,
) {
  const n = 9;
  const f = Math.floor(t * 14);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i < n; i++) {
      const k = i / n;
      ctx.lineTo(
        lerp(x0, x1, k) + (hash(seed * 31 + i + f * 7, 1) - 0.5) * 80,
        lerp(y0, y1, k) + (hash(seed * 31 + i + f * 7, 2) - 0.5) * 80,
      );
    }
    ctx.lineTo(x1, y1);
  };
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  path();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = w * 0.4;
  path();
  ctx.stroke();
  ctx.restore();
}

/** Texto inclinado estilo carrera. */
function sText(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number,
  o: {
    fill?: string | CanvasGradient;
    stroke?: string;
    strokeW?: number;
    glow?: string;
    glowBlur?: number;
    shadow?: string;
    font?: (s: number) => string;
    skew?: number;
    spacing?: number;
    align?: CanvasTextAlign;
  } = {},
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, -(o.skew ?? 0.2), 1, 0, 0);
  drawText(ctx, str, 0, 0, {
    font: o.font ?? racing,
    size,
    fill: o.fill ?? WHITE,
    stroke: o.stroke,
    strokeW: o.strokeW,
    glow: o.glow,
    glowBlur: o.glowBlur,
    shadow: o.shadow,
    spacing: o.spacing,
    align: o.align,
  });
  ctx.restore();
}

/** Entrada veloz desde un costado, con estela. `dx` = distancia desde la que arranca (negativo: viene de la izquierda). */
function dash(
  ctx: CanvasRenderingContext2D,
  lt: number,
  at: number,
  dx: number,
  fn: () => void,
  dur = 0.45,
) {
  const p = prog(lt, at, dur);
  if (p <= 0) return;
  const e = outCubic(p);
  const off = (1 - e) * dx;
  if (p < 1)
    for (let k = 3; k >= 1; k--) {
      ctx.save();
      ctx.globalAlpha *= 0.2 * (1 - p) * (4 - k);
      ctx.translate(off - Math.sign(dx) * k * 46 * (1 - p), 0);
      fn();
      ctx.restore();
    }
  ctx.save();
  ctx.globalAlpha *= clamp01(p * 3);
  ctx.translate(off, 0);
  fn();
  ctx.restore();
}

/** Personaje de reemplazo (silueta de erizo) cuando falta la imagen. (x, y) = centro de la base. */
function fallbackHero(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  body: string,
  accent: string,
) {
  ctx.save();
  ctx.translate(x, y - h / 2);
  ctx.scale(w / 300, h / 400);
  ctx.fillStyle = body;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + 0.35 + i * 0.32;
    ctx.beginPath();
    ctx.moveTo(-10 + Math.cos(a + 1.2) * 70, -95 + Math.sin(a + 1.2) * 70);
    ctx.lineTo(-10 + Math.cos(a - 1.2) * 70, -95 + Math.sin(a - 1.2) * 70);
    ctx.lineTo(-10 + Math.cos(a) * 190, -95 + Math.sin(a) * 190);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(-10 + Math.cos(a) * 150, -95 + Math.sin(a) * 150, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = body;
  }
  ctx.beginPath();
  ctx.ellipse(0, 70, 82, 112, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -90, 92, 0, TAU);
  ctx.fill();
  ctx.fillStyle = WHITE;
  for (const ex of [-30, 30]) {
    ctx.beginPath();
    ctx.ellipse(ex, -96, 22, 28, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = accent;
  for (const ex of [-26, 34]) {
    ctx.beginPath();
    ctx.arc(ex, -92, 11, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

type Hero = "sonic" | "tails" | "knuckles";
const HERO_LOOK: Record<
  Hero,
  { glow: string; body: string; accent: string; ratio: number }
> = {
  sonic: {
    glow: "rgba(40,120,255,.55)",
    body: "#1f5bd8",
    accent: "#2a2a2a",
    ratio: 1.33,
  },
  tails: {
    glow: "rgba(255,170,40,.45)",
    body: "#f0a020",
    accent: "#ffffff",
    ratio: 1.33,
  },
  knuckles: {
    glow: "rgba(255,40,50,.45)",
    body: "#d02030",
    accent: "#ffffff",
    ratio: 1.33,
  },
};

/**
 * Personaje con su propia animación: llega a toda velocidad con estela y después flota. (x, yb) = centro de la base,
 * `w` = ancho; `from` = lado del que llega; `flip` = espejo.
 */
function hero(
  ctx: CanvasRenderingContext2D,
  lt: number,
  at: number,
  kind: Hero,
  x: number,
  yb: number,
  w: number,
  o: {
    from?: "left" | "right";
    flip?: boolean;
    seed?: number;
    optional?: boolean;
  } = {},
) {
  const im = pic(kind, lt);
  if (!im && o.optional) return;
  const look = HERO_LOOK[kind];
  const h = im ? (w * im.height) / im.width : w * look.ratio;
  const dir = o.from === "right" ? 1 : -1;
  const ph = (o.seed ?? 0) * 1.7;
  const bob = Math.sin(lt * 3.1 + ph) * 9 * clamp01((lt - at) / 0.8);
  const draw = () => {
    ctx.save();
    ctx.translate(x, yb + bob);
    glow(ctx, 0, -h * 0.5, w * 0.95, look.glow);
    if (o.flip) ctx.scale(-1, 1);
    if (im) drawContain(ctx, im, -w / 2, -h, w, h, "bottom");
    else fallbackHero(ctx, 0, 0, w, h, look.body, look.accent);
    ctx.restore();
  };
  // rayas de velocidad horizontales detrás mientras llega
  const p = prog(lt, at, 0.5);
  if (p > 0 && p < 1) {
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < 7; i++) {
      const yy = yb - h * (0.15 + 0.7 * hash(i + (o.seed ?? 0), 9));
      const len = 220 + hash(i, 8) * 260;
      const x0 = x + (1 - outCubic(p)) * dir * 900 - dir * 40;
      const g = ctx.createLinearGradient(x0, 0, x0 - dir * len, 0);
      g.addColorStop(0, look.glow.replace(/[\d.]+\)$/, "0.9)"));
      g.addColorStop(1, look.glow.replace(/[\d.]+\)$/, "0)"));
      ctx.strokeStyle = g;
      ctx.lineWidth = 3 + hash(i, 7) * 5;
      ctx.beginPath();
      ctx.moveTo(x0, yy);
      ctx.lineTo(x0 - dir * len, yy);
      ctx.stroke();
    }
    ctx.restore();
  }
  dash(ctx, lt, at, dir * 900, draw, 0.5);
}

/** Destello de pantalla completa. */
function flashFx(ctx: CanvasRenderingContext2D, a: number, color: string) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp01(a);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

const goldFill = (ctx: CanvasRenderingContext2D, y: number, size: number) =>
  vGradient(ctx, y - size * 0.85, y, [
    [0, GOLD_L],
    [0.5, GOLD],
    [1, "#e07b00"],
  ]);
const iceFill = (ctx: CanvasRenderingContext2D, y: number, size: number) =>
  vGradient(ctx, y - size * 0.85, y, [
    [0, WHITE],
    [1, ICE],
  ]);

// ---------------------------------------------------------------- bloques

/** Sonic corriendo (`sonic-corre.png`, mira a la derecha): cruza la pantalla con estela; `dir` -1 = de derecha a izquierda, espejado. */
function runPass(
  ctx: CanvasRenderingContext2D,
  lt: number,
  at: number,
  dur: number,
  o: { y0: number; y1: number; dir: 1 | -1; w: number },
) {
  const p = prog(lt, at, dur);
  if (p <= 0 || p >= 1) return;
  const im = pic("sonic-corre", lt);
  const w = o.w;
  const h = im ? (w * im.height) / im.width : w * 1.2;
  const x = o.dir > 0 ? lerp(-w, W + w, p) : lerp(W + w, -w, p);
  const y = lerp(o.y0, o.y1, p);
  ctx.save();
  const g = ctx.createLinearGradient(x, 0, x - o.dir * 760, 0);
  g.addColorStop(0, "rgba(120,200,255,.9)");
  g.addColorStop(1, "rgba(60,140,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(Math.min(x, x - o.dir * 760), y - 8, 760, 16);
  ctx.restore();
  for (let k = 4; k >= 0; k--) {
    ctx.save();
    ctx.globalAlpha *= k === 0 ? 1 : 0.14;
    ctx.translate(x - o.dir * k * 64, y);
    if (o.dir < 0) ctx.scale(-1, 1);
    glow(ctx, 0, 0, w * 0.8, "rgba(60,140,255,.4)");
    if (im) drawContain(ctx, im, -w / 2, -h / 2, w, h);
    else
      fallbackHero(
        ctx,
        0,
        h / 2,
        w,
        h,
        HERO_LOOK.sonic.body,
        HERO_LOOK.sonic.accent,
      );
    ctx.restore();
  }
}

/** 1. Introducción: rayas de velocidad, anillos y Sonic cruzando la pantalla dos veces. */
function sceneIntro(ctx: CanvasRenderingContext2D, lt: number) {
  bg(ctx, "blue");
  videoBg(ctx, lt);
  streaks(ctx, lt, {
    rgb: "90,170,255",
    count: 26,
    seed: 3,
    angle: -0.95,
    speed: 760,
    len: 320,
  });
  twinkles(ctx, lt, 16, [CYAN, WHITE], { seed: 5 });
  cornerRings(ctx, lt, 0.15);
  const lines = ["ES UN HONOR", "INVITARLOS AL", "CUMPLEAÑOS DE"];
  const fade = 1 - prog(lt, 2.3, 0.35);
  ctx.save();
  ctx.globalAlpha *= fade;
  lines.forEach((s, i) => {
    const y = 560 + i * 118;
    const size = fitSize(ctx, s, racing, 600, 92);
    dash(
      ctx,
      lt,
      0.5 + i * 0.5,
      i % 2 ? 800 : -800,
      () =>
        sText(ctx, s, W / 2, y, size, {
          fill: iceFill(ctx, y, size),
          stroke: NAVY,
          strokeW: size * 0.1,
          glow: BLUE,
          glowBlur: 22,
        }),
      0.5,
    );
  });
  ctx.restore();
  // primero de izquierda (desde afuera) a derecha (hasta afuera); después, más lento, desde abajo y espejado
  runPass(ctx, lt, 2.3, 1.5, { y0: 600, y1: 520, dir: 1, w: 400 });
  runPass(ctx, lt, 3.7, 1.9, { y0: 1080, y1: 860, dir: -1, w: 400 });
}

/** 3. Nombre y edad; con foto va en un círculo de energía azul y roja. */
function sceneName(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  bg(ctx, "blue");
  videoBg(ctx, lt);
  streaks(ctx, lt, {
    rgb: "90,170,255",
    count: 18,
    seed: 70,
    angle: -0.95,
    speed: 520,
    len: 280,
  });
  twinkles(ctx, lt, 14, [CYAN, WHITE], { seed: 9 });
  cornerRings(ctx, lt, 0.1, 44);
  const h1 = "¡FELIZ CUMPLEAÑOS!";
  const s1 = fitSize(ctx, h1, racing, 600, 54);
  dash(
    ctx,
    lt,
    0.15,
    -700,
    () =>
      sText(ctx, h1, W / 2, 175, s1, {
        fill: CYAN,
        stroke: NAVY,
        strokeW: s1 * 0.12,
        glow: BLUE,
        glowBlur: 16,
      }),
    0.45,
  );
  const nm = c.name.toLocaleUpperCase("es");
  const ns = fitSize(ctx, nm, racing, 650, 176);
  const ny = 340;
  dash(
    ctx,
    lt,
    0.5,
    800,
    () =>
      sText(ctx, nm, W / 2, ny, ns, {
        fill: iceFill(ctx, ny, ns),
        stroke: "#0a2a9a",
        strokeW: ns * 0.1,
        glow: BLUE,
        glowBlur: 30,
        shadow: "#04124a",
        spacing: 1,
      }),
    0.55,
  );
  // "CUMPLE 8 AÑOS" en una sola línea, con la edad en dorado y justo en el centro
  const ap = prog(lt, 1.1, 0.6);
  if (ap > 0) {
    const ageStr = String(c.age);
    const as = 150;
    const g = cumpleGeom(ctx, ageStr, as, 54);
    ctx.save();
    ctx.translate(W / 2, 480);
    ctx.scale(g.fit, g.fit);
    ctx.globalAlpha *= clamp01(ap * 2);
    sText(ctx, "CUMPLE", g.xC, g.yW, 54, {
      fill: ICE,
      stroke: NAVY,
      strokeW: 7,
      glow: BLUE,
      align: "center",
    });
    ctx.save();
    ctx.translate(g.xN, 0);
    const sc = Math.max(0.01, outBack(ap));
    ctx.scale(sc, sc);
    sText(ctx, ageStr, 0, 0, as, {
      fill: goldFill(ctx, 0, as),
      stroke: "#7a3b00",
      strokeW: as * 0.07,
      glow: "rgba(255,190,40,.9)",
      glowBlur: 26,
    });
    ctx.restore();
    sText(ctx, "AÑOS", g.xA, g.yW, 54, {
      fill: ICE,
      stroke: NAVY,
      strokeW: 7,
      glow: BLUE,
      align: "center",
    });
    ctx.restore();
  }
  if (c.photo) {
    // foto en un círculo con arcos de energía azul y roja que giran
    const cx = W / 2;
    const cy = 850;
    const r = 205;
    const pp = prog(lt, 1.5, 0.7);
    if (pp > 0) {
      ctx.save();
      ctx.translate(cx, cy);
      const s = Math.max(0.01, outBack(pp));
      ctx.scale(s, s);
      ctx.translate(-cx, -cy);
      glow(ctx, cx, cy, r * 1.7, "rgba(60,130,255,.45)");
      ctx.fillStyle = NAVY;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 8, 0, TAU);
      ctx.fill();
      drawPhotoIn(ctx, c.photo, "circle", cx, cy, r);
      // marco dorado (imagen `aro`) y un arco de energía azul que gira
      goldFrame(ctx, cx, cy, r);
      ctx.lineCap = "round";
      ctx.strokeStyle = "#7cc4ff";
      ctx.shadowColor = "#4aa0ff";
      ctx.shadowBlur = 20;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(cx, cy, frameOuter(r) + 16, lt * 3.2, lt * 3.2 + 2.0);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    hero(ctx, lt, 2.0, "sonic", 590, 1262, 250, { from: "right", seed: 1 });
    hero(ctx, lt, 2.3, "tails", 125, 1262, 230, {
      from: "left",
      seed: 4,
      optional: true,
    });
  } else {
    hero(ctx, lt, 1.4, "sonic", W / 2, 1262, 500, { from: "left", seed: 1 });
    hero(ctx, lt, 2.4, "tails", 125, 1262, 230, {
      from: "left",
      seed: 4,
      optional: true,
    });
  }
  hero(ctx, lt, 2.8, "knuckles", 610, 745, 190, {
    from: "right",
    seed: 5,
    optional: true,
  });
}

type Row = { label: string; value: string; at: number; hint?: string[] };

/** 4. Tarjeta de datos + cierre épico. Todo queda a la vista unos segundos al final. */
function sceneData(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  bg(ctx, "blue");
  videoBg(ctx, lt);
  streaks(ctx, lt, {
    rgb: "90,170,255",
    count: 16,
    seed: 90,
    angle: -0.95,
    speed: 420,
    len: 260,
  });
  twinkles(ctx, lt, 14, [CYAN, WHITE], { seed: 21 });
  cornerRings(ctx, lt, 0.05, 40);
  const head = "ANOTÁ LA FECHA";
  const hs = fitSize(ctx, head, racing, 620, 82);
  dash(
    ctx,
    lt,
    0.1,
    -800,
    () =>
      sText(ctx, head, W / 2, 168, hs, {
        fill: goldFill(ctx, 168, hs),
        stroke: "#5a2b00",
        strokeW: hs * 0.08,
        glow: "rgba(255,190,40,.8)",
        glowBlur: 22,
      }),
    0.5,
  );
  const rows: Row[] = [
    {
      label: "FECHA",
      value: dateLine(c).toLocaleUpperCase("es"),
      hint: dateParts(c).map((x) => x.toLocaleUpperCase("es")),
      at: 0.45,
    },
    { label: "HORA", value: c.time.toLocaleUpperCase("es"), at: 1.0 },
    {
      label: "LUGAR",
      value: c.venue.toLocaleUpperCase("es"),
      at: 1.55,
    },
    {
      label: "DIRECCIÓN",
      value: c.address.toLocaleUpperCase("es"),
      at: 2.1,
    },
  ];
  // sin paneles: etiqueta dorada y dato en blanco, los dos con la tipografía del resto del video
  // cada dato puede ocupar dos líneas (por un salto de línea o porque no entra): las filas siguientes bajan lo que haga falta
  // un único tamaño para todos los datos; solo se pasa a dos líneas lo que no entra en una
  const gapOf = (_ls: string[][]) => 134;
  const { size: vsz, lines: vlines } = uniformRows(
    ctx,
    rows.map((r) => ({ text: r.value, hint: r.hint })),
    racing,
    640,
    56,
    22,
    (sz, ls) => {
      const lh = sz * 1.08;
      return (
        250 + ls.reduce((a, l, i) => a + (i < ls.length - 1 ? gapOf(ls) + (l.length - 1) * lh : sz * 1.05 + 37 + (l.length - 1) * lh), 0) <= 800
      );
    },
  );
  const rowGap = gapOf(vlines);
  let rowY = 250;
  rows.forEach((r, i) => {
    const y = rowY;
    const fit = { lines: vlines[i], size: vsz };
    const lh = fit.size * 1.08;
    const extra = (fit.lines.length - 1) * lh;
    rowY += rowGap + extra;
    dash(
      ctx,
      lt,
      r.at,
      i % 2 ? 800 : -800,
      () => {
        sText(ctx, r.label, W / 2, y, 32, {
          fill: GOLD,
          glow: "rgba(255,190,40,.7)",
          glowBlur: 12,
          spacing: 2,
        });
        const vs = fit.size;
        fit.lines.forEach((ln, j) =>
          sText(ctx, ln, W / 2, y + vs * 1.05 + 8 + j * lh, vs, {
            fill: WHITE,
            stroke: NAVY,
            strokeW: vs * 0.08,
            glow: BLUE,
            glowBlur: 18,
          }),
        );
        const g = ctx.createLinearGradient(110, 0, W - 110, 0);
        g.addColorStop(0, "rgba(255,194,26,0)");
        g.addColorStop(0.5, "rgba(255,194,26,.85)");
        g.addColorStop(1, "rgba(255,194,26,0)");
        ctx.fillStyle = g;
        ctx.fillRect(110, y + vs * 1.05 + 34 + extra, W - 220, 3);
      },
      0.5,
    );
  });
  // cierre épico sobre los datos, que siguen a la vista
  hero(ctx, lt, 5.0, "tails", 115, 1285, 250, { from: "left", seed: 1 });
  hero(ctx, lt, 5.3, "sonic", 365, 1290, 215, {
    from: "left",
    seed: 4,
    optional: true,
  });
  hero(ctx, lt, 5.6, "knuckles", 610, 1235, 190, {
    from: "right",
    seed: 5,
    optional: true,
  });
  const bp = prog(lt, 5.9, 0.5);
  if (bp > 0) {
    const t = "¡NO TE LO PIERDAS!";
    const bs = fitSize(ctx, t, racing, 640, 96);
    const y = 868;
    ctx.save();
    ctx.translate(
      W / 2 + (1 - bp) * 0 + (bp < 1 ? Math.sin(lt * 90) * 6 * (1 - bp) : 0),
      y,
    );
    const s = lerp(1.7, 1, outBack(bp));
    ctx.scale(s, s);
    ctx.globalAlpha *= clamp01(bp * 3);
    sText(ctx, t, 0, 0, bs, {
      fill: goldFill(ctx, 0, bs),
      stroke: "#6b0010",
      strokeW: bs * 0.1,
      glow: "rgba(255,60,60,.9)",
      glowBlur: 26,
      shadow: "#2a0004",
    });
    ctx.restore();
    flashFx(ctx, (1 - prog(lt, 5.9, 0.25)) * 0.5, WHITE);
  }
  const lp = prog(lt, 6.6, 0.5);
  if (lp > 0) {
    const t = `LEVEL ${c.age} UNLOCKED`;
    const ls = fitSize(ctx, t, racing, 560, 48);
    ctx.save();
    ctx.globalAlpha *= clamp01(lp * 2);
    sText(ctx, t, W / 2, 940 + (1 - outCubic(lp)) * 30, ls, {
      fill: CYAN,
      stroke: NAVY,
      strokeW: ls * 0.12,
      glow: BLUE,
      glowBlur: 18,
      spacing: 1.5,
    });
    ctx.restore();
  }
}

const SCENES = [sceneIntro, sceneName, sceneData] as const;

function draw(
  ctx: CanvasRenderingContext2D,
  f: { t: number; content: TemplateContent },
) {
  const { t, content: c } = f;
  let i = 0;
  while (i < SCENES.length - 1 && t >= CUTS[i + 1]) i++;
  (
    SCENES[i] as (
      ctx: CanvasRenderingContext2D,
      lt: number,
      c: TemplateContent,
    ) => void
  )(ctx, t - CUTS[i], c);
  // destello que tapa cada corte: sube justo antes y baja después (azul → rojo en la entrada de Shadow)
  for (let k = 1; k < SCENES.length; k++) {
    const cut = CUTS[k];
    const a = t < cut ? prog(t, cut - 0.14, 0.14) : 1 - prog(t, cut, 0.4);
    flashFx(ctx, a * 0.92, CUT_FLASH[k]);
  }
  // arranque desde el negro
  const fin = 1 - prog(t, 0, 0.3);
  if (fin > 0) {
    ctx.fillStyle = `rgba(0,0,0,${fin})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/**
 * Medidas de "CUMPLE 25 AÑOS": las tres palabras juntas (con un espacio corto entre sí y alineadas por el centro) y el grupo
 * centrado en el ancho. Se mide la tinta real de cada una y se compensa la inclinación; si no entra, se achica entera.
 */
function cumpleGeom(ctx: CanvasRenderingContext2D, ageStr: string, as: number, ws: number) {
  ctx.save();
  ctx.textAlign = "center";
  const ink = (txt: string, size: number) => {
    ctx.font = racing(size);
    const m = ctx.measureText(txt);
    return { w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, off: (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 };
  };
  const c = ink("CUMPLE", ws);
  const n = ink(ageStr, as);
  const a = ink("AÑOS", ws);
  ctx.restore();
  const gap = 16;
  const total = c.w + n.w + a.w + gap * 2;
  const fit = Math.min(1, 660 / total);
  // la inclinación corre la tinta hacia la derecha a media altura de cada letra
  const skew = (size: number) => 0.2 * size * 0.36;
  const x0 = -total / 2;
  const xC = x0 + c.w / 2 - c.off - skew(ws);
  const xN = x0 + c.w + gap + n.w / 2 - n.off - skew(as);
  const xA = x0 + c.w + gap + n.w + gap + a.w / 2 - a.off - skew(ws);
  // palabras centradas en vertical con la edad
  const yW = -(as - ws) * 0.36;
  return { fit, xC, xN, xA, yW };
}

/** "CUMPLE 25 AÑOS" en una línea (la edad en dorado), todo junto y centrado, achicado si no entra en el ancho. */
function cumpleLine(ctx: CanvasRenderingContext2D, ageStr: string, y: number, as = 170) {
  const g = cumpleGeom(ctx, ageStr, as, 56);
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.scale(g.fit, g.fit);
  sText(ctx, "CUMPLE", g.xC, g.yW, 56, { fill: ICE, stroke: NAVY, strokeW: 7, glow: BLUE, align: "center" });
  sText(ctx, ageStr, g.xN, 0, as, { fill: goldFill(ctx, 0, as), stroke: "#7a3b00", strokeW: as * 0.07, glow: "rgba(255,190,40,.9)", glowBlur: 26 });
  sText(ctx, "AÑOS", g.xA, g.yW, 56, { fill: ICE, stroke: NAVY, strokeW: 7, glow: BLUE, align: "center" });
  ctx.restore();
}

/** Imagen 1080×1920: nombre y edad grandes, los personajes y los datos de la fiesta, todo a la vista a la vez. */
function poster(ctx: CanvasRenderingContext2D, c: TemplateContent) {
  const lt = 20; // todo ya entró
  bg(ctx, "blue");
  videoBg(ctx, 0);
  streaks(ctx, 2.4, { rgb: "90,170,255", count: 30, seed: 3, angle: -0.95, speed: 700, len: 320 });
  twinkles(ctx, 3, 20, [CYAN, WHITE], { seed: 5 });
  cornerRings(ctx, lt, 0, 44);
  const h1 = "¡FELIZ CUMPLEAÑOS!";
  const s1 = fitSize(ctx, h1, racing, 600, 56);
  sText(ctx, h1, W / 2, 118, s1, { fill: CYAN, stroke: NAVY, strokeW: s1 * 0.12, glow: BLUE, glowBlur: 16 });
  const nm = c.name.toLocaleUpperCase("es");
  const ns = fitSize(ctx, nm, racing, 660, 170);
  sText(ctx, nm, W / 2, 118 + ns * 1.05, ns, { fill: iceFill(ctx, 118 + ns * 1.05, ns), stroke: "#0a2a9a", strokeW: ns * 0.1, glow: BLUE, glowBlur: 30, shadow: "#04124a", spacing: 1 });
  cumpleLine(ctx, String(c.age), 388);
  if (c.photo) {
    // foto en un círculo con marco dorado y un arco de energía; Sonic y Tails a los costados
    const cx = W / 2;
    const cy = 665;
    const r = 195;
    glow(ctx, cx, cy, r * 1.7, "rgba(60,130,255,.45)");
    ctx.fillStyle = NAVY;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, TAU);
    ctx.fill();
    drawPhotoIn(ctx, c.photo, "circle", cx, cy, r);
    goldFrame(ctx, cx, cy, r);
    hero(ctx, lt, 0, "sonic", 610, 905, 235, { seed: 1 });
    hero(ctx, lt, 0, "tails", 110, 905, 190, { seed: 4, optional: true });
  } else {
    hero(ctx, lt, 0, "sonic", W / 2, 905, 350, { seed: 1 });
    hero(ctx, lt, 0, "tails", 120, 905, 210, { seed: 4, optional: true });
    hero(ctx, lt, 0, "knuckles", 605, 770, 170, { seed: 5, optional: true });
  }
  // datos: fecha, horario, lugar y dirección sobre un panel oscuro para que se lean bien
  ctx.save();
  roundRectPath(ctx, 36, 878, 648, 372, 30);
  ctx.fillStyle = "rgba(3,10,50,.66)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,194,26,.75)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  const rows = [
    { label: "FECHA", value: dateLine(c).toLocaleUpperCase("es"), hint: dateParts(c).map((x) => x.toLocaleUpperCase("es")) },
    { label: "HORA", value: c.time.toLocaleUpperCase("es") },
    { label: "LUGAR", value: c.venue.toLocaleUpperCase("es") },
    { label: "DIRECCIÓN", value: c.address.toLocaleUpperCase("es") },
  ];
  // un único tamaño para todos los datos; solo se pasa a dos líneas lo que no entra en una
  const pgapOf = (_ls: string[][]) => 38;
  const { size: vs, lines: plines } = uniformRows(
    ctx,
    rows.map((r) => ({ text: r.value, hint: r.hint })),
    racing,
    610,
    40,
    20,
    (sz, ls) => 896 + ls.reduce((a, l) => a + pgapOf(ls) + sz * 1.05 + (l.length - 1) * sz * 1.08, 0) <= 1238,
  );
  const pgap = pgapOf(plines);
  const lh = vs * 1.08;
  let y = 896;
  rows.forEach((r, i) => {
    sText(ctx, r.label, W / 2, y + 20, 22, { fill: GOLD, glow: "rgba(255,190,40,.7)", glowBlur: 10, spacing: 2 });
    plines[i].forEach((ln, j) =>
      sText(ctx, ln, W / 2, y + 26 + vs * 1.05 + j * lh, vs, { fill: WHITE, stroke: NAVY, strokeW: vs * 0.08, glow: BLUE, glowBlur: 14 }),
    );
    y += pgap + vs * 1.05 + (plines[i].length - 1) * lh;
  });
}

/** Estilo de las imágenes de Mercado Libre: el fondo azul con rayas de velocidad y las letras de carrera. */
const mlStyle: MlStyle = {
  background: (ctx) => {
    bg(ctx, "blue");
    videoBg(ctx, 0);
    streaks(ctx, 2.4, { rgb: "90,170,255", count: 30, seed: 3, angle: -0.95, speed: 700, len: 320 });
    twinkles(ctx, 3, 20, [CYAN, WHITE], { seed: 5 });
  },
  window: { datos: 380, pasos: 300 },
  characters: ["tails", "sonic", "knuckles"],
  charScale: [0.62, 1.45, 0.62],
  charHeight: 480,
  charX: 560,
  charGap: -60,
  decor: ["anillo"],
  scatter: true,
  font: racing,
  title: (ctx, lines, cx, y, maxW) => {
    const s = Math.min(...lines.map((l) => fitSize(ctx, l, racing, maxW, 130, 36)));
    lines.forEach((l, i) => {
      const b = y + s * (0.95 + i * 1.05);
      sText(ctx, l, cx, b, s, { fill: iceFill(ctx, b, s), stroke: "#0a2a9a", strokeW: s * 0.1, glow: BLUE, glowBlur: 30, shadow: "#04124a", spacing: 1 });
    });
    return y + s * (0.95 + (lines.length - 1) * 1.05);
  },
  heading: (ctx, str, x, baseline, size, align) =>
    sText(ctx, str, x, baseline, size, { fill: goldFill(ctx, baseline, size), stroke: "#7a3b00", strokeW: size * 0.08, glow: "rgba(255,190,40,.8)", glowBlur: 14, align, spacing: 0.5 }),
  label: (ctx, str, x, baseline, size, align) =>
    sText(ctx, str, x, baseline, size, { fill: WHITE, stroke: NAVY, strokeW: size * 0.2, glow: BLUE, glowBlur: 14, align, spacing: 0.5 }),
  accent: GOLD,
  ink: NAVY,
  panelPasos: { fill: "rgba(3,10,50,.7)", border: "rgba(255,194,26,.75)" },
};

export const sonic: TemplateDefinition = {
  id: "sonic",
  name: "Sonic y sus amigos",
  description:
    "Velocidad, anillos dorados y destellos azules: Sonic, Tails y Knuckles, tu foto, los datos y el cierre épico.",
  category: "Videojuegos",
  audience: "juvenil",
  palette: [BLUE, RED, GOLD, NAVY],
  fonts: ["HighSpeed", "RacingSansOne", "RedHatDisplay"],
  // imágenes en public/templates/sonic/ (se pueden reemplazar; ver el README de esa carpeta)
  assets: ["sonic", "sonic-corre", "anillo", "aro", "tails", "knuckles", "fondo"],
  duration: DURATION,
  fps: 24,
  defaultAudioId: "velocidad",
  photoRule:
    "La foto va en un círculo con arcos de energía en el bloque del nombre; sin foto aparece Sonic grande.",
  thumbnailTime: 10.6,
  draw,
  poster,
  ml: mlStyle,
};
