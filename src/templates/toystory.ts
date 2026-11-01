// Plantilla "Juguetes en acción". Guion:
//   1. "¡Hay una nueva aventura por comenzar!"
//   2. "{NOMBRE} cumple {EDAD}": el nombre es el protagonista; una estrella de sheriff con la foto y los juguetes alrededor
//   3. "¡Agendá esta misión!": día, fecha y horario
//   4. "¡Nos encontramos en…!": salón y dirección
//   5. "¡Hasta el infinito y más allá!": Buzz y Woody llegan volando por la izquierda y se quedan en el medio
//   6. Ficha final con fecha, horario y lugar, que se queda unos segundos quieta
// Papel tapiz de nubes (una sola imagen de nube, espejada y a distintos tamaños, que se desplaza despacio), zócalo y
// piso de madera. Los títulos usan Gill Sans Ultra Bold en mayúsculas, con el estilo del logo (amarillo, contorno azul).
// Todas las imágenes están en public/templates/toystory/ y se pueden reemplazar (cada personaje es una imagen separada).
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
  vGradient,
  staticLayer,
  drawText,
  fitSize,
  starPath,
  drawPhotoIn,
  twinkles,
  splitLong,
  fitStack,
  fitStackTwo,
  dateLine,
  dateParts,
  uniformRows,
  wrapFit,
} from "./kit";
import { tplImage, drawContain } from "./assets";

const YELLOW_T = "#fff56b";
const YELLOW_B = "#ffc400";
const BLUE_O = "#1f56cc";
const RIM = "#8dbbff";
const NAVY = "#0a2368";
const RED = "#d7151d";
const RED_D = "#9d0d14";
const WHITE = "#ffffff";
const GOLD = "#f2b51a";

/** Gill Sans Ultra Bold (archivo en public/fonts); si no estuviera, una pesada de reemplazo. */
const gill = (s: number) =>
  `${s}px GillSansUltraBold, "Gill Sans Ultra Bold", Anton, Impact, sans-serif`;

const ID = "toystory";
const img = (name: string) => tplImage(ID, name);

// límites de cada bloque (segundos). El último (ficha con fecha, horario y lugar) dura lo suficiente para quedarse quieto.
const CUTS = [0, 3.6, 9.0, 13.6, 18.0, 23.4, 31.4] as const;
const DURATION = CUTS[CUTS.length - 1];
const PUSH = 0.5; // duración del empuje entre bloques

// ---------------------------------------------------------------- fondo: pared de nubes, zócalo y piso

/** Nube dibujada por código (solo si falta la imagen `nube`). */
function cloudFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
) {
  ctx.beginPath();
  ctx.arc(x, y, s * 0.5, 0, TAU);
  ctx.arc(x - s * 0.58, y + s * 0.12, s * 0.36, 0, TAU);
  ctx.arc(x + s * 0.58, y + s * 0.14, s * 0.38, 0, TAU);
  ctx.arc(x + s * 0.18, y - s * 0.26, s * 0.42, 0, TAU);
  ctx.rect(x - s * 0.9, y + s * 0.2, s * 1.8, s * 0.3);
  ctx.fillStyle = "#f4f9fd";
  ctx.fill();
}

function wall(ctx: CanvasRenderingContext2D, time: number) {
  staticLayer(ctx, "toy-wall2", (c) => {
    c.fillStyle = vGradient(c, 0, 1100, [
      [0, "#4698cc"],
      [1, "#56a8da"],
    ]);
    c.fillRect(0, 0, W, H);
    // zócalo
    c.fillStyle = vGradient(c, 1060, 1160, [
      [0, "#ecf0f3"],
      [1, "#c9d1d8"],
    ]);
    c.fillRect(0, 1060, W, 100);
    c.fillStyle = "rgba(0,0,0,.12)";
    c.fillRect(0, 1060, W, 4);
    c.fillStyle = "rgba(255,255,255,.7)";
    c.fillRect(0, 1160, W, 3);
    // piso de madera
    c.fillStyle = vGradient(c, 1163, H, [
      [0, "#e8963a"],
      [1, "#c97a22"],
    ]);
    c.fillRect(0, 1163, W, H - 1163);
    c.strokeStyle = "rgba(120,60,10,.28)";
    c.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.moveTo(i * 120 + 30, 1163);
      c.lineTo(i * 150 - 60, H);
      c.stroke();
    }
    c.fillStyle = "rgba(255,230,160,.22)";
    c.fillRect(0, 1180, W, 18);
  });
  // Una sola nube (imagen) repetida: cada copia va espejada según su lugar y las de más abajo son más chicas.
  // Se desplazan despacio y suben/bajan un poco.
  const cloud = img("nube");
  const P = 200;
  const cols = 6;
  for (let row = 0; row < 7; row++) {
    const scale = lerp(1.25, 0.6, row / 6);
    for (let col = 0; col < cols; col++) {
      const flip = hash(row * 11 + col, 9) > 0.5;
      const x0 = col * P + (row % 2) * (P / 2) + hash(row, 3) * 30;
      const x = ((x0 + time * 7) % (cols * P)) - 140;
      const y =
        100 + row * 150 + Math.sin(time * 0.55 + col * 1.3 + row * 0.9) * 4;
      if (cloud) {
        const w = 150 * scale * (0.9 + hash(row * 7 + col, 5) * 0.25);
        const h = (cloud.height / cloud.width) * w;
        ctx.save();
        ctx.translate(x, y);
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(cloud, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else cloudFallback(ctx, x, y, 38 * scale);
    }
  }
}

// ---------------------------------------------------------------- letras tipo logo (Gill Sans Ultra Bold)

function logoWidth(ctx: CanvasRenderingContext2D, str: string, size: number) {
  ctx.save();
  ctx.font = gill(size);
  let w = 0;
  for (const ch of str) w += ctx.measureText(ch).width + size * 0.015;
  ctx.restore();
  return w;
}

/** Tamaño más grande (≤ `start`) con el que `str` entra en `maxW`. */
function logoFit(
  ctx: CanvasRenderingContext2D,
  str: string,
  maxW: number,
  start: number,
) {
  const w = logoWidth(ctx, str, start);
  // el contorno agrega ancho: se deja margen
  return w > maxW ? Math.max(18, Math.floor((start * maxW) / w)) : start;
}

/** Letras más juntas para la edad (los números anchos de dos cifras se separaban mucho). */
const AGE_TRACK = -0.07;
/** Tamaño de la edad: el más grande (≤ `start`) con el que entra en `maxW`. */
function ageSize(
  ctx: CanvasRenderingContext2D,
  age: string,
  maxW: number,
  start: number,
) {
  const w = logoWidth(ctx, age, start) + [...age].length * start * AGE_TRACK;
  return w > maxW ? Math.floor((start * maxW) / w) : start;
}

/**
 * Título con el estilo del logo: letras amarillas con degradé, contorno azul grueso, borde celeste claro y sombra
 * marino. Cada letra tiene su pequeña inclinación y altura y entra con rebote, una tras otra.
 */
function logoText(
  ctx: CanvasRenderingContext2D,
  str: string,
  cx: number,
  y: number,
  size: number,
  lt: number,
  start: number,
  o: {
    rot?: number;
    stagger?: number;
    flat?: boolean;
    track?: number;
    stairs?: number;
  } = {},
) {
  const stagger = o.stagger ?? 0.04;
  const chars = [...str];
  // `track`: separación extra entre letras (en fracción del tamaño; negativa = más juntas)
  const tr = (o.track ?? 0) * size;
  const total = logoWidth(ctx, str, size) + chars.length * tr;
  ctx.save();
  ctx.translate(cx, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.font = gill(size);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  // posición de cada letra; con `stairs` (cifras de la edad) la de la izquierda va más arriba y por encima
  const xs: number[] = [];
  const cws: number[] = [];
  {
    let px = -total / 2;
    chars.forEach((ch) => {
      const cw = ctx.measureText(ch).width;
      xs.push(px);
      cws.push(cw);
      px += cw + size * 0.015 + tr;
    });
  }
  const order = chars.map((_, i) => i);
  if (o.stairs) order.reverse();
  order.forEach((i) => {
    const ch = chars[i];
    const cw = cws[i];
    const x = xs[i];
    const p = prog(lt, start + i * stagger, 0.42);
    if (p > 0 && ch.trim()) {
      const e = outBack(p);
      const dy =
        Math.cos(i * 1.9) * size * 0.03 -
        (1 - outCubic(p)) * size * 0.8 -
        (o.stairs ? (chars.length - 1 - i) * size * o.stairs : 0);
      const rot = Math.sin(i * 2.7 + 0.6) * 0.045;
      ctx.save();
      ctx.globalAlpha *= clamp01(p * 3);
      ctx.translate(x + cw / 2, dy);
      ctx.rotate(rot);
      ctx.scale(Math.max(0.01, e), Math.max(0.01, e));
      const dx = -cw / 2;
      if (o.flat) {
        // sobre fondo rojo: solo amarillo (con una sombra del rojo oscuro), sin borde azul
        ctx.fillStyle = RED_D;
        ctx.fillText(ch, dx, size * 0.045);
      } else {
        ctx.strokeStyle = NAVY; // sombra
        ctx.lineWidth = size * 0.27;
        ctx.strokeText(ch, dx + size * 0.015, size * 0.06);
        ctx.strokeStyle = RIM; // borde celeste claro
        ctx.lineWidth = size * 0.24;
        ctx.strokeText(ch, dx, 0);
        ctx.strokeStyle = BLUE_O; // contorno azul
        ctx.lineWidth = size * 0.18;
        ctx.strokeText(ch, dx, 0);
      }
      const g = ctx.createLinearGradient(0, -size * 0.75, 0, size * 0.02);
      g.addColorStop(0, YELLOW_T);
      g.addColorStop(1, YELLOW_B);
      ctx.fillStyle = g;
      ctx.fillText(ch, dx, 0);
      ctx.restore();
    }
  });
  ctx.restore();
}

/** Texto chico en blanco con contorno marino (rótulos). */
function label(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number,
  lt: number,
  start: number,
  align: CanvasTextAlign = "center",
) {
  const p = prog(lt, start, 0.4);
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp01(p * 3);
  ctx.translate(0, (1 - outCubic(p)) * 30);
  drawText(ctx, str, x, y, {
    font: gill,
    size,
    fill: WHITE,
    stroke: NAVY,
    strokeW: size * 0.22,
    align,
    spacing: size * 0.02,
  });
  ctx.restore();
}

/** Cinta roja con un texto de logo adentro. No se le pone brillo: solo el color y una sombra abajo. */
function ribbon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  lt: number,
  start: number,
  rot = -0.03,
) {
  const p = prog(lt, start, 0.5);
  if (p <= 0) return;
  const e = outBack(p);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(Math.max(0.01, e), Math.max(0.01, e));
  ctx.globalAlpha *= clamp01(p * 3);
  const sk = h * 0.16;
  const poly = (dy: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + sk, -h / 2 + dy);
    ctx.lineTo(w / 2, -h / 2 + dy);
    ctx.lineTo(w / 2 - sk, h / 2 + dy);
    ctx.lineTo(-w / 2, h / 2 + dy);
    ctx.closePath();
    ctx.fill();
  };
  poly(h * 0.1, RED_D);
  poly(0, RED);
  ctx.restore();
}

// ---------------------------------------------------------------- personajes (cada uno es una imagen separada)

const bob = (t: number, amp: number, speed: number, phase = 0) =>
  Math.sin(t * speed + phase) * amp;

/** Sube desde abajo con rebote. */
function rise(lt: number, start: number, dist = 600) {
  const p = prog(lt, start, 0.8);
  return { dy: (1 - outBack(p)) * dist, alpha: clamp01(p * 3), p };
}

/** Dibuja la imagen `name` apoyada por abajo en (x, y), con un movimiento de reposo propio. */
function toy(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  w: number | undefined,
  h: number,
  o: {
    dx?: number;
    dy?: number;
    rot?: number;
    sx?: number;
    sy?: number;
    alpha?: number;
    flip?: boolean;
  } = {},
) {
  const im = img(name);
  if (!im) return;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.translate(x + (o.dx ?? 0), y + (o.dy ?? 0));
  ctx.rotate(o.rot ?? 0);
  ctx.scale((o.flip ? -1 : 1) * (o.sx ?? 1), o.sy ?? 1);
  // la altura manda: cada personaje conserva su proporción real (w es sólo un tope opcional)
  const k = Math.min(h / im.height, (w ?? Infinity) / im.width);
  ctx.drawImage(
    im,
    (-im.width * k) / 2,
    -im.height * k,
    im.width * k,
    im.height * k,
  );
  ctx.restore();
}

/**
 * Los juguetes que rodean la pantalla. Cada uno entra a su manera y tiene su propio movimiento:
 * Jessie baila, Rex respira y mueve la cabeza, Forky se balancea, Woody saluda, Buzz flota, Bo se mece, Bullseye rebota y el alien salta.
 * Los que no tengan imagen en la carpeta simplemente no se dibujan.
 */
type Place = {
  name: string;
  x: number;
  y: number;
  /** alto del personaje (el ancho sale de la proporción de su imagen) */
  h: number;
  at: number;
  /** 'top': entra bajando desde arriba (para los que van en la parte alta, así no cruzan el texto) */
  from?: "top";
};
function toys(ctx: CanvasRenderingContext2D, lt: number, places: Place[]) {
  for (const p of places) {
    const r = rise(lt, p.at);
    if (r.p <= 0) continue;
    const t = lt - p.at;
    const o: Parameters<typeof toy>[6] = {
      dy: p.from === "top" ? -r.dy : r.dy,
      alpha: r.alpha,
    };
    switch (p.name) {
      case "jessie":
        o.rot = bob(t, 0.09, 4);
        o.sy = 1 + bob(t, 0.012, 8);
        break;
      case "rex":
        o.sx = 1 + bob(t, 0.012, 2.6);
        o.sy = 1 - bob(t, 0.012, 2.6);
        o.rot = bob(t, 0.03, 1.3);
        break;
      case "forky":
        o.rot = bob(t, 0.07, 2.4);
        break;
      case "woody":
        o.rot = bob(t, 0.05, 3.2);
        o.dx = bob(t, 5, 3.2);
        break;
      case "buzz":
        o.dy = (o.dy ?? 0) + bob(t, 14, 2.1);
        o.rot = bob(t, 0.03, 1.4);
        break;
      case "bopeep":
        o.rot = bob(t, 0.045, 1.8);
        break;
      case "bunny":
        o.dy = (o.dy ?? 0) + bob(t, 14, 1.9);
        o.rot = bob(t, 0.12, 1.5);
        break;
      case "alien":
        o.dy = (o.dy ?? 0) + bob(t, 12, 2.5, 1);
        o.rot = bob(t, 0.1, 2.0);
        break;
      case "hamm":
        o.rot = bob(t, 0.05, 2.2);
        o.sy = 1 + bob(t, 0.02, 4.4);
        break;
      case "slinky":
        o.sy = 1 + bob(t, 0.07, 3.0);
        o.sx = 1 - bob(t, 0.04, 3.0);
        break;
      case "zorg":
        o.dy = (o.dy ?? 0) - Math.abs(bob(t, 12, 3.2));
        break;
      case "cara-papa":
        o.rot = bob(t, 0.08, 2.6);
        break;
      case "soldaditos":
        o.sy = 1 + bob(t, 0.025, 5);
        break;
      case "woody-parado":
        o.rot = bob(t, 0.035, 2.4);
        o.sy = 1 + bob(t, 0.012, 4.8);
        break;
      case "buzz-parado":
        o.dy = (o.dy ?? 0) + bob(t, 9, 2.2);
        o.rot = bob(t, 0.025, 1.7);
        break;
      case "bullseye":
        o.dy = (o.dy ?? 0) - Math.abs(bob(t, 18, 5.5));
        break;
      case "alien":
        o.dy = (o.dy ?? 0) - Math.abs(bob(t, 30, 3.5));
        break;
      default:
        o.dy = (o.dy ?? 0) + bob(t, 6, 2);
    }
    toy(ctx, p.name, p.x, p.y, undefined, p.h, o);
  }
}

// ---------------------------------------------------------------- bloques

/** 1. Introducción. */
function sceneIntro(ctx: CanvasRenderingContext2D, lt: number) {
  // tres líneas con poco interlineado: cada una apoya a una distancia proporcional a su propio tamaño
  const h1 = logoFit(ctx, "¡HAY UNA", 560, 130);
  const h2 = logoFit(ctx, "NUEVA AVENTURA", 640, 120);
  const h3 = logoFit(ctx, "POR COMENZAR!", 640, 120);
  const y1 = 400;
  const y2 = y1 + h2 * 1.0 + 8;
  const y3 = y2 + h3 * 1.0;
  logoText(ctx, "¡HAY UNA", W / 2, y1, h1, lt, 0.1, { rot: -0.04 });
  logoText(ctx, "NUEVA AVENTURA", W / 2, y2, h2, lt, 0.5, { rot: -0.04 });
  logoText(ctx, "POR COMENZAR!", W / 2, y3, h3, lt, 1.0, { rot: -0.04 });
  toys(ctx, lt, [
    { name: "jessie", x: 130, y: 1200, h: 400, at: 0.9 },
    { name: "rex", x: 545, y: 1260, h: 300, at: 1.2 },
    { name: "forky", x: 330, y: 1280, h: 230, at: 1.5 },
    { name: "alien", x: 105, y: 260, h: 120, at: 0.6, from: "top" },
    { name: "bunny", x: 615, y: 285, h: 190, at: 0.9, from: "top" },
  ]);
}

/** Estrella de sheriff con puntas redondeadas y la foto (o una estrella) en el centro. */
function sheriffStar(
  ctx: CanvasRenderingContext2D,
  c: TemplateContent,
  cx: number,
  cy: number,
  R: number,
  lt: number,
  start: number,
) {
  const p = prog(lt, start, 0.9);
  if (p <= 0) return;
  ctx.save();
  ctx.translate(cx, cy);
  const s = Math.max(0.01, outBack(p));
  ctx.scale(s, s);
  ctx.rotate((1 - outCubic(p)) * 2.2 + bob(lt, 0.03, 1.5));
  ctx.shadowColor = "rgba(0,30,80,.4)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 14;
  starPath(ctx, 0, 0, 5, R, R * 0.5, -Math.PI / 2);
  const g = ctx.createLinearGradient(0, -R, 0, R);
  g.addColorStop(0, "#ffe98a");
  g.addColorStop(0.5, GOLD);
  g.addColorStop(1, "#c88a0c");
  ctx.fillStyle = g;
  ctx.lineJoin = "round";
  ctx.lineWidth = R * 0.07;
  ctx.strokeStyle = "#a8710a";
  ctx.stroke();
  ctx.fill();
  ctx.shadowColor = "transparent";
  // bolitas en las puntas
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 5;
    const bx = Math.cos(a) * R * 0.97;
    const by = Math.sin(a) * R * 0.97;
    const bg = ctx.createRadialGradient(
      bx - R * 0.03,
      by - R * 0.03,
      1,
      bx,
      by,
      R * 0.09,
    );
    bg.addColorStop(0, "#fff3b0");
    bg.addColorStop(1, "#d9980f");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(bx, by, R * 0.09, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#a8710a";
    ctx.lineWidth = R * 0.02;
    ctx.stroke();
  }
  // centro: aro y foto
  const rc = R * 0.46;
  ctx.fillStyle = "#c88a0c";
  ctx.beginPath();
  ctx.arc(0, 0, rc + R * 0.06, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#fff3b0";
  ctx.beginPath();
  ctx.arc(0, 0, rc + R * 0.02, 0, TAU);
  ctx.fill();
  ctx.fillStyle = BLUE_O;
  ctx.beginPath();
  ctx.arc(0, 0, rc, 0, TAU);
  ctx.fill();
  drawPhotoIn(ctx, c.photo, "circle", 0, 0, rc, () => {
    starPath(ctx, 0, R * 0.02, 5, rc * 0.8, rc * 0.4, -Math.PI / 2);
    ctx.fillStyle = YELLOW_B;
    ctx.fill();
  });
  ctx.restore();
}

/** 2. "¡{NOMBRE} cumple {EDAD}!": nombre protagonista, cinta, edad y la estrella de sheriff con la foto. */
function sceneName(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  const nm = c.name.toLocaleUpperCase("es");
  logoText(ctx, nm, W / 2, 250, logoFit(ctx, nm, 620, 150), lt, 0.1, {
    rot: -0.02,
  });
  ribbon(ctx, W / 2, 335, 560, 96, lt, 0.5, 0.015);
  logoText(
    ctx,
    "¡CUMPLE!",
    W / 2,
    362,
    logoFit(ctx, "¡CUMPLE!", 440, 72),
    lt,
    0.8,
    { rot: 0.015, flat: true },
  );
  const age = String(c.age);
  // el centro de la edad queda fijo: con dos o tres cifras se achica sin bajar
  const as = ageSize(ctx, age, 480, 360);
  logoText(ctx, age, W / 2, 530 + as * 0.375, as, lt, 1.2, {
    stagger: 0.1,
    track: AGE_TRACK,
    stairs: 0.09,
  });
  sheriffStar(ctx, c, W / 2, 1000, 235, lt, 1.5);
  toys(ctx, lt, [
    { name: "woody", x: 100, y: 745, h: 300, at: 1.9 },
    { name: "bunny", x: 620, y: 740, h: 205, at: 2.1 },
    { name: "jessie", x: 90, y: 1160, h: 310, at: 2.3 },
    { name: "rex", x: 560, y: 1282, h: 260, at: 2.7 },
    { name: "forky", x: 200, y: 1282, h: 190, at: 2.9 },
    { name: "alien", x: 658, y: 950, h: 105, at: 3.1 },
    { name: "zorg", x: 75, y: 150, h: 130, at: 1.5, from: "top" },
    { name: "soldaditos", x: 645, y: 150, h: 115, at: 1.7, from: "top" },
    { name: "cara-papa", x: 70, y: 432, h: 95, at: 2.5 },
    { name: "hamm", x: 655, y: 565, h: 105, at: 2.7 },
    { name: "slinky", x: 345, y: 1282, h: 100, at: 3.3 },
  ]);
  twinkles(ctx, lt, 6, [WHITE, YELLOW_T], {
    seed: 11,
    y0: 40,
    y1: 200,
    maxR: 16,
  });
}

/** 3. "¡Agendá esta misión!": día, fecha y horario. */
function sceneDate(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  logoText(
    ctx,
    "¡AGENDÁ ESTA",
    W / 2,
    290,
    logoFit(ctx, "¡AGENDÁ ESTA", 620, 120),
    lt,
    0.1,
    { rot: -0.03 },
  );
  logoText(
    ctx,
    "MISIÓN!",
    W / 2,
    415,
    logoFit(ctx, "MISIÓN!", 520, 140),
    lt,
    0.5,
    { rot: -0.03 },
  );
  const day = c.weekday.toLocaleUpperCase("es");
  const date = `${c.day} DE ${c.monthName.toLocaleUpperCase("es")}`;
  ribbon(ctx, W / 2, 575, 640, 170, lt, 0.9, 0.02);
  logoText(ctx, day, W / 2, 565, logoFit(ctx, day, 520, 70), lt, 1.2, {
    rot: 0.02,
    flat: true,
  });
  logoText(ctx, date, W / 2, 635, logoFit(ctx, date, 580, 76), lt, 1.45, {
    rot: 0.02,
    flat: true,
  });
  label(ctx, "A LAS", W / 2, 745, 54, lt, 1.9);
  const time = c.time.toLocaleUpperCase("es");
  logoText(ctx, time, W / 2, 890, logoFit(ctx, time, 600, 190), lt, 2.1, {
    stagger: 0.07,
  });
  toys(ctx, lt, [
    { name: "jessie", x: 115, y: 1275, h: 300, at: 2.6 },
    { name: "rex", x: 570, y: 1285, h: 250, at: 2.9 },
    { name: "forky", x: 300, y: 1290, h: 200, at: 3.2 },
    { name: "alien", x: 100, y: 235, h: 125, at: 0.6, from: "top" },
    { name: "bunny", x: 650, y: 225, h: 170, at: 0.9, from: "top" },
  ]);
}

/**
 * Filas "rótulo + valor" (fecha, horario, lugar, dirección) con un único tamaño de letra para todas: el más grande con el
 * que cada dato entra (en una línea si cabe; si no, en dos) y toda la pila llega hasta `limit` sin pisar a los juguetes.
 */
function stackRows(
  ctx: CanvasRenderingContext2D,
  rows: { label: string; value: string; hint?: string[]; at: number }[],
  o: {
    y0: number;
    smax: number;
    limit: number;
    labelSize: number;
    labelH: number;
    off: number;
    post: number;
    lt: number;
    stagger: number;
  },
) {
  const { size, lines } = uniformRows(
    ctx,
    rows.map((r) => ({ text: r.value, hint: r.hint })),
    gill,
    590,
    o.smax,
    24,
    (s, ls) =>
      o.y0 +
        ls.reduce((a, l) => a + o.labelH + o.post + s * l.length, 0) -
        o.post <=
      o.limit,
  );
  let y = o.y0;
  rows.forEach((r, i) => {
    label(ctx, r.label, W / 2, y, o.labelSize, o.lt, r.at);
    lines[i].forEach((ln, j) =>
      logoText(
        ctx,
        ln,
        W / 2,
        y + o.off + size * 0.95 + j * size,
        size,
        o.lt,
        r.at + 0.2,
        { stagger: o.stagger },
      ),
    );
    y += o.labelH + o.post + size * lines[i].length;
  });
}

function scenePlace(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  logoText(
    ctx,
    "¡NOS ENCONTRAMOS",
    W / 2,
    290,
    logoFit(ctx, "¡NOS ENCONTRAMOS", 640, 110),
    lt,
    0.1,
    { rot: -0.03 },
  );
  logoText(ctx, "EN…!", W / 2, 410, logoFit(ctx, "EN…!", 400, 140), lt, 0.6, {
    rot: -0.03,
  });
  const venue = c.venue.toLocaleUpperCase("es");
  const v1 = logoFit(ctx, venue, 550, 86);
  const vfit =
    v1 >= 56
      ? { lines: [[venue]], size: v1 }
      : uniformRows(ctx, [{ text: venue }], gill, 550, 80, 30, () => true);
  const vlines = vfit.lines[0];
  const addr = c.address.toLocaleUpperCase("es");
  const a1 = fitSize(ctx, addr, gill, 610, 54, 22);
  const afit =
    a1 >= 34
      ? { lines: [[addr]], size: a1 }
      : uniformRows(ctx, [{ text: addr }], gill, 610, 54, 22, () => true);
  const alines = afit.lines[0];
  const two = vlines.length > 1;
  const atwo = alines.length > 1;
  const vs = vfit.size;
  // con datos en dos líneas, todo se junta hacia arriba y los aliens bajan un poco para que la dirección no quede detrás
  const packed = two || atwo;
  const rh = two ? vs * 2 + 60 : 140;
  const rcy = packed ? 428 + rh / 2 : 560;
  ribbon(ctx, W / 2, rcy, 650, rh, lt, 1.0, 0.02);
  vlines.forEach((l, j) =>
    logoText(
      ctx,
      l,
      W / 2,
      rcy + vs * 0.3 + (j - (vlines.length - 1) / 2) * vs,
      vs,
      lt,
      1.3,
      { rot: 0.02, flat: true },
    ),
  );
  const as = afit.size;
  const ay = packed ? rcy + rh / 2 + 24 + as : 710;
  alines.forEach((l, j) =>
    label(ctx, l, W / 2, ay + j * as * 1.1, as, lt, 2.0),
  );
  const alienDrop = packed
    ? Math.min(56, Math.max(0, ay + (alines.length - 1) * as * 1.1 + 30 - 720))
    : 0;
  // los aliens suben desde abajo
  const aliens = img("aliens");
  if (aliens) {
    const a = rise(lt, 1.2, 520);
    ctx.save();
    ctx.globalAlpha *= a.alpha;
    ctx.translate(0, a.dy + bob(lt, 6, 2.2) + alienDrop);
    const k = W / aliens.width;
    ctx.drawImage(
      aliens,
      0,
      H - aliens.height * k * 0.92,
      W,
      aliens.height * k,
    );
    ctx.restore();
  }
  // toys(ctx, lt, [{name: 'forky', x: 100, y: 1000, w: 170, h: 220, at: 2.4}]);
}

/** 5. "¡Hasta el infinito y más allá!": Buzz y Woody entran volando por arriba desde la izquierda y se quedan en el medio. */
function sceneBye(ctx: CanvasRenderingContext2D, lt: number) {
  // primero ellos, así los títulos quedan por encima mientras cruzan
  const fly = img("buzzwoody");
  if (fly) {
    const p = prog(lt, 0.8, 1.9);
    // arranque suave y frenada suave (sin tirón al empezar ni al llegar)
    const e = p * p * (3 - 2 * p);
    // el vaivén de reposo entra de a poco una vez que llegaron
    const rest = prog(lt, 2.7, 0.8);
    // bajan en diagonal desde fuera de la esquina de arriba a la izquierda hasta el medio
    const x = lerp(-560, W / 2, e);
    const y = lerp(-120, 820, e) + bob(lt, 14, 2.0) * rest;
    const rot = lerp(0.42, 0.0, e) + bob(lt, 0.03, 1.6) * rest;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    drawContain(ctx, fly, -300, -170, 600, 340);
    ctx.restore();
  }
  // dos líneas: "¡AL INFINITO..." y "Y MÁS ALLÁ!", del mismo tamaño
  const inf1 = "¡AL INFINITO...";
  const inf2 = "Y MÁS ALLÁ!";
  const infSize = Math.min(logoFit(ctx, inf1, 600, 150), logoFit(ctx, inf2, 600, 150));
  logoText(ctx, inf1, W / 2, 300, infSize, lt, 0.1, { rot: -0.04 });
  logoText(ctx, inf2, W / 2, 300 + infSize * 1.0, infSize, lt, 0.6, { rot: -0.04 });
  twinkles(ctx, lt, 10, [WHITE, YELLOW_T], {
    seed: 5,
    y0: 60,
    y1: 1000,
    maxR: 20,
  });
}

/** 6. Ficha final: fecha, horario y lugar. Es la última pantalla y se queda unos segundos para poder leerla. */
function sceneCard(
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) {
  logoText(
    ctx,
    "¡TE ESPERAMOS!",
    W / 2,
    200,
    logoFit(ctx, "¡TE ESPERAMOS!", 640, 100),
    lt,
    0.1,
    { rot: -0.03 },
  );
  const rows = [
    {
      label: "FECHA",
      value: dateLine(c).toLocaleUpperCase("es"),
      hint: dateParts(c).map((x) => x.toLocaleUpperCase("es")),
      at: 0.6,
    },
    {
      label: "HORARIO",
      value: c.time.toLocaleUpperCase("es"),
      at: 1.2,
    },
    {
      label: "LUGAR",
      value: c.venue.toLocaleUpperCase("es"),
      at: 1.8,
    },
    {
      label: "DIRECCIÓN",
      value: c.address.toLocaleUpperCase("es"),
      at: 2.4,
    },
  ];
  stackRows(ctx, rows, {
    y0: 272,
    smax: 70,
    limit: 925,
    labelSize: 36,
    labelH: 36,
    off: 8,
    post: 72,
    lt,
    stagger: 0.025,
  });
  // los personajes quedan por debajo de la última línea (la dirección)
  toys(ctx, lt, [
    { name: "jessie", x: 70, y: 1285, h: 240, at: 2.6 },
    { name: "rex", x: 610, y: 1290, h: 190, at: 2.9 },
    { name: "buzz-parado", x: 255, y: 1290, h: 300, at: 3.4 },
    { name: "woody-parado", x: 430, y: 1290, h: 360, at: 3.7 },
    { name: "alien", x: 85, y: 150, h: 100, at: 3.6, from: "top" },
    { name: "bunny", x: 635, y: 150, h: 130, at: 3.8, from: "top" },
  ]);
}

type Block = (
  ctx: CanvasRenderingContext2D,
  lt: number,
  c: TemplateContent,
) => void;
const SCENES: Block[] = [
  (ctx, lt) => sceneIntro(ctx, lt),
  sceneName,
  sceneDate,
  scenePlace,
  (ctx, lt) => sceneBye(ctx, lt),
  sceneCard,
];

function drawBlock(
  ctx: CanvasRenderingContext2D,
  i: number,
  t: number,
  lt: number,
  c: TemplateContent,
) {
  wall(ctx, t);
  SCENES[i](ctx, lt, c);
}

function draw(
  ctx: CanvasRenderingContext2D,
  f: { t: number; content: TemplateContent },
) {
  const { t, content: c } = f;
  let i = 0;
  while (i < SCENES.length - 1 && t >= CUTS[i + 1]) i++;
  const lt = t - CUTS[i];
  // empuje: el bloque anterior sale hacia la izquierda y el nuevo entra desde la derecha
  if (i > 0 && lt < PUSH) {
    const e = outCubic(lt / PUSH);
    ctx.save();
    ctx.translate(-e * W, 0);
    drawBlock(ctx, i - 1, t, CUTS[i] - CUTS[i - 1], c);
    ctx.restore();
    ctx.save();
    ctx.translate((1 - e) * W, 0);
    drawBlock(ctx, i, t, lt, c);
    ctx.restore();
  } else drawBlock(ctx, i, t, lt, c);
  // entrada: desde blanco
  const fin = 1 - prog(t, 0, 0.3);
  if (fin > 0) {
    ctx.fillStyle = `rgba(255,255,255,${fin})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Imagen 1080×1920: nombre, edad y los datos a la vez, con los juguetes alrededor. */
function poster(ctx: CanvasRenderingContext2D, c: TemplateContent) {
  const lt = 10; // todo ya entró
  wall(ctx, 3);
  const nm = c.name.toLocaleUpperCase("es");
  const age = String(c.age);
  if (c.photo) {
    // con foto: estrella de sheriff grande y centrada arriba (el nombre apoya sobre su parte baja), la cinta y la edad centrada
    sheriffStar(ctx, c, W / 2, 160, 142, lt, 0);
    logoText(ctx, nm, W / 2, 300, logoFit(ctx, nm, 620, 92), lt, 0, {
      rot: -0.02,
      stagger: 0,
    });
    ribbon(ctx, W / 2, 362, 440, 64, lt, 0, 0.015);
    logoText(
      ctx,
      "¡CUMPLE!",
      W / 2,
      381,
      logoFit(ctx, "¡CUMPLE!", 360, 50),
      lt,
      0,
      { rot: 0.015, flat: true, stagger: 0 },
    );
    const as = ageSize(ctx, age, 430, 170);
    logoText(ctx, age, W / 2, 470 + as * 0.375, as, lt, 0, {
      stagger: 0,
      track: AGE_TRACK,
      stairs: 0.09,
    });
  } else {
    logoText(ctx, nm, W / 2, 148, logoFit(ctx, nm, 620, 125), lt, 0, {
      rot: -0.02,
      stagger: 0,
    });
    ribbon(ctx, W / 2, 223, 500, 78, lt, 0, 0.015);
    logoText(
      ctx,
      "¡CUMPLE!",
      W / 2,
      245,
      logoFit(ctx, "¡CUMPLE!", 400, 62),
      lt,
      0,
      { rot: 0.015, flat: true, stagger: 0 },
    );
    const as = ageSize(ctx, age, 430, 240);
    logoText(ctx, age, W / 2, 368 + as * 0.375, as, lt, 0, {
      stagger: 0,
      track: AGE_TRACK,
      stairs: 0.09,
    });
  }
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
  stackRows(
    ctx,
    rows.map((r) => ({ ...r, at: 0 })),
    {
      y0: c.photo ? 622 : 557,
      smax: c.photo ? 46 : 52,
      limit: 1000,
      labelSize: 28,
      labelH: 26,
      off: 6,
      post: c.photo ? 38 : 44,
      lt,
      stagger: 0,
    },
  );
  toys(ctx, lt, [
    { name: "jessie", x: 62, y: 1280, h: 225, at: 0 },
    { name: "forky", x: 170, y: 1280, h: 150, at: 0 },
    { name: "buzz-parado", x: 285, y: 1280, h: 220, at: 0 },
    { name: "woody-parado", x: 425, y: 1280, h: 264, at: 0 },
    { name: "rex", x: 620, y: 1280, h: 180, at: 0 },
    { name: "alien", x: 70, y: 112, h: 95, at: 0 },
    { name: "bunny", x: 655, y: 118, h: 105, at: 0 },
  ]);
}

/** Estilo de las imágenes de Mercado Libre: la pared de nubes, el piso, las letras del logo y la cinta roja. */
const mlStyle: MlStyle = {
  background: (ctx) => wall(ctx, 3),
  window: { datos: 520, pasos: 120 },
  characters: ["woody-parado", "buzz-parado"],
  charScale: [1.2, 1],
  font: gill,
  title: (ctx, lines, cx, y, maxW) => {
    const s = logoFit(ctx, lines[0], maxW, 150);
    const base = y + s * 0.95;
    logoText(ctx, lines[0], cx, base, s, 10, 0, { rot: -0.02, stagger: 0 });
    if (!lines[1]) return base;
    const rs = Math.min(s * 0.7, logoFit(ctx, lines[1], maxW - 90, 100));
    const h = rs * 1.3;
    const cy = base + 28 + h / 2;
    ribbon(ctx, cx, cy, logoWidth(ctx, lines[1], rs) + 100, h, 10, 0, 0.015);
    logoText(ctx, lines[1], cx, cy + rs * 0.35, rs, 10, 0, {
      rot: 0.015,
      flat: true,
      stagger: 0,
    });
    return cy + h / 2;
  },
  heading: (ctx, str, x, baseline, size, align) =>
    logoText(
      ctx,
      str,
      align === "center" ? x : x + logoWidth(ctx, str, size) / 2,
      baseline,
      size,
      10,
      0,
      { stagger: 0 },
    ),
  label: (ctx, str, x, baseline, size, align) =>
    label(ctx, str, x, baseline, size, 10, 0, align),
  accent: GOLD,
  ink: NAVY,
  panelPasos: { fill: "rgba(14,52,110,.84)", border: RIM },
};

export const toystory: TemplateDefinition = {
  id: "toystory",
  name: "Juguetes en acción",
  description:
    "Pared de nubes que se mueve despacio, títulos tipo logo de película en Gill Sans Ultra Bold, estrella de sheriff con la foto y los juguetes que bailan, vuelan y asoman.",
  category: "Películas",
  audience: "infantil",
  palette: ["#4c9fd2", "#ffc400", RED, BLUE_O],
  fonts: ["GillSansUltraBold"],
  // imágenes en public/templates/toystory/ (se pueden reemplazar; ver el README de esa carpeta)
  assets: [
    "nube",
    "jessie",
    "buzzwoody",
    "forky",
    "rex",
    "aliens",
    "woody",
    "alien",
    "bunny",
    "hamm",
    "slinky",
    "zorg",
    "cara-papa",
    "soldaditos",
    "buzz-parado",
    "woody-parado",
  ],
  duration: DURATION,
  fps: 24,
  defaultAudioId: "juguetes",
  photoRule:
    "La foto va dentro de la estrella de sheriff del segundo bloque; sin foto, la estrella lleva una estrella amarilla en el centro.",
  thumbnailTime: 6.0,
  draw,
  poster,
  ml: mlStyle,
};
