// Plantilla "HUNTR/X": cazadoras de demonios K-pop. Motion graphics de videoclip en seis bloques (30 s, vertical 9:16):
//   1. 0–4 s    Introducción: destellos, partículas, líneas de energía, el trío junto y el logo HUNTR/X con impacto.
//   2. 4–9 s    Presentación: Rumi (violeta), Mira (rosa/magenta) y Zoey (celeste), cada una con dos imágenes y su barrido.
//   3. 9–14 s   El cumpleañero: composición grupal que baja y deja el centro a la foto (o la edad) en un marco hexagonal.
//   4. 14–19 s  Celebración de concierto: ¡MÚSICA! ¡BAILE! ¡DIVERSIÓN! alternando cada protagonista y el grupo.
//   5. 19–23 s  Invitación: las protagonistas en los laterales y el mensaje al centro.
//   6. 23–30 s  Tarjeta con TODOS los datos (fecha, horario, lugar y dirección), quieta durante los 7 s finales.
// Las protagonistas son imágenes separadas en public/templates/huntrx/ (rumi-1…4, mira-1…4, zoey-1…4, grupo-1…4), todas
// reemplazables sin tocar código. Si falta una se usa otra de la misma protagonista; si no hay ninguna, se dibuja una
// silueta de neón con el nombre del archivo que corresponde. Todo es función pura de `t`.

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
  inOutCubic,
  hash,
  glow,
  vGradient,
  staticLayer,
  drawText,
  fitSize,
  drawPhotoIn,
  sparkle4,
  polygonPath,
  roundRectPath,
  shapePath,
  twinkles,
  uniformRows,
  dateLine,
  dateParts,
} from "./kit";
import { tplImage } from "./assets";
import type { TplImage } from "./assets";

const VIOLET = "#8B35FF";
const MAGENTA = "#F32BBD";
const PINK = "#FF5A91";
const CYAN = "#32DFFF";
const NAVY = "#100C2C";
const WHITE = "#FFFFFF";
const BLUE = "#2a6bff";

const title = (s: number) => `${s}px HuntersKPop, Anton, Impact, sans-serif`;
const body = (s: number) => `800 ${s}px Montserrat, Arial, sans-serif`;

const ID = "huntrx";
const pic = (name: string, t?: number) => tplImage(ID, name, t);
const SLOTS = 4;

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const up = (s: string) => s.toLocaleUpperCase("es");

// límites de cada bloque (segundos); el último queda quieto con todos los datos a la vista
const CUTS = [0, 4, 9, 14, 19, 23, 30] as const;
const DURATION = CUTS[CUTS.length - 1];
// barridos de color que tapan cada corte (también los cambios de protagonista del bloque 2)
const WIPES = [
  { t: 4, a: VIOLET, b: MAGENTA },
  { t: 5.7, a: MAGENTA, b: PINK },
  { t: 7.4, a: CYAN, b: BLUE },
  { t: 9, a: VIOLET, b: CYAN },
  { t: 14, a: PINK, b: MAGENTA },
  { t: 19, a: CYAN, b: VIOLET },
  { t: 23, a: MAGENTA, b: VIOLET },
];

// ---------------------------------------------------------------- protagonistas

type Who = "rumi" | "mira" | "zoey";
const LOOK: Record<Who, { main: string; soft: string; label: string }> = {
  rumi: { main: VIOLET, soft: "#c9a3ff", label: "RUMI" },
  mira: { main: MAGENTA, soft: PINK, label: "MIRA" },
  zoey: { main: CYAN, soft: "#a8f2ff", label: "ZOEY" },
};
const whoOf = (name: string) => name.split("-")[0];

/** La imagen pedida o, si falta, otra de la misma protagonista (rumi-1…4); null si no hay ninguna. */
function find(name: string, t: number): TplImage | null {
  const direct = pic(name, t);
  if (direct) return direct;
  const base = whoOf(name);
  for (let i = 1; i <= SLOTS; i++) {
    const im = pic(`${base}-${i}`, t);
    if (im) return im;
  }
  return null;
}

/** Silueta de neón que ocupa el lugar de una imagen que falta; (cx, yb) = centro de la base. */
function ghost(
  ctx: CanvasRenderingContext2D,
  who: Who,
  cx: number,
  yb: number,
  h: number,
  file: string,
) {
  const L = LOOK[who];
  const w = h * 0.5;
  ctx.save();
  ctx.translate(cx, yb - h);
  ctx.shadowColor = L.main;
  ctx.shadowBlur = 26;
  ctx.fillStyle = rgba(L.main, 0.5);
  ctx.beginPath();
  ctx.moveTo(-w * 0.34, h * 0.1);
  ctx.quadraticCurveTo(-w * 0.55, h * 0.5, -w * 0.3, h * 0.72);
  ctx.lineTo(w * 0.3, h * 0.72);
  ctx.quadraticCurveTo(w * 0.55, h * 0.5, w * 0.34, h * 0.1);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, L.soft);
  g.addColorStop(1, rgba(L.main, 0.9));
  ctx.fillStyle = g;
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-w * 0.4, h * 0.27);
  ctx.lineTo(w * 0.4, h * 0.27);
  ctx.lineTo(w * 0.3, h * 0.62);
  ctx.lineTo(w * 0.36, h);
  ctx.lineTo(-w * 0.36, h);
  ctx.lineTo(-w * 0.3, h * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, h * 0.13, w * 0.2, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  drawText(ctx, L.label, 0, h * 0.5, {
    font: title,
    size: Math.max(14, w * 0.3),
    fill: WHITE,
  });
  drawText(ctx, `${file}.png`, 0, h * 0.5 + Math.max(14, w * 0.3) * 0.7, {
    font: body,
    size: Math.max(9, w * 0.085),
    fill: WHITE,
  });
  ctx.restore();
}

/** Imagen de cuerpo completo (o grupal) apoyada abajo; (x, yb) = centro de la base, `h` = alto, `maxW` = ancho máximo. */
function figure(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  yb: number,
  h: number,
  o: { t: number; maxW?: number },
) {
  const im = find(name, o.t);
  if (im) {
    let w = (h * im.width) / im.height;
    let hh = h;
    if (o.maxW && w > o.maxW) {
      w = o.maxW;
      hh = (w * im.height) / im.width;
    }
    ctx.drawImage(im, x - w / 2, yb - hh, w, hh);
    return;
  }
  if (name.startsWith("grupo")) {
    const s = Math.min(h, (o.maxW ?? 1e9) / 1.1);
    ghost(ctx, "zoey", x - s * 0.36, yb, s * 0.88, "zoey-1");
    ghost(ctx, "mira", x + s * 0.36, yb, s * 0.88, "mira-1");
    ghost(ctx, "rumi", x, yb, s, "rumi-1");
    drawText(ctx, `${name}.png`, x, yb - s * 0.18, {
      font: body,
      size: Math.max(10, s * 0.035),
      fill: WHITE,
    });
    return;
  }
  ghost(
    ctx,
    whoOf(name) as Who,
    x,
    yb,
    Math.min(h, (o.maxW ?? 1e9) / 0.5),
    name,
  );
}

/** Primer plano: solo la mitad de arriba de la imagen, de ancho `w`; (x, yb) = centro de la base del recorte. */
function bust(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  yb: number,
  w: number,
  t: number,
) {
  const im = find(name, t);
  if (im) {
    const sh = im.height * 0.5;
    const dh = (w * sh) / im.width;
    ctx.drawImage(im, 0, 0, im.width, sh, x - w / 2, yb - dh, w, dh);
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - w / 2 - 20, yb - w * 0.9, w + 40, w * 0.9);
  ctx.clip();
  ghost(ctx, whoOf(name) as Who, x, yb - w * 0.9 + w * 1.8, w * 1.8, name);
  ctx.restore();
}

// ---------------------------------------------------------------- fondos y efectos

const HUES = {
  violet: [NAVY, "#2b0f6b", "rgba(139,53,255,.5)"],
  pink: ["#1a0a2e", "#5c0d57", "rgba(243,43,189,.45)"],
  cyan: ["#07163a", "#0a4478", "rgba(50,223,255,.4)"],
  mix: [NAVY, "#3a0f78", "rgba(243,43,189,.4)"],
  deep: ["#0b0820", "#1d0a4a", "rgba(139,53,255,.4)"],
} as const;
type Hue = keyof typeof HUES;

function stage(ctx: CanvasRenderingContext2D, hue: Hue) {
  staticLayer(ctx, `hx-bg-${hue}`, (c) => {
    const [top, mid, gl] = HUES[hue];
    c.fillStyle = vGradient(c, 0, H, [
      [0, top],
      [0.55, mid],
      [1, top],
    ]);
    c.fillRect(0, 0, W, H);
    glow(c, W / 2, H * 0.5, 640, gl);
    // trama de rayas diagonales muy suave
    c.strokeStyle = "rgba(255,255,255,.035)";
    c.lineWidth = 2;
    for (let x = -H; x < W; x += 46) {
      c.beginPath();
      c.moveTo(x, H);
      c.lineTo(x + H, 0);
      c.stroke();
    }
    const v = c.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 920);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.55)");
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);
  });
}

/** Fondo con paralaje: se desplaza (dx, dy) y se agranda un poco para no mostrar bordes. */
function parallax(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  fn: () => void,
) {
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(1.14, 1.14);
  ctx.translate(dx, dy);
  ctx.translate(-W / 2, -H / 2);
  fn();
  ctx.restore();
}

/** Haces de luz de escenario que barren la pantalla. */
function beams(
  ctx: CanvasRenderingContext2D,
  t: number,
  colors: string[],
  n = 5,
  alpha = 0.24,
) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const x0 = (W * (i + 0.5)) / n;
    const ang = Math.sin(t * 0.9 + i * 1.7) * 0.38 + (i - (n - 1) / 2) * 0.13;
    const len = 1800;
    const ex = x0 + Math.sin(ang) * len;
    const ey = Math.cos(ang) * len;
    const col = colors[i % colors.length];
    const g = ctx.createLinearGradient(x0, 0, ex, ey);
    g.addColorStop(0, rgba(col, alpha * 0.32));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    // capas cada vez más anchas y suaves: la punta es nítida y los bordes se desenfocan a medida que el haz se abre
    for (const spread of [0.028, 0.048, 0.072, 0.1]) {
      const px = Math.cos(ang) * len * spread;
      const py = -Math.sin(ang) * len * spread;
      ctx.beginPath();
      ctx.moveTo(x0, -20);
      ctx.lineTo(ex - px, ey - py);
      ctx.lineTo(ex + px, ey + py);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Líneas de energía que cruzan la pantalla en diagonal. */
function energy(
  ctx: CanvasRenderingContext2D,
  t: number,
  o: {
    colors: string[];
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
    const len = (o.len ?? 280) * (0.5 + hash(sd, 1));
    const sp = o.speed * (0.6 + hash(sd, 2) * 0.9);
    const a = ((hash(sd, 3) * L + t * sp) % (L + len)) - L / 2;
    const q = (hash(sd, 4) - 0.5) * 1500;
    const hx = W / 2 + dx * a - dy * q;
    const hy = H / 2 + dy * a + dx * q;
    const col = o.colors[i % o.colors.length];
    const g = ctx.createLinearGradient(hx - dx * len, hy - dy * len, hx, hy);
    g.addColorStop(0, rgba(col, 0));
    g.addColorStop(1, rgba(col, 0.3 + hash(sd, 6) * 0.7));
    ctx.strokeStyle = g;
    ctx.lineWidth = (o.w ?? 3) * (0.5 + hash(sd, 5));
    ctx.beginPath();
    ctx.moveTo(hx - dx * len, hy - dy * len);
    ctx.lineTo(hx, hy);
    ctx.stroke();
  }
  ctx.restore();
}

/** Polvo de luz y estrellitas que suben, a distintas profundidades. */
function dust(
  ctx: CanvasRenderingContext2D,
  t: number,
  count: number,
  seed: number,
  colors: string[],
  speed = 60,
) {
  for (let i = 0; i < count; i++) {
    const sd = seed + i;
    const z = 0.4 + hash(sd, 1) * 0.9;
    const x = (hash(sd, 2) * W + Math.sin(t * 0.8 + sd) * 20 + W) % W;
    const y = H - ((hash(sd, 3) * (H + 60) + t * speed * z) % (H + 60)) + 30;
    const r = (3 + hash(sd, 4) * 7) * z;
    const col = colors[i % colors.length];
    if (hash(sd, 5) > 0.5) sparkle4(ctx, x, y, r * 1.9, col, t * 0.6 + sd);
    else {
      ctx.fillStyle = rgba(col, 0.55);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.8, 0, TAU);
      ctx.fill();
    }
  }
}

/** Hexágonos y triángulos de contorno que flotan despacio (capa de fondo). */
function geo(ctx: CanvasRenderingContext2D, t: number, color: string) {
  ctx.save();
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const x = hash(i, 21) * W + Math.sin(t * 0.4 + i) * 16;
    const y = hash(i, 22) * H + Math.cos(t * 0.35 + i * 2) * 20;
    const r = 40 + hash(i, 23) * 90;
    polygonPath(
      ctx,
      x,
      y,
      i % 3 === 0 ? 3 : 6,
      r,
      t * (0.1 + hash(i, 24) * 0.2) * (i % 2 ? 1 : -1),
    );
    ctx.strokeStyle = rgba(color, 0.3);
    ctx.stroke();
    if (i % 2) {
      ctx.fillStyle = rgba(color, 0.05);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Piso de escenario en perspectiva, de neón. */
function floorGrid(ctx: CanvasRenderingContext2D, t: number, color: string) {
  const hy = 880;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, hy, W, H - hy);
  ctx.clip();
  ctx.strokeStyle = rgba(color, 0.45);
  ctx.lineWidth = 2;
  for (let k = 0; k < 11; k++) {
    const q = (k + ((t * 1.4) % 1)) / 11;
    const y = hy + Math.pow(q, 2.2) * (H - hy);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let k = -9; k <= 9; k++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + k * 28, hy);
    ctx.lineTo(W / 2 + k * 200, H);
    ctx.stroke();
  }
  const fade = ctx.createLinearGradient(0, hy, 0, hy + 140);
  fade.addColorStop(0, "rgba(16,12,44,1)");
  fade.addColorStop(1, "rgba(16,12,44,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, hy, W, 140);
  ctx.restore();
}

/** Destello que arranca en `at` y se apaga en `dur` segundos (0 antes de `at`). */
const pulse = (lt: number, at: number, dur: number) =>
  lt < at ? 0 : 1 - prog(lt, at, dur);

function flash(ctx: CanvasRenderingContext2D, a: number, color = WHITE) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp01(a);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Estallido de estrellitas que se abre desde (x, y) a partir de `at`. */
function burst(
  ctx: CanvasRenderingContext2D,
  lt: number,
  at: number,
  x: number,
  y: number,
  colors: string[],
  n = 14,
  reach = 320,
) {
  const p = prog(lt, at, 0.8);
  if (p <= 0 || p >= 1) return;
  const e = outCubic(p);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(i, 31);
    const d = reach * e * (0.5 + hash(i, 32) * 0.7);
    ctx.save();
    ctx.globalAlpha *= 1 - p;
    sparkle4(
      ctx,
      x + Math.cos(a) * d,
      y + Math.sin(a) * d,
      (10 + hash(i, 33) * 18) * (1 - p * 0.5),
      colors[i % colors.length],
      p * 3,
    );
    ctx.restore();
  }
}

/** Anillo de onda expansiva. */
function shock(
  ctx: CanvasRenderingContext2D,
  lt: number,
  at: number,
  x: number,
  y: number,
  color: string,
  reach = 800,
) {
  const p = prog(lt, at, 0.7);
  if (p <= 0 || p >= 1) return;
  ctx.save();
  ctx.strokeStyle = rgba(color, 0.9 * (1 - p));
  ctx.lineWidth = 16 * (1 - p) + 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(x, y, outCubic(p) * reach, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** Barrido de color de pantalla completa que tapa un corte: cubre de izquierda a derecha y descubre la escena nueva. */
function sweep(
  ctx: CanvasRenderingContext2D,
  t: number,
  w: (typeof WIPES)[number],
) {
  const p = prog(t, w.t - 0.25, 0.5);
  if (p <= 0 || p >= 1) return;
  const sk = 140;
  const xl = p < 0.5 ? lerp(-200, W + 200, p * 2) : W + 200;
  const xt = p < 0.5 ? -200 : lerp(-200, W + 200, (p - 0.5) * 2);
  const g = ctx.createLinearGradient(xt, 0, xl, 0);
  g.addColorStop(0, w.a);
  g.addColorStop(1, w.b);
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(xt + sk, 0);
  ctx.lineTo(xl + sk, 0);
  ctx.lineTo(xl - sk, H);
  ctx.lineTo(xt - sk, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 7;
  ctx.shadowColor = WHITE;
  ctx.shadowBlur = 20;
  for (const x of p < 0.5 ? [xl] : [xt]) {
    ctx.beginPath();
    ctx.moveTo(x + sk, 0);
    ctx.lineTo(x - sk, H);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- movimiento de las imágenes

/** Glitch digital sutil: repite el dibujo desplazado en unas franjas horizontales. */
function glitch(
  ctx: CanvasRenderingContext2D,
  lt: number,
  amt: number,
  fn: () => void,
) {
  if (amt <= 0.02) return;
  const f = Math.floor(lt * 24);
  for (let k = 0; k < 3; k++) {
    const y = hash(f * 5 + k, 1) * H;
    const bh = 26 + hash(f * 5 + k, 2) * 100;
    const dx = (hash(f * 5 + k, 3) - 0.5) * 80 * amt;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, W, bh);
    ctx.clip();
    ctx.translate(dx, 0);
    fn();
    ctx.restore();
  }
}

type Enter = {
  from: "left" | "right" | "bottom" | "zoom";
  dist?: number;
  dur?: number;
  /** punto sobre el que se hace zoom y se mece */
  pivot?: [number, number];
  /** escala de la que arranca (1 = sin zoom) */
  zoom?: number;
  glow?: string;
  seed?: number;
};

/**
 * Entrada de una imagen con zoom, estela y glitch; después flota con una leve rotación. `fn` dibuja la imagen en su lugar
 * final; no dibuja nada antes de `at`.
 */
function enter(
  ctx: CanvasRenderingContext2D,
  lt: number,
  at: number,
  o: Enter,
  fn: () => void,
) {
  if (lt < at) return;
  const dur = o.dur ?? 0.55;
  const p = prog(lt, at, dur);
  const e = outCubic(p);
  const [px, py] = o.pivot ?? [W / 2, H * 0.62];
  const dist = o.dist ?? 700;
  const dx =
    o.from === "left"
      ? -(1 - e) * dist
      : o.from === "right"
        ? (1 - e) * dist
        : 0;
  const dy = o.from === "bottom" ? (1 - e) * dist : 0;
  const sc = lerp(o.zoom ?? 1, 1, e);
  const idle = clamp01((lt - at) / dur);
  const seed = o.seed ?? 0;
  const sway = Math.sin(lt * 1.9 + seed * 2) * 0.012 * idle;
  const breathe = 1 + Math.sin(lt * 2.4 + seed) * 0.008 * idle;
  const draw = (ox = 0, oy = 0) => {
    ctx.save();
    ctx.translate(px + dx + ox, py + dy + oy);
    ctx.rotate(sway);
    ctx.scale(sc * breathe, sc * breathe);
    ctx.translate(-px, -py);
    fn();
    ctx.restore();
  };
  if (o.glow)
    glow(ctx, px + dx, py + dy, 460, rgba(o.glow, 0.55 * clamp01(p * 2)));
  if (p < 1) {
    const sg = o.from === "left" ? -1 : o.from === "right" ? 1 : 0;
    for (let k = 3; k >= 1; k--) {
      ctx.save();
      ctx.globalAlpha *= 0.14 * (1 - p) * (4 - k);
      draw(-sg * k * 46 * (1 - p), o.from === "bottom" ? -k * 40 * (1 - p) : 0);
      ctx.restore();
    }
  }
  ctx.save();
  ctx.globalAlpha *= clamp01(p * 3);
  draw();
  ctx.restore();
  // glitch al entrar y un parpadeo ocasional mientras se queda
  const since = lt - at;
  const ph = ((lt + hash(seed, 41) * 3) * 0.43) % 1;
  const amt = since < 0.35 ? 1 - since / 0.35 : ph < 0.045 ? 0.4 : 0;
  glitch(ctx, lt, amt, () => draw());
}

// ---------------------------------------------------------------- texto

/** Texto letra por letra: cada una rebota al aparecer (cinética). `grad` = degradado vertical [arriba, abajo]. */
function popText(
  ctx: CanvasRenderingContext2D,
  lt: number,
  at: number,
  str: string,
  cx: number,
  y: number,
  size: number,
  o: {
    grad?: [string, string];
    fill?: string;
    glow?: string;
    stagger?: number;
    font?: (s: number) => string;
    rise?: number;
  } = {},
) {
  const font = o.font ?? title;
  ctx.save();
  ctx.font = font(size);
  // el espacio de la tipografía es muy angosto: se agrega aire entre palabras
  const sp = size * 0.22;
  const total = ctx.measureText(str).width + (str.split(" ").length - 1) * sp;
  ctx.restore();
  const x0 = cx - total / 2;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === " ") continue;
    const p = prog(lt, at + i * (o.stagger ?? 0.03), 0.32);
    if (p <= 0) continue;
    ctx.save();
    ctx.font = font(size);
    const pre =
      ctx.measureText(str.slice(0, i)).width +
      (str.slice(0, i).split(" ").length - 1) * sp;
    const cw = ctx.measureText(ch).width;
    ctx.restore();
    ctx.save();
    ctx.translate(x0 + pre + cw / 2, y - (1 - outCubic(p)) * (o.rise ?? 70));
    const s = Math.max(0.01, outBack(p));
    ctx.scale(s, s);
    ctx.globalAlpha *= clamp01(p * 3);
    drawText(ctx, ch, 0, 0, {
      font,
      size,
      fill: o.grad
        ? vGradient(ctx, -size * 0.85, 0, [
            [0, o.grad[0]],
            [1, o.grad[1]],
          ])
        : (o.fill ?? WHITE),
      glow: o.glow,
      glowBlur: 20,
    });
    ctx.restore();
  }
}

/** Banda inclinada de color (detrás de un texto). */
function band(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c1: string,
  c2: string,
  a = 0.9,
) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, rgba(c1, a));
  g.addColorStop(1, rgba(c2, a));
  ctx.save();
  ctx.fillStyle = g;
  ctx.shadowColor = c1;
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.moveTo(x + 26, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - 26, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** "¡CUMPLE 8 AÑOS!" en una línea, con la edad más grande; achicado si no entra. */
function cumple(
  ctx: CanvasRenderingContext2D,
  age: number,
  y: number,
  size: number,
  scale = 1,
) {
  const parts: [string, number, boolean][] = [
    ["¡CUMPLE ", size, false],
    [String(age), size * 1.9, true],
    [" AÑOS!", size, false],
  ];
  ctx.save();
  const ws = parts.map(([s, sz]) => {
    ctx.font = title(sz);
    return ctx.measureText(s).width;
  });
  ctx.restore();
  const total = ws.reduce((a, b) => a + b, 0);
  const fit = Math.min(1, 650 / total) * scale;
  ctx.save();
  ctx.translate(W / 2 - (total * fit) / 2, y);
  ctx.scale(fit, fit);
  let x = 0;
  parts.forEach(([s, sz, isAge], i) => {
    drawText(ctx, s, x, 0, {
      font: title,
      size: sz,
      align: "left",
      fill: isAge
        ? vGradient(ctx, -sz * 0.85, 0, [
            [0, WHITE],
            [1, CYAN],
          ])
        : WHITE,
      glow: isAge ? CYAN : MAGENTA,
      glowBlur: 22,
    });
    x += ws[i];
  });
  ctx.restore();
}

/** Nombre del cumpleañero: uno de los elementos más grandes del video. */
function nameText(
  ctx: CanvasRenderingContext2D,
  lt: number,
  at: number,
  name: string,
  y: number,
  maxSize: number,
) {
  const nm = up(name);
  const size = fitSize(ctx, nm, title, 660, maxSize);
  const p = prog(lt, at, 0.5);
  if (p <= 0) return;
  // sombra cromática que se cierra al aparecer
  const off = (1 - outCubic(p)) * 14;
  if (off > 0.5) {
    ctx.save();
    ctx.globalAlpha *= 0.7;
    drawText(ctx, nm, -off, y, {
      font: title,
      size,
      fill: rgba(CYAN, 0.8),
      align: "center",
    });
    drawText(ctx, nm, off, y, {
      font: title,
      size,
      fill: rgba(MAGENTA, 0.8),
      align: "center",
    });
    ctx.restore();
  }
  popText(ctx, lt, at, nm, W / 2, y, size, {
    grad: [WHITE, "#ffb4dd"],
    glow: MAGENTA,
    stagger: 0.04,
  });
}

// ---------------------------------------------------------------- bloques

/** 1. Introducción. */
function sceneIntro(ctx: CanvasRenderingContext2D, lt: number) {
  parallax(ctx, Math.sin(lt * 0.9) * 12, lt * -6, () => stage(ctx, "violet"));
  geo(ctx, lt, VIOLET);
  beams(ctx, lt, [VIOLET, MAGENTA, CYAN]);
  energy(ctx, lt, {
    colors: [CYAN, MAGENTA, WHITE],
    count: 22,
    seed: 3,
    angle: -1.1,
    speed: 700,
    len: 320,
  });
  twinkles(ctx, lt, 18, [CYAN, WHITE, PINK], { seed: 5 });
  dust(ctx, lt, 22, 40, [WHITE, CYAN, PINK, VIOLET], 70);
  // el trío sube con zoom, con un empujón de cámara lento
  const push = 1 + lt * 0.012;
  ctx.save();
  ctx.translate(W / 2, H);
  ctx.scale(push, push);
  ctx.translate(-W / 2, -H);
  enter(
    ctx,
    lt,
    0.15,
    {
      from: "bottom",
      dist: 520,
      dur: 0.85,
      zoom: 1.3,
      pivot: [W / 2, H],
      glow: MAGENTA,
      seed: 1,
    },
    () => figure(ctx, "grupo-1", W / 2, 1300, 860, { t: lt, maxW: 780 }),
  );
  ctx.restore();
  // logo HUNTR/X con impacto
  const lp = prog(lt, 1, 0.45);
  if (lp > 0) {
    const txt = "HUNTR/X";
    const size = fitSize(ctx, txt, title, 640, 210);
    const y = 260;
    const shake = Math.sin(lt * 140) * 9 * (1 - prog(lt, 1, 0.55));
    band(
      ctx,
      24,
      y - size * 0.82,
      W - 48,
      size * 0.98,
      VIOLET,
      MAGENTA,
      0.78 * clamp01(lp * 2),
    );
    ctx.save();
    ctx.translate(W / 2 + shake, y);
    const s = lerp(2.8, 1, outBack(lp));
    ctx.scale(s, s);
    ctx.globalAlpha *= clamp01(lp * 3);
    const off = (1 - outCubic(lp)) * 18 + 4;
    drawText(ctx, txt, -off, 0, { font: title, size, fill: rgba(CYAN, 0.9) });
    drawText(ctx, txt, off, 0, { font: title, size, fill: rgba(MAGENTA, 0.9) });
    drawText(ctx, txt, 0, 0, {
      font: title,
      size,
      fill: vGradient(ctx, -size * 0.85, 0, [
        [0, WHITE],
        [1, "#ffc6e8"],
      ]),
      glow: WHITE,
      glowBlur: 26 + Math.sin(lt * 5) * 8,
    });
    ctx.restore();
    shock(ctx, lt, 1, W / 2, 230, WHITE, 760);
    flash(ctx, (1 - prog(lt, 1, 0.3)) * 0.65);
    burst(ctx, lt, 1, W / 2, 230, [WHITE, CYAN, PINK, VIOLET], 18, 380);
  }
  // "¡TENEMOS UNA NOTICIA SÚPER IMPORTANTE!"
  const sp = prog(lt, 1.9, 0.4);
  if (sp > 0) {
    const l1 = "¡TENEMOS UNA NOTICIA";
    const l2 = "SÚPER IMPORTANTE!";
    const size = Math.min(
      fitSize(ctx, l1, title, 640, 62),
      fitSize(ctx, l2, title, 640, 62),
    );
    ctx.save();
    ctx.translate((1 - outCubic(sp)) * -600, 0);
    band(ctx, 20, 356, W - 40, size * 2.4, MAGENTA, PINK, 0.88);
    ctx.restore();
    popText(ctx, lt, 2.0, l1, W / 2, 356 + size * 1.02, size, {
      fill: WHITE,
      stagger: 0.025,
    });
    popText(ctx, lt, 2.35, l2, W / 2, 356 + size * 2.1, size, {
      fill: WHITE,
      stagger: 0.025,
    });
  }
}

const SLOTS_2 = [
  {
    who: "rumi" as Who,
    a: "rumi-1",
    b: "rumi-2",
    hue: "violet" as Hue,
    from: "left" as const,
    colors: [VIOLET, "#c9a3ff", CYAN],
  },
  {
    who: "mira" as Who,
    a: "mira-1",
    b: "mira-2",
    hue: "pink" as Hue,
    from: "right" as const,
    colors: [MAGENTA, PINK, WHITE],
  },
  {
    who: "zoey" as Who,
    a: "zoey-1",
    b: "zoey-2",
    hue: "cyan" as Hue,
    from: "left" as const,
    colors: [CYAN, BLUE, WHITE],
  },
];
const S2_AT = [0, 1.7, 3.4, 5.0];

/** 2. Presentación: tres protagonistas, cada una con dos imágenes. */
function sceneTrio(ctx: CanvasRenderingContext2D, lt: number) {
  let k = 0;
  while (k < SLOTS_2.length - 1 && lt >= S2_AT[k + 1]) k++;
  const s = SLOTS_2[k];
  const L = LOOK[s.who];
  const ls = lt - S2_AT[k];
  parallax(ctx, Math.sin(ls * 1.1) * 14, -ls * 8, () => stage(ctx, s.hue));
  geo(ctx, lt, L.main);
  beams(ctx, lt, [L.main, L.soft], 4, 0.26);
  energy(ctx, ls, {
    colors: s.colors,
    count: 18,
    seed: 20 + k * 9,
    angle: s.from === "left" ? -0.9 : -2.2,
    speed: 760,
    len: 340,
  });
  // nombre gigante de contorno detrás: capa lenta (paralaje)
  ctx.save();
  ctx.translate(W / 2 - ls * 22, 560);
  ctx.rotate(-0.06);
  ctx.font = title(380);
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  ctx.strokeStyle = rgba(L.soft, 0.4);
  ctx.fillStyle = rgba(L.main, 0.1);
  ctx.strokeText(L.label, 0, 0);
  ctx.fillText(L.label, 0, 0);
  ctx.restore();
  dust(ctx, lt, 16, 60 + k * 20, [WHITE, L.soft, L.main], 80);
  // imagen A (primer plano) y, a mitad del bloque, imagen B (otra pose) con un empujón
  const swap = 0.9;
  if (ls < swap) {
    enter(
      ctx,
      ls,
      0.05,
      {
        from: s.from,
        dist: 760,
        dur: 0.5,
        zoom: 1.25,
        pivot: [W / 2, H],
        glow: L.main,
        seed: k,
      },
      () => figure(ctx, s.a, W / 2, 1310, 1190, { t: lt, maxW: 790 }),
    );
    burst(ctx, ls, 0.2, s.from === "left" ? 160 : 560, 620, s.colors, 14, 300);
  } else {
    const q = ls - swap;
    enter(
      ctx,
      q,
      0,
      {
        from: s.from === "left" ? "right" : "left",
        dist: 300,
        dur: 0.35,
        zoom: 1.18,
        pivot: [W / 2, H],
        glow: L.soft,
        seed: k + 5,
      },
      () =>
        figure(ctx, s.b, W / 2 + (s.from === "left" ? 20 : -20), 1310, 1130, {
          t: lt,
          maxW: 790,
        }),
    );
    flash(ctx, (1 - prog(q, 0, 0.18)) * 0.55, L.soft);
  }
  // etiqueta con el nombre
  const tp = prog(ls, 0.2, 0.4);
  if (tp > 0) {
    ctx.save();
    ctx.translate((1 - outCubic(tp)) * (s.from === "left" ? -400 : 400), 0);
    band(
      ctx,
      s.from === "left" ? 24 : W - 304,
      84,
      280,
      78,
      L.main,
      L.soft,
      0.92,
    );
    drawText(ctx, L.label, s.from === "left" ? 164 : W - 164, 144, {
      font: title,
      size: 58,
      fill: WHITE,
    });
    ctx.restore();
  }
  // texto fijo del bloque, sobre una base oscura para que se lea sobre cualquier imagen
  const bt = prog(lt, 0.3, 0.5);
  if (bt > 0) {
    const g = ctx.createLinearGradient(0, 1000, 0, H);
    g.addColorStop(0, "rgba(16,12,44,0)");
    g.addColorStop(0.35, "rgba(16,12,44,.8)");
    g.addColorStop(1, "rgba(16,12,44,.92)");
    ctx.save();
    ctx.globalAlpha *= bt;
    ctx.fillStyle = g;
    ctx.fillRect(0, 1000, W, H - 1000);
    ctx.restore();
    const size = Math.min(
      fitSize(ctx, "¡TENEMOS UNA", title, 640, 92),
      fitSize(ctx, "MISIÓN ESPECIAL!", title, 640, 92),
    );
    popText(ctx, lt, 0.5, "¡TENEMOS UNA", W / 2, 1140, size, {
      grad: [WHITE, L.soft],
      glow: L.main,
      stagger: 0.025,
    });
    popText(
      ctx,
      lt,
      0.85,
      "MISIÓN ESPECIAL!",
      W / 2,
      1140 + size * 1.08,
      size,
      { grad: [WHITE, L.soft], glow: L.main, stagger: 0.025 },
    );
  }
}

/** Marco hexagonal de neón de la foto (o de la edad). */
function hexFrame(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
  cx: number,
  cy: number,
  r: number,
) {
  glow(ctx, cx, cy, r * 1.9, rgba(MAGENTA, 0.4));
  // aro exterior que gira
  ctx.save();
  ctx.lineWidth = 4;
  ctx.setLineDash([26, 18]);
  ctx.lineDashOffset = -lt * 60;
  polygonPath(ctx, cx, cy, 6, r + 44, lt * 0.25);
  ctx.strokeStyle = rgba(CYAN, 0.85);
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 16;
  ctx.stroke();
  ctx.restore();
  // fondo y foto
  shapePath(ctx, "hex", cx, cy, r + 6);
  ctx.fillStyle = NAVY;
  ctx.fill();
  if (c.photo) drawPhotoIn(ctx, c.photo, "hex", cx, cy, r);
  else {
    ctx.save();
    shapePath(ctx, "hex", cx, cy, r);
    ctx.clip();
    ctx.fillStyle = vGradient(ctx, cy - r, cy + r, [
      [0, "#3a0f78"],
      [1, "#7a1a9a"],
    ]);
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    beams(ctx, lt, [CYAN, MAGENTA], 3, 0.3);
    const a = String(c.age);
    const sz = fitSize(ctx, a, title, r * 1.3, 380);
    drawText(ctx, a, cx, cy + sz * 0.36, {
      font: title,
      size: sz,
      fill: vGradient(ctx, cy - sz * 0.5, cy + sz * 0.4, [
        [0, WHITE],
        [1, CYAN],
      ]),
      glow: CYAN,
      glowBlur: 30,
    });
    ctx.restore();
  }
  // borde de neón
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, MAGENTA);
  g.addColorStop(0.5, WHITE);
  g.addColorStop(1, CYAN);
  shapePath(ctx, "hex", cx, cy, r + 4);
  ctx.save();
  ctx.strokeStyle = g;
  ctx.lineWidth = 12;
  ctx.shadowColor = MAGENTA;
  ctx.shadowBlur = 26;
  ctx.stroke();
  ctx.restore();
  // estrellitas que orbitan
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 6 + lt * 0.5;
    sparkle4(
      ctx,
      cx + Math.cos(a) * (r + 44),
      cy + Math.sin(a) * (r + 44),
      16 + Math.sin(lt * 4 + i) * 6,
      i % 2 ? WHITE : CYAN,
      lt,
    );
  }
}

/** 3. El cumpleañero. */
function sceneBirthday(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  parallax(ctx, Math.sin(lt * 0.8) * 16, lt * -7, () => stage(ctx, "mix"));
  geo(ctx, lt, CYAN);
  beams(ctx, lt, [VIOLET, CYAN, MAGENTA], 5, 0.26);
  energy(ctx, lt, {
    colors: [MAGENTA, CYAN, WHITE],
    count: 16,
    seed: 70,
    angle: -1.0,
    speed: 600,
    len: 300,
  });
  dust(ctx, lt, 22, 90, [WHITE, PINK, CYAN, VIOLET], 70);
  // nombre gigante de contorno detrás de la foto (mismo efecto de paralaje que las presentaciones)
  const np = prog(lt, 2.7, 0.6);
  if (np > 0) {
    const nm = up(c.name);
    const ns = fitSize(ctx, nm, title, 940, 380);
    ctx.save();
    ctx.globalAlpha *= outCubic(np);
    ctx.translate(W / 2 - (lt - 2.7) * 26 + (1 - outCubic(np)) * 160, 560);
    ctx.rotate(-0.06);
    ctx.font = title(ns);
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(PINK, 0.5);
    ctx.fillStyle = rgba(MAGENTA, 0.14);
    ctx.strokeText(nm, 0, 0);
    ctx.fillText(nm, 0, 0);
    ctx.restore();
  }
  // composición grupal: primero grande y, al llegar la foto, baja y se achica
  const q = inOutCubic(prog(lt, 2.5, 0.6));
  const h = lerp(900, 370, q);
  const cam = 1 + Math.min(lt, 2.5) * 0.025;
  ctx.save();
  ctx.translate(W / 2, H);
  ctx.scale(cam, cam);
  ctx.translate(-W / 2, -H);
  enter(
    ctx,
    lt,
    0.1,
    {
      from: "zoom",
      dur: 0.8,
      zoom: 1.4,
      pivot: [W / 2, H],
      glow: VIOLET,
      seed: 2,
    },
    () =>
      figure(ctx, "grupo-2", W / 2, 1310, h, {
        t: lt,
        maxW: lerp(780, 520, q),
      }),
  );
  ctx.restore();
  // logo pequeño mientras se ve el grupo solo
  const lp = prog(lt, 0.4, 0.4) * (1 - prog(lt, 2.4, 0.25));
  if (lp > 0) {
    ctx.save();
    ctx.globalAlpha *= lp;
    const t1 = "¡ATENCIÓN, AGENTE!";
    const s1 = fitSize(ctx, t1, title, 640, 100);
    popText(ctx, lt, 0.4, t1, W / 2, 170, s1, {
      grad: [WHITE, "#ffc6e8"],
      glow: MAGENTA,
      stagger: 0.03,
    });
    const l1 = "ESTA VEZ NO SE TRATA";
    const l2 = "DE DERROTAR DEMONIOS...";
    const s2 = Math.min(
      fitSize(ctx, l1, title, 620, 56),
      fitSize(ctx, l2, title, 620, 56),
    );
    popText(ctx, lt, 0.6, l1, W / 2, 170 + s2 * 1.5, s2, {
      grad: [WHITE, "#a8f2ff"],
      glow: CYAN,
      stagger: 0.02,
    });
    popText(ctx, lt, 0.85, l2, W / 2, 170 + s2 * 2.6, s2, {
      grad: [WHITE, "#a8f2ff"],
      glow: CYAN,
      stagger: 0.02,
    });
    ctx.restore();
  }
  // onda expansiva y llegada del marco
  shock(ctx, lt, 2.7, W / 2, 600, WHITE, 900);
  burst(ctx, lt, 2.7, W / 2, 600, [WHITE, CYAN, PINK], 20, 420);
  const fp = prog(lt, 2.75, 0.6);
  if (fp > 0) {
    ctx.save();
    ctx.translate(W / 2, 600);
    const sc = Math.max(0.01, outBack(fp));
    ctx.scale(sc, sc);
    ctx.rotate((1 - outCubic(fp)) * -0.5);
    ctx.translate(-W / 2, -600);
    hexFrame(ctx, lt, c, W / 2, 600, 205);
    ctx.restore();
  }
  flash(ctx, pulse(lt, 2.7, 0.25) * 0.6);
  nameText(ctx, lt, 3.2, c.name, 262, 190);
  if (lt > 3.9) {
    const cp = prog(lt, 3.9, 0.45);
    ctx.save();
    ctx.globalAlpha *= clamp01(cp * 2);
    ctx.translate(0, (1 - outCubic(cp)) * 50);
    cumple(ctx, c.age, 905, 78, lerp(1.3, 1, outBack(cp)));
    ctx.restore();
  }
}

/** Palabra enorme y torcida de la celebración. */
function word(
  ctx: CanvasRenderingContext2D,
  lt: number,
  at: number,
  str: string,
  x: number,
  y: number,
  rot: number,
  c1: string,
  c2: string,
) {
  const size = fitSize(ctx, str, title, 560, 170);
  const p = prog(lt, at, 0.4);
  if (p <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.translate((1 - outCubic(p)) * -rot * 3000, 0);
  band(ctx, -300, -size * 0.86, 600, size * 1.1, c1, c2, 0.8 * clamp01(p * 2));
  popText(ctx, lt, at, str, 0, 0, size, {
    grad: [WHITE, "#ffe3f4"],
    glow: c1,
    stagger: 0.04,
  });
  ctx.restore();
}

const BEATS = [0, 1, 2, 3];

/** 4. Celebración de concierto. */
function sceneParty(ctx: CanvasRenderingContext2D, lt: number) {
  let k = 0;
  while (k < BEATS.length - 1 && lt >= BEATS[k + 1]) k++;
  const lb = lt - BEATS[k];
  const hue: Hue[] = ["violet", "pink", "cyan", "mix"];
  const cols: string[][] = [
    [VIOLET, CYAN, MAGENTA],
    [MAGENTA, PINK, VIOLET],
    [CYAN, BLUE, WHITE],
    [MAGENTA, CYAN, VIOLET],
  ];
  parallax(ctx, Math.sin(lt * 1.3) * 26, Math.cos(lt * 1.1) * 14, () =>
    stage(ctx, hue[k]),
  );
  geo(ctx, lt, cols[k][0]);
  beams(ctx, lt, cols[k], 6, 0.32);
  floorGrid(ctx, lt, cols[k][0]);
  energy(ctx, lt, {
    colors: cols[k],
    count: 24,
    seed: 120 + k * 13,
    angle: k % 2 ? -2.0 : -1.1,
    speed: 820,
    len: 360,
  });
  dust(ctx, lt, 30, 150, [WHITE, ...cols[k]], 120);
  // empujón de cámara en cada golpe
  const punch = 1 + (1 - prog(lb, 0, 0.3)) * 0.06;
  ctx.save();
  ctx.translate(W / 2, H * 0.7);
  ctx.scale(punch, punch);
  ctx.translate(-W / 2, -H * 0.7);
  // 2.5D: lo de atrás se mueve al revés que lo de adelante
  const dx = Math.sin(lt * 1.2) * 10;
  if (k === 0) {
    ctx.save();
    ctx.translate(-dx * 1.6, 0);
    enter(
      ctx,
      lb,
      0.12,
      {
        from: "right",
        dist: 420,
        dur: 0.45,
        zoom: 1.1,
        pivot: [560, 1000],
        seed: 3,
      },
      () => figure(ctx, "mira-2", 560, 1300, 760, { t: lt, maxW: 520 }),
    );
    ctx.restore();
    ctx.save();
    ctx.translate(dx, 0);
    enter(
      ctx,
      lb,
      0,
      {
        from: "left",
        dist: 560,
        dur: 0.45,
        zoom: 1.2,
        pivot: [240, 1000],
        glow: VIOLET,
        seed: 4,
      },
      () => figure(ctx, "rumi-3", 250, 1310, 1030, { t: lt, maxW: 620 }),
    );
    ctx.restore();
  } else if (k === 1) {
    ctx.save();
    ctx.translate(-dx * 1.6, 0);
    enter(
      ctx,
      lb,
      0.12,
      {
        from: "left",
        dist: 420,
        dur: 0.45,
        zoom: 1.1,
        pivot: [170, 1000],
        seed: 5,
      },
      () => figure(ctx, "zoey-2", 170, 1300, 760, { t: lt, maxW: 520 }),
    );
    ctx.restore();
    ctx.save();
    ctx.translate(dx, 0);
    enter(
      ctx,
      lb,
      0,
      {
        from: "right",
        dist: 560,
        dur: 0.45,
        zoom: 1.2,
        pivot: [480, 1000],
        glow: MAGENTA,
        seed: 6,
      },
      () => figure(ctx, "mira-3", 400, 1310, 1030, { t: lt, maxW: 620 }),
    );
    ctx.restore();
  } else if (k === 2) {
    ctx.save();
    ctx.translate(-dx * 1.6, 0);
    enter(
      ctx,
      lb,
      0.1,
      { from: "left", dist: 380, dur: 0.45, pivot: [110, 1000], seed: 7 },
      () => figure(ctx, "rumi-2", 110, 1300, 660, { t: lt, maxW: 400 }),
    );
    enter(
      ctx,
      lb,
      0.18,
      { from: "right", dist: 380, dur: 0.45, pivot: [610, 1000], seed: 8 },
      () => figure(ctx, "mira-1", 610, 1300, 660, { t: lt, maxW: 400 }),
    );
    ctx.restore();
    ctx.save();
    ctx.translate(dx, 0);
    enter(
      ctx,
      lb,
      0,
      {
        from: "bottom",
        dist: 600,
        dur: 0.5,
        zoom: 1.15,
        pivot: [W / 2, 1100],
        glow: CYAN,
        seed: 9,
      },
      () => figure(ctx, "zoey-3", W / 2, 1315, 1050, { t: lt, maxW: 640 }),
    );
    ctx.restore();
  } else {
    enter(
      ctx,
      lb,
      0,
      {
        from: "zoom",
        dur: 0.6,
        zoom: 1.5,
        pivot: [W / 2, H],
        glow: MAGENTA,
        seed: 10,
      },
      () => figure(ctx, "grupo-3", W / 2, 1310, 930, { t: lt, maxW: 790 }),
    );
  }
  ctx.restore();
  // palabras sincronizadas con los golpes de la música
  if (k === 0)
    word(ctx, lb, 0.1, "¡MÚSICA!", W / 2 + 20, 215, -0.07, VIOLET, MAGENTA);
  if (k === 1)
    word(ctx, lb, 0.1, "¡BAILE!", W / 2 - 20, 215, 0.07, MAGENTA, PINK);
  if (k === 2) word(ctx, lb, 0.1, "¡DIVERSIÓN!", W / 2, 200, -0.05, CYAN, BLUE);
  if (k === 3) {
    const l1 = "PREPARÁ TU MEJOR";
    const l2 = "OUTFIT...";
    const size = Math.min(
      fitSize(ctx, l1, title, 640, 100),
      fitSize(ctx, l2, title, 640, 100),
    );
    popText(ctx, lb, 0.25, l1, W / 2, 150, size, {
      grad: [WHITE, "#ffc6e8"],
      glow: MAGENTA,
      stagger: 0.03,
    });
    popText(ctx, lb, 0.6, l2, W / 2, 150 + size * 1.12, size, {
      grad: [WHITE, "#a8f2ff"],
      glow: CYAN,
      stagger: 0.05,
    });
    burst(ctx, lb, 0.1, W / 2, 700, [WHITE, PINK, CYAN, VIOLET], 24, 520);
  }
  // destello blanco en cada golpe
  flash(ctx, k > 0 || lb > 0 ? (1 - prog(lb, 0, 0.16)) * 0.5 : 0);
  if (k >= 1) shock(ctx, lb, 0, W / 2, 700, cols[k][0], 700);
}

/** 5. Invitación: las protagonistas en los laterales y el mensaje al centro. */
function sceneInvite(ctx: CanvasRenderingContext2D, lt: number) {
  parallax(ctx, Math.sin(lt) * 14, lt * -8, () => stage(ctx, "violet"));
  geo(ctx, lt, MAGENTA);
  beams(ctx, lt, [CYAN, MAGENTA, VIOLET], 5, 0.26);
  energy(ctx, lt, {
    colors: [MAGENTA, CYAN, WHITE],
    count: 18,
    seed: 200,
    angle: -1.2,
    speed: 650,
    len: 320,
  });
  dust(ctx, lt, 26, 230, [WHITE, PINK, CYAN], 90);
  // halo detrás del mensaje
  glow(ctx, W / 2, 450, 380, rgba(VIOLET, 0.55));
  const dx = Math.sin(lt * 1.2) * 8;
  ctx.save();
  ctx.translate(-dx * 1.4, 0);
  enter(
    ctx,
    lt,
    0.1,
    {
      from: "left",
      dist: 560,
      dur: 0.55,
      zoom: 1.12,
      pivot: [140, 1000],
      glow: VIOLET,
      seed: 11,
    },
    () => figure(ctx, "mira-4", 150, 1310, 1040, { t: lt, maxW: 580 }),
  );
  ctx.restore();
  ctx.save();
  ctx.translate(dx * 1.4, 0);
  enter(
    ctx,
    lt,
    0.25,
    {
      from: "right",
      dist: 420,
      dur: 0.55,
      zoom: 1.12,
      pivot: [600, 1000],
      glow: CYAN,
      seed: 12,
    },
    () => figure(ctx, "zoey-4", 540, 1285, 700, { t: lt, maxW: 620 }),
  );
  ctx.restore();
  enter(
    ctx,
    lt,
    0.9,
    {
      from: "bottom",
      dist: 460,
      dur: 0.5,
      zoom: 1.1,
      pivot: [W / 2, 1100],
      glow: MAGENTA,
      seed: 13,
    },
    () => figure(ctx, "rumi-4", W / 2, 1320, 660, { t: lt, maxW: 540 }),
  );
  // mensaje central
  const size = Math.min(
    fitSize(ctx, "¡NO TE PIERDAS", title, 500, 108),
    fitSize(ctx, "ESTA MISIÓN!", title, 500, 108),
  );
  popText(ctx, lt, 0.55, "¡NO TE PIERDAS", W / 2, 335 + size * 0.95, size, {
    grad: [WHITE, "#ffc6e8"],
    glow: MAGENTA,
    stagger: 0.03,
  });
  popText(ctx, lt, 0.95, "ESTA MISIÓN!", W / 2, 335 + size * 2.05, size, {
    grad: [WHITE, "#ffc6e8"],
    glow: MAGENTA,
    stagger: 0.03,
  });
  flash(ctx, pulse(lt, 0.55, 0.2) * 0.3);
  const tp = prog(lt, 1.8, 0.5);
  if (tp > 0) {
    const t2 = "¡TE ESPERAMOS!";
    const s2 = fitSize(ctx, t2, title, 440, 70);
    ctx.save();
    ctx.translate(W / 2, 640);
    const sc = Math.max(0.01, outBack(tp)) * (1 + Math.sin(lt * 6) * 0.015);
    ctx.scale(sc, sc);
    ctx.globalAlpha *= clamp01(tp * 2);
    band(ctx, -230, -s2 * 0.9, 460, s2 * 1.3, CYAN, BLUE, 0.92);
    drawText(ctx, t2, 0, 0, { font: title, size: s2, fill: WHITE, glow: CYAN });
    ctx.restore();
    burst(ctx, lt, 1.8, W / 2, 640, [WHITE, CYAN, PINK], 14, 300);
  }
}

/** Íconos de neón de la tarjeta de datos, dentro de un círculo de radio `r`. */
function icon(
  ctx: CanvasRenderingContext2D,
  kind: "cal" | "clock" | "pin",
  x: number,
  y: number,
  r: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = rgba(color, 0.2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = WHITE;
  ctx.fillStyle = WHITE;
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.shadowBlur = 8;
  const u = r / 30;
  if (kind === "cal") {
    roundRectPath(ctx, -15 * u, -13 * u, 30 * u, 28 * u, 5 * u);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-15 * u, -4 * u);
    ctx.lineTo(15 * u, -4 * u);
    ctx.moveTo(-7 * u, -18 * u);
    ctx.lineTo(-7 * u, -9 * u);
    ctx.moveTo(7 * u, -18 * u);
    ctx.lineTo(7 * u, -9 * u);
    ctx.stroke();
    for (const [dx, dy] of [
      [-7, 4],
      [0, 4],
      [7, 4],
      [-7, 11],
      [0, 11],
    ])
      ctx.fillRect((dx - 1.8) * u, (dy - 1.8) * u, 3.6 * u, 3.6 * u);
  } else if (kind === "clock") {
    ctx.beginPath();
    ctx.arc(0, 0, 17 * u, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -10 * u);
    ctx.lineTo(0, 0);
    ctx.lineTo(8 * u, 5 * u);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, 19 * u);
    ctx.bezierCurveTo(-18 * u, 2 * u, -15 * u, -17 * u, 0, -17 * u);
    ctx.bezierCurveTo(15 * u, -17 * u, 18 * u, 2 * u, 0, 19 * u);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -5 * u, 5.5 * u, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/** 6. Datos de la fiesta: todo a la vista y quieto desde ~4 s hasta el final. */
function sceneData(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  parallax(ctx, Math.sin(lt * 0.7) * 10, lt * -4, () => stage(ctx, "deep"));
  geo(ctx, lt, VIOLET);
  beams(ctx, lt, [VIOLET, MAGENTA, CYAN], 5, 0.22);
  dust(ctx, lt, 20, 300, [WHITE, PINK, CYAN, VIOLET], 50);
  // las tres en cuerpo entero, grandes, en la mitad de arriba; Rumi al frente
  const yb = 735;
  const cast: [
    string,
    number,
    number,
    number,
    string,
    "left" | "right" | "bottom",
    number,
  ][] = [
    ["mira-1", 105, 690, 280, MAGENTA, "left", 0.05],
    ["zoey-1", 615, 675, 320, CYAN, "right", 0.15],
    ["rumi-1", 360, 715, 420, VIOLET, "bottom", 0.25],
  ];
  const sway = Math.sin(lt * 1.1) * 6;
  for (const [nm, x, h, maxW, col, from, at] of cast) {
    ctx.save();
    ctx.translate(
      sway * (from === "left" ? -1 : from === "right" ? 1 : 0.4),
      0,
    );
    enter(
      ctx,
      lt,
      at,
      {
        from,
        dist: from === "bottom" ? 360 : 460,
        dur: 0.55,
        zoom: 1.1,
        pivot: [x, yb - 300],
        glow: col,
        seed: x,
      },
      () => figure(ctx, nm, x, yb, h, { t: lt, maxW }),
    );
    ctx.restore();
  }
  // el cumpleañero (solo si hay foto) entra con su marco de neón entre las protagonistas, detrás del texto y fundido con el degradé oscuro
  if (c.photo) {
    const fp = prog(lt, 1.2, 0.6);
    if (fp > 0) {
      ctx.save();
      ctx.translate(W / 2, 400);
      const sc = Math.max(0.01, outBack(fp));
      ctx.scale(sc, sc);
      ctx.rotate((1 - outCubic(fp)) * -0.5);
      ctx.translate(-W / 2, -400);
      hexFrame(ctx, lt, c, W / 2, 400, 140);
      ctx.restore();
      shock(ctx, lt, 1.2, W / 2, 400, WHITE, 520);
      burst(ctx, lt, 1.2, W / 2, 400, [WHITE, CYAN, PINK], 16, 340);
      flash(ctx, pulse(lt, 1.2, 0.2) * 0.35);
    }
  }
  // las piernas se funden con el fondo para que el texto quede limpio, sin recuadros
  const fade = ctx.createLinearGradient(0, 380, 0, 670);
  fade.addColorStop(0, "rgba(11,8,32,0)");
  fade.addColorStop(0.6, "rgba(11,8,32,.9)");
  fade.addColorStop(1, "rgba(11,8,32,.97)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 380, W, 290);
  ctx.fillStyle = "rgba(11,8,32,.97)";
  ctx.fillRect(0, 669, W, H - 669);
  glow(ctx, W / 2, 800, 420, rgba(VIOLET, 0.28));
  // todo el bloque de texto sube para pisar un poco más a las protagonistas
  ctx.save();
  ctx.translate(0, -212);

  const rev = (at: number, fn: () => void) => {
    const p = prog(lt, at, 0.45);
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha *= clamp01(p * 2);
    ctx.translate(0, (1 - outCubic(p)) * 36);
    fn();
    ctx.restore();
  };

  rev(0.7, () => {
    const t1 = "¡TE INVITAMOS!";
    const s1 = fitSize(ctx, t1, title, 620, 56);
    drawText(ctx, t1, W / 2, 782, {
      font: title,
      size: s1,
      fill: CYAN,
      glow: CYAN,
      spacing: 1,
    });
  });
  nameText(ctx, lt, 1.1, c.name, 888, 128);
  const cp = prog(lt, 1.7, 0.4);
  if (cp > 0) {
    ctx.save();
    ctx.globalAlpha *= clamp01(cp * 2);
    cumple(ctx, c.age, 958, 54, lerp(1.25, 1, outBack(cp)));
    ctx.restore();
  }

  // fecha: día de la semana y horario a los lados con sus líneas, y el día en grande al centro
  rev(2.0, () => {
    const side = (txt: string, cx: number) => {
      const s = fitSize(ctx, up(txt), title, 185, 40);
      const lg = ctx.createLinearGradient(cx - 96, 0, cx + 96, 0);
      lg.addColorStop(0, rgba(MAGENTA, 0));
      lg.addColorStop(0.5, PINK);
      lg.addColorStop(1, rgba(MAGENTA, 0));
      ctx.save();
      ctx.fillStyle = lg;
      ctx.shadowColor = MAGENTA;
      ctx.shadowBlur = 10;
      ctx.fillRect(cx - 96, 1004, 192, 4);
      ctx.fillRect(cx - 96, 1070, 192, 4);
      ctx.restore();
      drawText(ctx, up(txt), cx, 1050 + s * 0.05, {
        font: title,
        size: s,
        fill: WHITE,
        glow: MAGENTA,
        glowBlur: 12,
      });
    };
    side(c.weekday, 172);
    side(c.time, 548);
    drawText(ctx, String(c.day), W / 2, 1076, {
      font: title,
      size: 88,
      fill: vGradient(ctx, 1005, 1076, [
        [0, WHITE],
        [1, PINK],
      ]),
      glow: MAGENTA,
      glowBlur: 26,
    });
    drawText(ctx, up(c.monthName), W / 2, 1108, {
      font: title,
      size: fitSize(ctx, up(c.monthName), title, 300, 34),
      fill: WHITE,
      glow: CYAN,
      glowBlur: 12,
      spacing: 3,
    });
  });

  // lugar y dirección: si no entran en una línea pasan a la siguiente (a lo sumo tres)
  const wrap = (txt: string, maxW: number, max: number, min: number) => {
    for (let sz = max; sz >= min; sz -= 2) {
      ctx.font = title(sz);
      const out: string[] = [];
      let cur = "";
      for (const w of txt.split(/\s+/).filter(Boolean)) {
        const nxt = cur ? `${cur} ${w}` : w;
        if (cur && ctx.measureText(nxt).width > maxW) {
          out.push(cur);
          cur = w;
        } else cur = nxt;
      }
      if (cur) out.push(cur);
      if (out.length <= 2 || sz === min) return { size: sz, lines: out };
    }
    return { size: min, lines: [txt] };
  };
  const venue = wrap(up(c.venue), 540, 54, 34);
  const addr = wrap(up(c.address), 600, 40, 28);
  const vy = 1206;
  const ay = 1184 + venue.lines.length * venue.size * 1.12 + 10;
  rev(2.6, () => {
    ctx.font = title(venue.size);
    const vw = Math.max(...venue.lines.map((l) => ctx.measureText(l).width));
    icon(
      ctx,
      "pin",
      W / 2 + 26 - vw / 2 - 38,
      vy -
        venue.size * 0.3 +
        ((venue.lines.length - 1) * venue.size * 1.12) / 2,
      24,
      VIOLET,
    );
    venue.lines.forEach((l, i) =>
      drawText(ctx, l, W / 2 + 26, vy + i * venue.size * 1.12, {
        font: title,
        size: venue.size,
        fill: WHITE,
      }),
    );
  });
  rev(2.9, () => {
    addr.lines.forEach((l, i) =>
      drawText(ctx, l, W / 2, ay + i * addr.size * 1.15, {
        font: title,
        size: addr.size,
        fill: "#efe6ff",
      }),
    );
  });

  // cierre
  const ep = prog(lt, 3.4, 0.5);
  if (ep > 0) {
    const t2 = "¿ACEPTÁS LA MISIÓN?";
    const s2 = fitSize(ctx, t2, title, 600, 66);
    ctx.save();
    ctx.translate(W / 2, 1412);
    const sc = Math.max(0.01, outBack(ep)) * (1 + Math.sin(lt * 4) * 0.012);
    ctx.scale(sc, sc);
    ctx.globalAlpha *= clamp01(ep * 2);
    drawText(ctx, t2, 0, 0, {
      font: title,
      size: s2,
      fill: vGradient(ctx, -s2 * 0.85, 0, [
        [0, WHITE],
        [1, "#ffb4dd"],
      ]),
      glow: MAGENTA,
      glowBlur: 26,
      spacing: 2,
    });
    ctx.restore();
    burst(ctx, lt, 3.4, W / 2, 1390, [WHITE, PINK, CYAN, VIOLET], 16, 340);
  }
  ctx.restore();
}

type Scene = (
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) => void;
const SCENES: Scene[] = [
  sceneIntro,
  sceneTrio,
  sceneBirthday,
  sceneParty,
  sceneInvite,
  sceneData,
];

function draw(
  ctx: CanvasRenderingContext2D,
  f: { t: number; content: TemplateContent },
) {
  const { t, content: c } = f;
  let i = 0;
  while (i < SCENES.length - 1 && t >= CUTS[i + 1]) i++;
  SCENES[i](ctx, t - CUTS[i], c);
  for (const w of WIPES) sweep(ctx, t, w);
  // arranque desde el negro
  const fin = 1 - prog(t, 0, 0.3);
  if (fin > 0) {
    ctx.fillStyle = `rgba(0,0,0,${fin})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Imagen 1080×1920: la tarjeta de datos ya completa. */
function poster(ctx: CanvasRenderingContext2D, c: TemplateContent) {
  sceneData(ctx, 20, c);
}

/** Hexágono de neón suelto (el elemento de la marca) con estrellitas, para las imágenes de Mercado Libre. */
function neonHex(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rot: number,
) {
  glow(ctx, cx, cy, r * 2.1, rgba(MAGENTA, 0.35));
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, MAGENTA);
  g.addColorStop(0.5, WHITE);
  g.addColorStop(1, CYAN);
  ctx.save();
  polygonPath(ctx, cx, cy, 6, r, rot);
  ctx.fillStyle = rgba(NAVY, 0.55);
  ctx.fill();
  ctx.strokeStyle = g;
  ctx.lineWidth = 12;
  ctx.shadowColor = MAGENTA;
  ctx.shadowBlur = 26;
  ctx.stroke();
  ctx.setLineDash([22, 16]);
  ctx.lineWidth = 4;
  ctx.shadowColor = CYAN;
  ctx.shadowBlur = 14;
  polygonPath(ctx, cx, cy, 6, r + 34, rot);
  ctx.strokeStyle = rgba(CYAN, 0.85);
  ctx.stroke();
  ctx.restore();
  for (let i = 0; i < 4; i++) {
    const a = rot - Math.PI / 2 + (i * TAU) / 4 + 0.4;
    sparkle4(
      ctx,
      cx + Math.cos(a) * (r + 34),
      cy + Math.sin(a) * (r + 34),
      14 + (i % 2) * 8,
      i % 2 ? WHITE : CYAN,
      i,
    );
  }
}

/** Estilo de las imágenes de Mercado Libre: el mismo escenario neón del video. */
const ml: MlStyle = {
  background: (ctx) => {
    stage(ctx, "violet");
    geo(ctx, 3, VIOLET);
    beams(ctx, 3, [VIOLET, MAGENTA, CYAN], 5, 0.28);
    dust(ctx, 3, 26, 40, [WHITE, PINK, CYAN, VIOLET], 80);
    // elemento de la segunda imagen: hexágonos de neón que asoman por los bordes (la primera no llega a esa zona)
    neonHex(ctx, 34, 880, 86, 0.2);
    neonHex(ctx, 690, 1180, 100, -0.15);
    neonHex(ctx, 700, 790, 46, 0.5);
  },
  window: { datos: 0, pasos: 560 },
  characters: ["mira-1", "rumi-1", "zoey-1"],
  charScale: [0.92, 1.1, 0.92],
  charHeight: 820,
  charX: 700,
  charGap: -90,
  font: title,
  title: (ctx, lines, cx, y, maxW) => {
    const size = Math.min(
      ...lines.map((l) => fitSize(ctx, up(l), title, maxW, 130, 36)),
    );
    lines.forEach((l, i) =>
      drawText(ctx, up(l), cx, y + size + i * size * 1.08, {
        font: title,
        size,
        fill: vGradient(ctx, y + i * size * 1.08, y + size + i * size * 1.08, [
          [0, WHITE],
          [1, "#ffb4dd"],
        ]),
        glow: MAGENTA,
        glowBlur: 30,
        spacing: 1,
      }),
    );
    return y + size + (lines.length - 1) * size * 1.08;
  },
  heading: (ctx, str, x, baseline, size, align) =>
    drawText(ctx, str, x, baseline, {
      font: title,
      size,
      fill: CYAN,
      align,
      glow: CYAN,
      glowBlur: 16,
      spacing: 1,
    }),
  label: (ctx, str, x, baseline, size, align) =>
    drawText(ctx, str, x, baseline, {
      font: title,
      size,
      fill: WHITE,
      align,
      glow: MAGENTA,
      glowBlur: 14,
      spacing: 1,
    }),
  accent: PINK,
  ink: NAVY,
  panelPasos: { fill: "rgba(16,12,44,.78)", border: MAGENTA },
};

export const huntrx: TemplateDefinition = {
  id: "huntrx",
  name: "HUNTR/X: Cazadoras K-pop",
  description:
    "Videoclip neón con las tres cazadoras de demonios: presentación de cada una, tu foto, un concierto y la tarjeta con todos los datos.",
  category: "K-pop",
  audience: "juvenil",
  palette: [VIOLET, MAGENTA, CYAN, NAVY],
  fonts: ["HuntersKPop", "Anton", "Montserrat"],
  // imágenes en public/templates/huntrx/ (se pueden reemplazar; ver el README de esa carpeta)
  assets: [
    "rumi-1",
    "rumi-2",
    "rumi-3",
    "rumi-4",
    "mira-1",
    "mira-2",
    "mira-3",
    "mira-4",
    "zoey-1",
    "zoey-2",
    "zoey-3",
    "zoey-4",
    "grupo-1",
    "grupo-2",
    "grupo-3",
  ],
  duration: DURATION,
  fps: 24,
  defaultAudioId: "cazadoras",
  photoRule:
    "La foto va dentro de un marco hexagonal de neón en el bloque del nombre; sin foto, el marco muestra la edad.",
  thumbnailTime: 12.5,
  imageTime: 27,
  draw,
  poster,
  ml,
};
