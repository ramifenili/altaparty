// Plantilla "Spidey y sus amigos": telaraña azul, emblema, Spidey, Ghost-Spider (Gwen Stacy) y Miles Morales.
// Cinco bloques: el emblema estalla y sale Spidey, "estás invitado a la fiesta de…" con los tres héroes, la foto
// del cumpleañero, un cierre con el patrón de arañas y, al final, la tarjeta de datos (fecha, horario y lugar), que
// se queda unos segundos en pantalla.
// Cada amigo (Spidey, Gwen y Miles) es una imagen separada con su propia animación; todas están en
// public/templates/spidey/ y se pueden reemplazar por otras.
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
  starPath,
  roundRectPath,
  confetti,
  splitLong,
  dateLine,
  dateParts,
  uniformRows,
} from "./kit";
import { tplImage, drawContain } from "./assets";

const BLUE = "#2f6fd8";
const BLUE_D = "#17418f";
const NAVY = "#0f2a66";
const RED = "#dc2a2a";
const SKY = "#5ec2f2";
const SKY_L = "#a6e1ff";
const YELLOW = "#ffd23f";
const WHITE = "#ffffff";
const bangers = (s: number) => `${s}px Bangers, Impact, sans-serif`;
const fredoka = (s: number) => `700 ${s}px Fredoka, system-ui, sans-serif`;

const ID = "spidey";
const img = (name: string) => tplImage(ID, name);

// límites de cada bloque (segundos)
// el último bloque (la tarjeta de datos con fecha, horario y lugar) dura lo suficiente para quedarse unos segundos quieta
const CUTS = [0, 3.8, 9.6, 15.4, 20.0, 27.0] as const;
const DURATION = CUTS[CUTS.length - 1];

// ---------------------------------------------------------------- dibujos básicos

/** Telaraña: rayos desde (cx, cy) y arcos entre ellos. */
function web(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  spokes: number,
  rings: number,
  color: string,
  lw: number,
  from = 0,
  to = TAU,
) {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.lineCap = "round";
  const n = Math.max(2, Math.round((spokes * (to - from)) / TAU));
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    c.stroke();
  }
  for (let r = 1; r <= rings; r++) {
    const rr = (R * r) / rings;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = from + ((to - from) * i) / n;
      const a1 = from + ((to - from) * (i + 1)) / n;
      const x0 = cx + Math.cos(a0) * rr;
      const y0 = cy + Math.sin(a0) * rr;
      const x1 = cx + Math.cos(a1) * rr;
      const y1 = cy + Math.sin(a1) * rr;
      const am = (a0 + a1) / 2;
      const k = 0.9;
      if (i === 0) c.moveTo(x0, y0);
      c.quadraticCurveTo(
        cx + Math.cos(am) * rr * k,
        cy + Math.sin(am) * rr * k,
        x1,
        y1,
      );
    }
    c.stroke();
  }
  c.restore();
}

function halftone(
  c: CanvasRenderingContext2D,
  color: string,
  fromX: number,
  fromY: number,
  reach: number,
  step = 22,
  flip = false,
) {
  c.fillStyle = color;
  for (let y = 0; y < H + step; y += step) {
    for (let x = 0; x < W + step; x += step) {
      const d = Math.hypot(x - fromX, y - fromY) / reach;
      const r = Math.max(0, (flip ? d : 1 - d) * step * 0.5);
      if (r < 0.6) continue;
      c.beginPath();
      c.arc(
        x + ((y / step) % 2) * (step / 2),
        y,
        Math.min(r, step * 0.5),
        0,
        TAU,
      );
      c.fill();
    }
  }
}

/** Arañita (silueta) con las patas que caminan. */
function spider(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  t: number,
  color = NAVY,
  rot = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const base = -0.5 + i * 0.36;
    const wig = Math.sin(t * 14 + i * 1.7) * 0.18;
    for (const sd of [-1, 1]) {
      const a = sd * (1.1 + base) + wig;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.sin(a) * 15, -Math.cos(a) * 8 - 6);
      ctx.lineTo(Math.sin(a) * 26, -Math.cos(a) * 3 + 8);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 11, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -13, 5.5, 5, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Estallido de historieta. */
function burstPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  spikes = 16,
  rot = 0,
) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rr = (i % 2 === 0 ? R : R * 0.72) * (0.92 + 0.16 * hash(i, 4));
    const a = rot + (i * Math.PI) / spikes;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Emblema de la araña dibujado en código (se usa si falta emblema.png). */
function emblemFallback(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = RED;
  ctx.lineWidth = r * 0.14;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.93, 0, TAU);
  ctx.stroke();
  spider(ctx, cx, cy + r * 0.05, r / 18, 0, "#3c63b4");
}

// ---------------------------------------------------------------- fondos (capas estáticas)

function webBg(ctx: CanvasRenderingContext2D) {
  staticLayer(ctx, "spidey-web", (c) => {
    c.fillStyle = vGradient(c, 0, H, [
      [0, "#2a62c9"],
      [1, "#3c7fe3"],
    ]);
    c.fillRect(0, 0, W, H);
    web(c, W / 2, 520, 1200, 16, 11, "rgba(160,200,255,.55)", 9);
    const g = c.createRadialGradient(W / 2, 520, 120, W / 2, 520, 900);
    g.addColorStop(0, "rgba(255,255,255,.12)");
    g.addColorStop(1, "rgba(8,30,90,.35)");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  });
}

function skyBg(ctx: CanvasRenderingContext2D) {
  staticLayer(ctx, "spidey-sky", (c) => {
    c.fillStyle = vGradient(c, 0, H, [
      [0, "#2f9de5"],
      [0.55, "#62c4f4"],
      [1, "#bfe9ff"],
    ]);
    c.fillRect(0, 0, W, H);
    // rayos
    c.fillStyle = "rgba(255,255,255,.12)";
    for (let i = -4; i < 5; i++) {
      c.beginPath();
      c.moveTo(W / 2 + i * 28, 520);
      c.lineTo(W / 2 + i * 28 + 56, 520);
      c.lineTo(W / 2 + i * 330 + 150, -40);
      c.lineTo(W / 2 + i * 330 - 150, -40);
      c.fill();
    }
    halftone(c, "rgba(255,255,255,.35)", W / 2, 560, 640, 24, true);
    // ciudad y nubes blancas abajo
    c.fillStyle = "rgba(255,255,255,.92)";
    const bs = [
      [0, 60, 90],
      [80, 110, 70],
      [150, 80, 110],
      [260, 140, 60],
      [330, 70, 120],
      [410, 100, 80],
      [510, 90, 100],
      [600, 120, 70],
    ];
    for (const [x, h, w] of bs) c.fillRect(x, H - h - 60, w, h + 60);
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.arc(
        i * 92 + 20,
        H - 40 + hash(i, 2) * 20,
        70 + hash(i, 7) * 30,
        0,
        TAU,
      );
      c.fill();
    }
    web(c, 0, 0, 330, 7, 6, "rgba(255,255,255,.75)", 3, 0, Math.PI / 2);
    web(c, W, 0, 330, 7, 6, "rgba(255,255,255,.75)", 3, Math.PI / 2, Math.PI);
  });
}

function navyBg(ctx: CanvasRenderingContext2D, key: string) {
  staticLayer(ctx, key, (c) => {
    c.fillStyle = vGradient(c, 0, H, [
      [0, "#1b4fb8"],
      [1, "#0c2c78"],
    ]);
    c.fillRect(0, 0, W, H);
    halftone(c, "rgba(6,24,80,.35)", W, H, 800, 24);
    halftone(c, "rgba(120,180,255,.18)", 0, 0, 600, 24);
    web(c, 0, 0, 520, 8, 8, "rgba(235,60,60,.85)", 4, 0, Math.PI / 2);
    web(
      c,
      W,
      H,
      520,
      8,
      8,
      "rgba(235,60,60,.85)",
      4,
      Math.PI,
      (3 * Math.PI) / 2,
    );
  });
}

function patternBg(ctx: CanvasRenderingContext2D) {
  staticLayer(ctx, "spidey-pattern", (c) => {
    c.fillStyle = "#eaf0fb";
    c.fillRect(0, 0, W, H);
    for (let row = 0; row < 9; row++) {
      for (let i = 0; i < 6; i++) {
        const x = i * 130 + (row % 2) * 65 + 20;
        spider(c, x, 90 + row * 150, 1.1, 0, "rgba(120,145,200,.3)");
      }
    }
    web(c, 0, H, 420, 8, 7, "rgba(235,60,60,.8)", 4, -Math.PI / 2, 0);
    web(c, W, 0, 420, 8, 7, "rgba(235,60,60,.8)", 4, Math.PI / 2, Math.PI);
  });
}

// ---------------------------------------------------------------- texto y animaciones

type TOpts = {
  from?: "left" | "right" | "up" | "down";
  fill?: string;
  stroke?: string;
  shadow?: string;
  font?: (s: number) => string;
  rot?: number;
};

/** Texto de historieta: relleno, contorno marino y sombra roja; entra con rebote. */
function comicText(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number,
  lt: number,
  start: number,
  o: TOpts = {},
) {
  const p = prog(lt, start, 0.55);
  if (p <= 0) return;
  const e = outBack(p);
  const from = o.from ?? "up";
  const dx =
    from === "left" ? -(1 - e) * 560 : from === "right" ? (1 - e) * 560 : 0;
  const dy =
    from === "up" ? -(1 - e) * 160 : from === "down" ? (1 - e) * 160 : 0;
  ctx.save();
  ctx.translate(x + dx, y + dy);
  if (o.rot) ctx.rotate(o.rot);
  ctx.globalAlpha *= clamp01(p * 3);
  drawText(ctx, str, 0, 0, {
    font: o.font ?? bangers,
    size,
    fill: o.fill ?? WHITE,
    stroke: o.stroke ?? NAVY,
    strokeW: size * 0.16,
    shadow: o.shadow ?? RED,
    shadowDy: size * 0.07,
    spacing: 0.5,
  });
  ctx.restore();
}

/** Entra con rebote desde abajo / el costado y queda flotando suave. */
function bounceIn(
  ctx: CanvasRenderingContext2D,
  lt: number,
  start: number,
  from: "bottom" | "left" | "right" | "pop",
  draw: () => void,
  bob = 6,
) {
  const p = prog(lt, start, 0.8);
  if (p <= 0) return;
  const e = outBack(p);
  ctx.save();
  ctx.globalAlpha *= clamp01(p * 3);
  if (from === "pop") {
    ctx.translate(W / 2, 760);
    ctx.scale(Math.max(0.01, e), Math.max(0.01, e));
    ctx.translate(-W / 2, -760);
  } else {
    ctx.translate(
      from === "left" ? -(1 - e) * 500 : from === "right" ? (1 - e) * 500 : 0,
      from === "bottom" ? (1 - e) * 600 : 0,
    );
  }
  ctx.translate(0, Math.sin(lt * 2.2) * bob);
  draw();
  ctx.restore();
}

function star(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color = WHITE,
  rot = 0,
) {
  starPath(ctx, x, y, 5, r, r * 0.45, -Math.PI / 2 + rot);
  ctx.fillStyle = color;
  ctx.fill();
}

// ---------------------------------------------------------------- los amigos, cada uno con su propia animación

const outBounce = (p: number) => {
  const x = clamp01(p);
  const n = 7.5625;
  const d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x - 1.5 / d) * (x - 1.5 / d) + 0.75;
  if (x < 2.5 / d) return n * (x - 2.25 / d) * (x - 2.25 / d) + 0.9375;
  return n * (x - 2.625 / d) * (x - 2.625 / d) + 0.984375;
};

/** Dibuja la imagen `name` apoyada en (x, y) (centro inferior) dentro de una caja w × h. */
function figure(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  o: { rot?: number; sx?: number; sy?: number; alpha?: number } = {},
) {
  const im = img(name);
  if (!im) return;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.translate(x, y);
  ctx.rotate(o.rot ?? 0);
  ctx.scale(o.sx ?? 1, o.sy ?? 1);
  drawContain(ctx, im, -w / 2, -h, w, h, "bottom");
  ctx.restore();
}

/**
 * Spidey: llega balanceándose colgado de su telaraña (péndulo que se va amortiguando) y después sigue meciéndose
 * un poco. `x`/`y` es dónde queda apoyado (centro inferior) al terminar.
 */
function spideyFigure(
  ctx: CanvasRenderingContext2D,
  lt: number,
  start: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const t = lt - start;
  if (t < 0 || !img("spidey")) return;
  const ax = x;
  const ay = -60;
  const L = y - h / 2 - ay;
  const decay = Math.exp(-1.25 * t);
  const th =
    0.62 * decay * Math.cos(5.4 * t) + 0.035 * Math.sin(1.7 * t) * (1 - decay);
  const px = ax + Math.sin(th) * L;
  const py = ay + Math.cos(th) * L;
  ctx.save();
  ctx.globalAlpha *= clamp01(t * 5);
  // hilo de telaraña
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(px - Math.sin(th) * h * 0.3, py - Math.cos(th) * h * 0.3);
  ctx.stroke();
  ctx.translate(px, py);
  ctx.rotate(th * 0.8);
  const im = img("spidey");
  if (im) drawContain(ctx, im, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/** Gwen (Ghost-Spider): se desliza flotando desde el costado, con un brillo que titila y destellos que quedan atrás. */
function gwenFigure(
  ctx: CanvasRenderingContext2D,
  lt: number,
  start: number,
  x: number,
  y: number,
  w: number,
  h: number,
  from: "left" | "right" = "left",
) {
  const t = lt - start;
  if (t < 0 || !img("gwen")) return;
  const p = clamp01(t / 1.1);
  const e = outCubic(p);
  const dir = from === "left" ? -1 : 1;
  const px = x + dir * (1 - e) * 520;
  const py = y + Math.sin(t * 2.3) * 14 - (1 - e) * 60;
  const shimmer = 0.86 + 0.14 * Math.sin(t * 6);
  // destellos que va dejando
  if (p < 1 || t < 2.5) {
    for (let i = 0; i < 5; i++) {
      const age = (t * 1.6 + i * 0.2) % 1;
      const sx = px - dir * (30 + age * 120) + Math.sin(i * 3) * 20;
      const sy = py - h * 0.5 + Math.sin(i * 5 + t * 2) * 30;
      ctx.save();
      ctx.globalAlpha *= (1 - age) * clamp01(t * 3);
      ctx.fillStyle = i % 2 ? "#ffffff" : "#ff7ad9";
      ctx.beginPath();
      ctx.arc(sx, sy, 4 + (1 - age) * 5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  figure(ctx, "gwen", px, py, w, h, {
    rot: Math.sin(t * 1.7) * 0.07 - dir * (1 - e) * 0.35,
    alpha: clamp01(t * 4) * shimmer,
  });
}

/** Miles: cae desde arriba con rebotes y después da saltitos cada tanto (se estira al saltar y se aplasta al caer). */
function milesFigure(
  ctx: CanvasRenderingContext2D,
  lt: number,
  start: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const t = lt - start;
  if (t < 0 || !img("miles")) return;
  const p = clamp01(t / 0.9);
  let dy = -(1 - outBounce(p)) * (y + h + 40);
  let sx = 1;
  let sy = 1;
  if (p >= 1) {
    // saltito: cada 1,8 s, durante 0,55 s
    const ph = ((t - 0.9) % 1.8) / 0.55;
    if (ph < 1) {
      const up = Math.sin(ph * Math.PI);
      dy = -up * 70;
      sx = 1 - 0.06 * up;
      sy = 1 + 0.1 * up;
    } else if (ph < 1.25) {
      const land = Math.sin(((ph - 1) / 0.25) * Math.PI);
      sx = 1 + 0.1 * land;
      sy = 1 - 0.1 * land;
    }
  } else if (p > 0.9) {
    sx = 1.06;
    sy = 0.94;
  }
  figure(ctx, "miles", x, y + dy, w, h, {
    sx,
    sy,
    alpha: clamp01(t * 6),
    rot: p < 1 ? (1 - p) * 0.25 : 0,
  });
}

// ---------------------------------------------------------------- bloques

/** 1. El emblema aparece, se hincha y estalla: de la telaraña sale Spidey. */
function sceneEmblem(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  webBg(ctx);
  const emb = img("emblema");
  const cx = W / 2;
  const cy = 560;
  // emblema: pop, latido y salida hacia el centro
  const inP = prog(lt, 0.15, 0.7);
  const out = prog(lt, 1.5, 0.35);
  if (inP > 0 && out < 1) {
    const sc =
      Math.max(0.01, outBack(inP)) *
      (1 + Math.sin(lt * 7) * 0.025 * (1 - out)) *
      (1 - outCubic(out)) *
      (1 + out * 0.4);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((1 - outCubic(inP)) * -0.8 + out * 0.9);
    ctx.scale(sc, sc);
    glow(ctx, 0, 0, 340, "rgba(255,255,255,.4)");
    if (emb) drawContain(ctx, emb, -190, -190, 380, 380);
    else emblemFallback(ctx, 0, 0, 190);
    ctx.restore();
  }
  // estallido
  const bp = prog(lt, 1.6, 0.5);
  if (bp > 0) {
    const R = 120 + outBack(bp) * 270;
    ctx.save();
    ctx.translate(cx, cy);
    burstPath(ctx, 0, 0, R, 16, lt * 0.05);
    ctx.fillStyle = SKY;
    ctx.fill();
    ctx.save();
    ctx.clip();
    halftone(
      ctx,
      "rgba(255,255,255,.35)",
      W / 2 - cx + 0,
      H / 2 - cy + 80,
      420,
      20,
    );
    ctx.restore();
    ctx.lineWidth = 8;
    ctx.strokeStyle = WHITE;
    ctx.stroke();
    ctx.restore();
  }
  // Spidey sale del estallido
  const sp = img("spidey-salida");
  if (sp) {
    const p = prog(lt, 1.9, 0.7);
    if (p > 0) {
      const e = outBack(p);
      ctx.save();
      ctx.globalAlpha *= clamp01(p * 3);
      ctx.translate(cx, cy + 40 + Math.sin(lt * 3) * 8);
      ctx.scale(Math.max(0.01, e), Math.max(0.01, e));
      ctx.rotate(Math.sin(lt * 2) * 0.04);
      drawContain(ctx, sp, -270, -310, 540, 620);
      ctx.restore();
    }
  }
  comicText(
    ctx,
    "¡LLEGÓ LA FIESTA!",
    W / 2,
    1090,
    fitSize(ctx, "¡LLEGÓ LA FIESTA!", bangers, 620, 110),
    lt,
    2.3,
    { from: "down", rot: -0.03 },
  );
  void c;
}

/** 2. "¡Estás invitado a la fiesta de…!" con los tres héroes. */
function sceneInvited(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  skyBg(ctx);
  comicText(ctx, "¡TE INVITAMOS", W / 2, 150, 84, lt, 0.1, { from: "up" });
  comicText(ctx, "A LA FIESTA DE", W / 2, 232, 70, lt, 0.35, { from: "up" });
  const nm = c.name.toLocaleUpperCase("es");
  comicText(
    ctx,
    nm + "!",
    W / 2,
    365,
    fitSize(ctx, nm, bangers, 620, 150),
    lt,
    0.7,
    { from: "down", fill: WHITE },
  );
  // estrellas
  for (const [x, y, r, at] of [
    [70, 330, 28, 0.9],
    [650, 300, 22, 1.1],
    [90, 520, 18, 1.3],
    [640, 520, 26, 1.0],
  ] as const) {
    const p = prog(lt, at, 0.4);
    if (p > 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(lt * 0.6);
      star(
        ctx,
        0,
        0,
        r * Math.max(0.01, outBack(p)) * (1 + Math.sin(lt * 4 + x) * 0.08),
      );
      ctx.restore();
    }
  }
  // cada amigo entra a su manera: Gwen se desliza flotando, Miles cae con rebotes y Spidey llega balanceándose
  gwenFigure(ctx, lt, 0.9, 150, 830, 330, 270);
  milesFigure(ctx, lt, 1.3, 575, 800, 230, 292);
  spideyFigure(ctx, lt, 1.7, 360, 1185, 540, 442);
  if (!img("spidey") && !img("gwen") && !img("miles"))
    comicText(ctx, "¡SPIDEY Y SUS AMIGOS!", W / 2, 800, 80, lt, 1.0, {
      from: "down",
    });
}

/** 3. "¡Acompañanos a celebrar!" con la foto del cumpleañero. */
function scenePhoto(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  navyBg(ctx, "spidey-navy-a");
  comicText(
    ctx,
    "ACOMPAÑANOS",
    W / 2,
    190,
    fitSize(ctx, "ACOMPAÑANOS", bangers, 600, 120),
    lt,
    0.1,
    { from: "left", fill: YELLOW, shadow: NAVY, rot: -0.05 },
  );
  comicText(
    ctx,
    "A CELEBRAR",
    W / 2,
    290,
    fitSize(ctx, "A CELEBRAR", bangers, 560, 110),
    lt,
    0.35,
    { from: "right", fill: YELLOW, shadow: NAVY, rot: -0.05 },
  );
  // foto en círculo con aro rojo
  const p = prog(lt, 0.6, 0.8);
  if (p > 0) {
    const cx = W / 2;
    const cy = 700;
    const r = 220;
    ctx.save();
    ctx.translate(cx, cy);
    const s = Math.max(0.01, outBack(p));
    ctx.scale(s, s);
    ctx.rotate((1 - outCubic(p)) * 0.5);
    ctx.translate(-cx, -cy);
    glow(ctx, cx, cy, r * 1.6, "rgba(255,255,255,.25)");
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 14, 0, TAU);
    ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    drawPhotoIn(ctx, c.photo, "circle", cx, cy, r, () => {
      const emb = img("emblema");
      if (emb)
        drawContain(ctx, emb, cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6);
      else {
        const txt = String(c.age);
        const fs = fitSize(ctx, txt, bangers, r * 1.4, 360);
        drawText(ctx, txt, cx, cy + fs * 0.3, {
          font: bangers,
          size: fs,
          fill: WHITE,
          stroke: NAVY,
          strokeW: fs * 0.1,
        });
      }
    });
    ctx.restore();
  }
  comicText(
    ctx,
    `¡CUMPLE ${c.age}!`,
    W / 2,
    1090,
    fitSize(ctx, `¡CUMPLE ${c.age}!`, bangers, 600, 130),
    lt,
    1.3,
    { from: "down" },
  );
  // Gwen flota a un costado y Miles hace saltitos al otro
  gwenFigure(ctx, lt, 1.5, 115, 1272, 200, 164, "left");
  milesFigure(ctx, lt, 1.9, 610, 1272, 135, 172);
  if (!img("gwen") && !img("miles"))
    for (let i = 0; i < 3; i++) {
      const x = ((lt * 90 + i * 260) % (W + 160)) - 80;
      spider(ctx, x, 1215 + (i % 2) * 24, 1.3, lt + i, "#07173f");
    }
}

type Row = { label: string; value: string; at: number; hint?: string[] };

/** 4. Tarjeta de datos. */
function sceneData(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  navyBg(ctx, "spidey-navy-b");
  const nm = c.name.toLocaleUpperCase("es");
  comicText(ctx, nm, W / 2, 190, fitSize(ctx, nm, bangers, 580, 130), lt, 0.1, {
    from: "up",
  });
  // "CUMPLE" y la edad juntos, como un solo grupo a la izquierda de Spidey
  ctx.save();
  ctx.font = bangers(70);
  const cwv = ctx.measureText("CUMPLE").width + 6;
  ctx.restore();
  const gxv = 290 - (cwv + 14 + 192) / 2;
  comicText(ctx, "CUMPLE", gxv + cwv / 2, 300, 70, lt, 0.4, {
    from: "left",
    fill: SKY_L,
    shadow: NAVY,
  });
  // edad en una insignia roja
  const ap = prog(lt, 0.7, 0.6);
  if (ap > 0) {
    ctx.save();
    ctx.translate(gxv + cwv + 14 + 96, 285);
    const s = Math.max(0.01, outBack(ap)) * 0.8;
    ctx.scale(s, s);
    ctx.rotate(-0.1 + Math.sin(lt * 3) * 0.03);
    ctx.fillStyle = WHITE;
    burstPath(ctx, 0, 0, 120, 12, 0.2);
    ctx.fill();
    ctx.fillStyle = RED;
    burstPath(ctx, 0, 0, 108, 12, 0.2);
    ctx.fill();
    const as = fitSize(ctx, String(c.age), bangers, 120, 150);
    drawText(ctx, String(c.age), 0, as * 0.34, {
      font: bangers,
      size: as,
      fill: WHITE,
      stroke: NAVY,
      strokeW: as * 0.1,
    });
    ctx.restore();
  }
  const sp = img("spidey-salida");
  if (sp)
    bounceIn(
      ctx,
      lt,
      1.0,
      "right",
      () => drawContain(ctx, sp, 470, 180, 250, 300),
      4,
    );
  const rows: Row[] = [
    {
      label: "FECHA",
      value: dateLine(c).toLocaleUpperCase("es"),
      hint: dateParts(c).map((x) => x.toLocaleUpperCase("es")),
      at: 1.1,
    },
    { label: "HORA", value: c.time.toLocaleUpperCase("es"), at: 1.7 },
    { label: "LUGAR", value: c.venue.toLocaleUpperCase("es"), at: 2.3 },
    { label: "DIRECCIÓN", value: c.address.toLocaleUpperCase("es"), at: 2.9 },
  ];
  // un único tamaño para todos los datos; solo se pasa a dos líneas lo que no entra en una (la tarjeta crece)
  const { size: vsz, lines: split } = uniformRows(
    ctx,
    rows.map((r) => ({ text: r.value, hint: r.hint })),
    fredoka,
    W - 190,
    46,
    22,
    (_sz, ls) =>
      560 +
        ls.reduce((a, l) => a + (l.length > 1 ? 168 + 24 : 118 + 32), 0) -
        32 <=
      1262,
  );
  let cardY = 560;
  rows.forEach((r, i) => {
    const lines = split[i];
    const h = lines.length > 1 ? 168 : 118;
    const y = cardY;
    cardY += h + (lines.length > 1 ? 24 : 32);
    const p = prog(lt, r.at, 0.5);
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha *= clamp01(p * 2);
    ctx.translate(-(1 - outCubic(p)) * 700, 0);
    ctx.fillStyle = "rgba(5,20,70,.62)";
    roundRectPath(ctx, 40, y, W - 80, h, 26);
    ctx.fill();
    ctx.fillStyle = RED;
    roundRectPath(ctx, 40, y, 16, h, 8);
    ctx.fill();
    spider(ctx, 100, y + h / 2, 1.1, lt, WHITE);
    drawText(ctx, r.label, 150, y + 40, {
      font: bangers,
      size: 36,
      fill: YELLOW,
      align: "left",
      spacing: 1.5,
    });
    const vs = vsz;
    lines.forEach((l, j) =>
      drawText(ctx, l, 150, y + (lines.length > 1 ? 92 : 94) + j * (vs + 4), {
        font: fredoka,
        size: vs,
        fill: WHITE,
        align: "left",
      }),
    );
    ctx.restore();
  });
}

/** 5. Cierre. */
function sceneClose(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  patternBg(ctx);
  const emb = img("emblema");
  const p = prog(lt, 0.1, 0.8);
  if (p > 0) {
    ctx.save();
    ctx.translate(W / 2, 330);
    const s = Math.max(0.01, outBack(p));
    ctx.scale(s, s);
    ctx.rotate(Math.sin(lt * 2) * 0.05);
    glow(ctx, 0, 0, 260, "rgba(255,255,255,.7)");
    if (emb) drawContain(ctx, emb, -150, -150, 300, 300);
    else emblemFallback(ctx, 0, 0, 150);
    ctx.restore();
  }
  comicText(
    ctx,
    "¡TE ESPERO!",
    W / 2,
    640,
    fitSize(ctx, "¡TE ESPERO!", bangers, 620, 140),
    lt,
    0.6,
    { from: "down", rot: -0.03 },
  );
  const nm = c.name.toLocaleUpperCase("es");
  comicText(ctx, nm, W / 2, 770, fitSize(ctx, nm, bangers, 560, 100), lt, 1.0, {
    from: "up",
    fill: YELLOW,
    shadow: NAVY,
  });
  gwenFigure(ctx, lt, 1.2, 135, 1080, 270, 221, "left");
  milesFigure(ctx, lt, 1.6, 610, 1255, 210, 267);
  spideyFigure(ctx, lt, 1.0, 360, 1262, 430, 352);
  confetti(ctx, lt, {
    count: 40,
    colors: [RED, BLUE, WHITE, SKY, YELLOW],
    seed: 12,
    speed: 1.0,
  });
}

/** Barrido con telaraña que tapa el corte entre bloques. */
function webWipe(ctx: CanvasRenderingContext2D, t: number, cut: number) {
  const p = prog(t, cut - 0.3, 0.6);
  if (p <= 0 || p >= 1) return;
  const x = lerp(-W * 1.5, W * 1.5, p);
  ctx.save();
  ctx.translate(x, 0);
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 520, -10);
  ctx.lineTo(W / 2 - 380, -10);
  ctx.lineTo(W / 2 - 680, H + 10);
  ctx.lineTo(W / 2 - 820, H + 10);
  ctx.fill();
  ctx.fillStyle = BLUE_D;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 390, -10);
  ctx.lineTo(W / 2 + 530, -10);
  ctx.lineTo(W / 2 + 230, H + 10);
  ctx.lineTo(W / 2 - 690, H + 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W / 2 - 390, -10);
  ctx.lineTo(W / 2 + 530, -10);
  ctx.lineTo(W / 2 + 230, H + 10);
  ctx.lineTo(W / 2 - 690, H + 10);
  ctx.clip();
  web(ctx, W / 2 + 70, H / 2, 900, 12, 8, "rgba(255,255,255,.35)", 5);
  ctx.restore();
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(W / 2 + 540, -10);
  ctx.lineTo(W / 2 + 590, -10);
  ctx.lineTo(W / 2 + 290, H + 10);
  ctx.lineTo(W / 2 + 240, H + 10);
  ctx.fill();
  ctx.restore();
}

const SCENES = [sceneEmblem, sceneInvited, scenePhoto, sceneClose, sceneData];

function draw(
  ctx: CanvasRenderingContext2D,
  f: { t: number; content: TemplateContent },
) {
  const { t, content: c } = f;
  let i = 0;
  while (i < SCENES.length - 1 && t >= CUTS[i + 1]) i++;
  SCENES[i](ctx, t - CUTS[i], c);
  for (let k = 1; k < SCENES.length; k++) webWipe(ctx, t, CUTS[k]);
  const fin = 1 - prog(t, 0, 0.3);
  if (fin > 0) {
    ctx.fillStyle = `rgba(255,255,255,${fin})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Imagen 1080×1920: el fondo azul con telarañas rojas del video, nombre y edad en estallido, los tres héroes y los datos. */
function poster(ctx: CanvasRenderingContext2D, c: TemplateContent) {
  const lt = 10; // todo ya entró
  navyBg(ctx, "spidey-navy-b");
  const nm = c.name.toLocaleUpperCase("es");
  comicText(
    ctx,
    nm,
    W / 2,
    c.photo ? 150 : 165,
    fitSize(ctx, nm, bangers, 620, c.photo ? 120 : 135),
    lt,
    0,
    {
      from: "up",
      rot: c.photo ? 0 : -0.02,
    },
  );
  const age = String(c.age);
  const ageBurst = (x: number, y: number, R: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.1);
    ctx.fillStyle = WHITE;
    burstPath(ctx, 0, 0, R, 12, 0.2);
    ctx.fill();
    ctx.fillStyle = RED;
    burstPath(ctx, 0, 0, R * 0.9, 12, 0.2);
    ctx.fill();
    const as = fitSize(ctx, age, bangers, R * 1.0, R * 1.3);
    drawText(ctx, age, 0, as * 0.34, {
      font: bangers,
      size: as,
      fill: WHITE,
      stroke: NAVY,
      strokeW: as * 0.1,
    });
    ctx.restore();
  };
  const fig = (name: string, x: number, h: number, bottom = 800, rot = 0) => {
    const im = img(name);
    if (!im) return;
    const w = (im.width / im.height) * h;
    ctx.save();
    // gira sobre su centro (para enderezar la pose)
    ctx.translate(x, bottom - h / 2);
    ctx.rotate(rot);
    ctx.translate(-x, -(bottom - h / 2));
    ctx.shadowColor = "rgba(0,10,50,.5)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(im, x - w / 2, bottom - h, w, h);
    ctx.restore();
  };
  if (c.photo) {
    // título centrado (nombre y, debajo, "CUMPLE" + la edad en un estallido), foto en círculo con aro rojo y blanco
    // y Spidey saliendo en el medio, debajo de la foto
    const cx = W / 2;
    const cy = 455;
    const r = 135;
    glow(ctx, cx, cy, r * 1.6, "rgba(255,255,255,.25)");
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 22, 0, TAU);
    ctx.fill();
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    drawPhotoIn(ctx, c.photo, "circle", cx, cy, r);
    const cs = 62;
    const R = 60;
    ctx.save();
    ctx.font = bangers(cs);
    const cw = ctx.measureText("CUMPLE").width + 6;
    ctx.restore();
    const gx = cx - (cw + 18 + R * 2) / 2;
    comicText(ctx, "CUMPLE", gx + cw / 2, 225 + cs * 0.35, cs, lt, 0, {
      fill: SKY_L,
      shadow: NAVY,
    });
    ageBurst(gx + cw + 18 + R, 225, R);
    fig("gwen", 100, 250, 815);
    fig("miles", 620, 250, 815);
    fig("spidey-salida", cx, 250, 818);
  } else {
    ctx.save();
    ctx.font = bangers(80);
    const cwp = ctx.measureText("CUMPLE").width + 6;
    ctx.restore();
    const gxp = (W - (cwp + 16 + 256)) / 2;
    comicText(ctx, "CUMPLE", gxp + cwp / 2, 290, 80, lt, 0, {
      fill: SKY_L,
      shadow: NAVY,
    });
    ageBurst(gxp + cwp + 16 + 128, 270, 128);
    fig("gwen", 95, 330);
    fig("miles", 625, 330);
    // Spidey, en el centro, más grande y derecho
    fig("spidey", 360, 380, 815, -0.55);
  }
  // datos: mismas tarjetas oscuras con barra roja y arañita que el bloque de datos del video
  const rows = [
    {
      label: "FECHA",
      value: dateLine(c).toLocaleUpperCase("es"),
      hint: dateParts(c).map((x) => x.toLocaleUpperCase("es")),
    },
    { label: "HORA", value: c.time.toLocaleUpperCase("es") },
    { label: "LUGAR", value: c.venue.toLocaleUpperCase("es") },
    { label: "DIRECCIÓN", value: c.address.toLocaleUpperCase("es") },
  ];
  // un único tamaño para todos los datos; solo se pasa a dos líneas lo que no entra en una (la tarjeta crece)
  const { size: psz, lines: psplit } = uniformRows(
    ctx,
    rows.map((r) => ({ text: r.value, hint: r.hint })),
    fredoka,
    W - 190,
    42,
    22,
    (sz, ls) =>
      ls.reduce(
        (a, l) => a + (l.length > 1 ? 54 + l.length * (sz + 4) : 80),
        0,
      ) +
        (ls.length - 1) * 10 <=
      1262 - 820,
  );
  // si las tarjetas no entran en el alto, las de una línea se achican un poco
  const twoH = 54 + 2 * (psz + 4);
  const nOne = psplit.filter((l) => l.length === 1).length;
  const nTwo = psplit.length - nOne;
  const over = nTwo * twoH + nOne * 98 + (rows.length - 1) * 10 - (1262 - 820);
  const oneH = over > 0 ? Math.max(80, 98 - over / nOne) : 98;
  let py = 820;
  rows.forEach((r, i) => {
    const lines = psplit[i];
    const two = lines.length > 1;
    const h = two ? twoH : oneH;
    const y = py;
    py += h + 10;
    ctx.fillStyle = "rgba(5,20,70,.7)";
    roundRectPath(ctx, 40, y, W - 80, h, 24);
    ctx.fill();
    ctx.fillStyle = RED;
    roundRectPath(ctx, 40, y, 14, h, 7);
    ctx.fill();
    spider(ctx, 98, y + h / 2, 1.0, 0, WHITE);
    const sm = !two && oneH < 90;
    drawText(ctx, r.label, 146, y + (sm ? 28 : 34), {
      font: bangers,
      size: sm ? 26 : 30,
      fill: YELLOW,
      align: "left",
      spacing: 1.5,
    });
    const vs = psz;
    lines.forEach((l, j) =>
      drawText(ctx, l, 146, y + (two ? 80 : sm ? 66 : 80) + j * (vs + 4), {
        font: fredoka,
        size: vs,
        fill: WHITE,
        align: "left",
      }),
    );
  });
}

/** Estilo de las imágenes de Mercado Libre: el fondo azul con telarañas rojas y las letras de historieta. */
const mlStyle: MlStyle = {
  background: (ctx) => navyBg(ctx, "spidey-navy-b"),
  window: { datos: 560, pasos: 280 },
  characters: ["gwen", "spidey-salida", "miles"],
  charScale: [0.85, 1.3, 0.85],
  charGap: -10,
  charX: 470,
  charHeight: 600,
  decor: ["emblema"],
  font: bangers,
  title: (ctx, lines, cx, y, maxW) => {
    const s = Math.min(
      ...lines.map((l) => fitSize(ctx, l, bangers, maxW, 150, 36)),
    );
    lines.forEach((l, i) => {
      const b = y + s * (0.9 + i * 1.0);
      drawText(ctx, l, cx, b, {
        font: bangers,
        size: s,
        fill: WHITE,
        stroke: NAVY,
        strokeW: s * 0.16,
        shadow: RED,
        shadowDy: s * 0.07,
        spacing: 0.5,
      });
    });
    return y + s * (0.9 + (lines.length - 1));
  },
  heading: (ctx, str, x, baseline, size, align) =>
    drawText(ctx, str, x, baseline, {
      font: bangers,
      size,
      fill: YELLOW,
      stroke: NAVY,
      strokeW: size * 0.16,
      shadow: RED,
      shadowDy: size * 0.06,
      align,
      spacing: 0.5,
    }),
  label: (ctx, str, x, baseline, size, align) =>
    drawText(ctx, str, x, baseline, {
      font: bangers,
      size,
      fill: WHITE,
      stroke: NAVY,
      strokeW: size * 0.16,
      shadow: RED,
      shadowDy: size * 0.05,
      align,
      spacing: 0.5,
    }),
  accent: YELLOW,
  ink: NAVY,
  panelPasos: { fill: "rgba(8,24,80,.74)", border: "#ffffff" },
};

export const spidey: TemplateDefinition = {
  id: "spidey",
  name: "Spidey y sus amigos",
  description:
    "Telaraña azul, emblema, Spidey, Ghost-Spider (Gwen) y Miles: estás invitado, tu foto, los datos y un cierre con arañitas.",
  category: "Superhéroes",
  audience: "infantil",
  palette: [BLUE, RED, SKY, NAVY],
  fonts: ["Bangers", "Fredoka"],
  // imágenes en public/templates/spidey/ (se pueden reemplazar; ver el README de esa carpeta)
  assets: ["emblema", "spidey-salida", "spidey", "gwen", "miles"],
  duration: DURATION,
  fps: 24,
  defaultAudioId: "telarana",
  photoRule:
    "La foto va en un círculo con aro rojo en el tercer bloque; sin foto se muestra el emblema.",
  thumbnailTime: 5.6,
  draw,
  poster,
  ml: mlStyle,
};
