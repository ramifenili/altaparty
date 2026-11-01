// Plantilla "Camino de Gloria": estética de campaña de estadio (azul noche, dorado, tipografía CABJ 1905).
// Escena 1: el título dorado se escribe y aparece el nombre. Un destello lleva a la escena 2, donde la foto
// (o la edad) ocupa el centro y cuatro datos entran con su punto y su línea dorada. Cierre con "¡Te esperamos!".
// Diseño original inspirado en una referencia de video: no usa escudos, marcas ni material oficial.
// Todo es función pura de `t`: cualquier instante se puede dibujar fuera de orden.

import type {TemplateContent, TemplateDefinition} from './types';
import {
	W, H, TAU, clamp01, lerp, prog, outCubic, outBack, hash, glow, vGradient, staticLayer, drawText, fitSize, drawPhotoIn, uniformRows, wrapFit,
} from './kit';

const NAVY = '#06102a';
const BLUE = '#10275a';
const GOLD = '#e9ac27';
const GOLD_SOFT = '#f6d27a';
const LIGHT = '#d9e8f4';
const WHITE = '#ffffff';

const cabj = (s: number) => `${s}px CABJ1905, Impact, sans-serif`;
const mont = (s: number) => `800 ${s}px Montserrat, system-ui, sans-serif`;

// tiempos (segundos)
const FLASH_AT = 3.05; // instante del cambio de escena (el destello está en su punto más alto)
const B_END = 10.4; // los datos empiezan a salir
const C_START = 10.8;
const DURATION = 14.5;

function stadium(ctx: CanvasRenderingContext2D) {
	staticLayer(ctx, 'camino-bg', (c) => {
		c.fillStyle = vGradient(c, 0, H, [[0, '#050c22'], [0.4, '#0d2150'], [0.75, '#122c63'], [1, '#07122e']]);
		c.fillRect(0, 0, W, H);
		// tribuna: filas de puntitos (hinchas) que van de más oscuras arriba a más claras abajo
		for (let row = 0; row < 26; row++) {
			const y = 120 + row * 38;
			const depth = row / 26;
			for (let i = 0; i < 46; i++) {
				const x = i * 16 + (row % 2) * 8 + hash(row * 50 + i, 3) * 6;
				const lit = hash(row * 99 + i, 7);
				c.fillStyle = `rgba(${150 + lit * 90},${170 + lit * 70},255,${0.03 + depth * 0.06 + lit * 0.04})`;
				c.beginPath();
				c.arc(x, y + hash(i, row) * 10, 2.4 + depth * 1.6, 0, TAU);
				c.fill();
			}
		}
		// bandas de la tribuna
		for (let r = 0; r < 12; r++) {
			c.fillStyle = r % 2 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.14)';
			c.fillRect(0, 160 + r * 84, W, 84);
		}
		// reflectores
		for (const x of [120, 600]) glow(c, x, 40, 330, 'rgba(255,240,200,.22)');
		glow(c, W / 2, 640, 520, 'rgba(33,86,190,.35)');
		// viñeta
		const v = c.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 900);
		v.addColorStop(0, 'rgba(0,0,0,0)');
		v.addColorStop(1, 'rgba(0,0,0,.6)');
		c.fillStyle = v;
		c.fillRect(0, 0, W, H);
	});
}

/** Rayos de luz que se mueven despacio y polvo dorado que sube. */
function atmosphere(ctx: CanvasRenderingContext2D, t: number) {
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	for (let i = 0; i < 3; i++) {
		const sway = Math.sin(t * 0.5 + i * 2) * 60;
		const x = 120 + i * 240;
		const g = ctx.createLinearGradient(x, 0, x + sway, 1000);
		g.addColorStop(0, 'rgba(255,236,190,.06)');
		g.addColorStop(1, 'rgba(255,236,190,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(x - 30, 0);
		ctx.lineTo(x + 30, 0);
		ctx.lineTo(x + sway + 190, 1000);
		ctx.lineTo(x + sway - 120, 1000);
		ctx.fill();
	}
	for (let i = 0; i < 34; i++) {
		const sp = 14 + hash(i, 2) * 26;
		const y = H - ((t * sp + hash(i, 1) * H) % (H + 40)) + 20;
		const x = hash(i, 5) * W + Math.sin(t * 0.7 + i) * 16;
		const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.8 + hash(i, 9)) + i));
		ctx.fillStyle = `rgba(246,210,122,${0.5 * tw})`;
		ctx.beginPath();
		ctx.arc(x, y, 1.2 + hash(i, 4) * 2, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

/** Texto que se escribe letra por letra sin que las letras ya escritas se muevan. */
function typed(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, p: number, fill = GOLD, align: 'center' | 'left' | 'right' = 'center') {
	if (p <= 0) return;
	ctx.save();
	ctx.font = cabj(size);
	const full = ctx.measureText(str).width;
	ctx.restore();
	const part = str.slice(0, Math.ceil(str.length * clamp01(p)));
	const x0 = align === 'center' ? x - full / 2 : align === 'right' ? x - full : x;
	drawText(ctx, part, x0, y, {font: cabj, size, fill, align: 'left', glow: 'rgba(233,172,39,.45)', glowBlur: 16});
}

function sceneTitle(ctx: CanvasRenderingContext2D, t: number, c: TemplateContent) {
	const l1 = 'EL CAMINO';
	const l2 = `A LOS ${c.age}`;
	const size = Math.min(fitSize(ctx, l1, cabj, 600, 120), fitSize(ctx, l2, cabj, 600, 120));
	// acercamiento lento durante toda la escena
	const z = 1 + 0.025 * clamp01(t / FLASH_AT);
	ctx.save();
	ctx.translate(W / 2, 560);
	ctx.scale(z, z);
	ctx.translate(-W / 2, -560);
	typed(ctx, l1, W / 2, 560, size, prog(t, 0.15, 0.85));
	typed(ctx, l2, W / 2, 560 + size * 1.18, size, prog(t, 0.6, 0.7));

	// nombre: aparece con un fundido y una línea dorada que se despliega
	const name = c.name.toLocaleUpperCase('es');
	const np = prog(t, 1.15, 0.6);
	if (np > 0) {
		const ns = fitSize(ctx, name, cabj, 520, 44);
		drawText(ctx, name, W / 2, 560 + size * 1.18 + 78 + (1 - outCubic(np)) * 14, {font: cabj, size: ns, fill: LIGHT, spacing: 1.5, glow: 'rgba(217,232,244,.25)'});
	}
	const lp = outCubic(prog(t, 1.5, 0.7));
	ctx.fillStyle = GOLD;
	ctx.fillRect(W / 2 - 150 * lp, 560 + size * 1.18 + 112, 300 * lp, 3);
	ctx.restore();

	// pie: invitación
	const fp = prog(t, 1.9, 0.6);
	if (fp > 0) {
		ctx.save();
		ctx.globalAlpha *= fp;
		drawText(ctx, 'TE INVITA A CELEBRAR', W / 2, 1120, {font: mont, size: 26, fill: WHITE, spacing: 3});
		ctx.fillStyle = GOLD;
		ctx.beginPath();
		ctx.arc(W / 2, 1150, 5, 0, TAU);
		ctx.fill();
		ctx.restore();
	}
}

type Block = {at: number; x: number; y: number; align: 'left' | 'right'; label: string; value: string; sub?: string};

/** Dato con punto dorado, texto y línea que se despliega (como las fichas de la referencia). */
function statBlock(ctx: CanvasRenderingContext2D, t: number, b: Block, fade: number) {
	const p = prog(t, b.at, 0.55);
	if (p <= 0 || fade <= 0) return;
	const dir = b.align === 'left' ? 1 : -1;
	ctx.save();
	ctx.globalAlpha *= clamp01(p * 1.6) * fade;
	ctx.translate((1 - outCubic(p)) * -46 * dir, 0);
	// una sola línea si entra; si no, dos con el mismo tamaño
	const fit = b.sub ? null : uniformRows(ctx, [{text: b.value}], cabj, 325, 46, 18, () => true);
	const vl = fit ? fit.lines[0] : [b.value];
	const lines = b.sub || vl.length > 1 ? 3 : 2;
	const lineY = b.y + 62 + (lines - 1) * 36 + 18;
	const L = 300;
	const lp = outCubic(prog(t, b.at + 0.25, 0.7));
	const x0 = b.x;
	const x1 = b.x + dir * L * lp;

	// punto y línea
	ctx.fillStyle = GOLD;
	ctx.beginPath();
	ctx.arc(x0, b.y - 24, 6, 0, TAU);
	ctx.fill();
	ctx.fillRect(Math.min(x0, x1) - 1, lineY, Math.abs(x1 - x0) + 2, 3);
	if (lp > 0.95) {
		// remate de la línea: un pequeño codo hacia arriba
		ctx.fillRect(x1 - (dir > 0 ? 3 : 0), lineY - 20, 3, 23);
	}
	const al = b.align;
	drawText(ctx, b.label, x0 + dir * 22, b.y, {font: mont, size: 20, fill: GOLD_SOFT, spacing: 2, align: al});
	const vs = fit ? fit.size : fitSize(ctx, b.value, cabj, 330, 46, 18);
	vl.forEach((l, j) => drawText(ctx, l, x0 + dir * 22, b.y + 54 + j * vs * 1.08, {font: cabj, size: vs, fill: WHITE, align: al}));
	if (b.sub) drawText(ctx, b.sub, x0 + dir * 22, b.y + 54 + 38, {font: mont, size: 20, fill: LIGHT, spacing: 1.5, align: al});
	ctx.restore();
}

function photoOrAge(ctx: CanvasRenderingContext2D, t: number, c: TemplateContent, fade: number) {
	const T0 = FLASH_AT + 0.1;
	const p = prog(t, T0, 0.8);
	if (p <= 0 || fade <= 0) return;
	const cx = W / 2;
	const cy = 655;
	const r = 205;
	const float = Math.sin(t * 1.6) * 6;
	ctx.save();
	ctx.globalAlpha *= clamp01(p * 2) * fade;
	ctx.translate(cx, cy + float);
	const s = Math.max(0.01, lerp(0.7, 1, outBack(p)));
	ctx.scale(s, s);
	ctx.translate(-cx, -(cy + float));
	const y = cy + float;

	glow(ctx, cx, y, r * 1.8, 'rgba(233,172,39,.35)');
	// anillo dorado y anillo punteado que gira despacio
	ctx.strokeStyle = GOLD;
	ctx.lineWidth = 8;
	ctx.beginPath();
	ctx.arc(cx, y, r + 10, 0, TAU);
	ctx.stroke();
	ctx.save();
	ctx.translate(cx, y);
	ctx.rotate(t * 0.25);
	ctx.strokeStyle = 'rgba(246,210,122,.8)';
	ctx.lineWidth = 3;
	ctx.setLineDash([3, 16]);
	ctx.beginPath();
	ctx.arc(0, 0, r + 34, 0, TAU);
	ctx.stroke();
	ctx.restore();

	// fondo detrás de la foto
	ctx.fillStyle = vGradient(ctx, y - r, y + r, [[0, '#17357a'], [1, '#081538']]);
	ctx.beginPath();
	ctx.arc(cx, y, r, 0, TAU);
	ctx.fill();
	drawPhotoIn(ctx, c.photo, 'circle', cx, y, r, () => {
		// sin foto: la edad, grande y dorada
		const txt = String(c.age);
		const fs = fitSize(ctx, txt, cabj, r * 1.5, 330);
		drawText(ctx, txt, cx, y + fs * 0.26, {font: cabj, size: fs, fill: GOLD, glow: 'rgba(233,172,39,.6)', glowBlur: 30});
		drawText(ctx, 'AÑOS', cx, y + fs * 0.26 + 64, {font: mont, size: 30, fill: LIGHT, spacing: 6});
	});
	// brillo que cruza la foto una vez
	const sh = prog(t, T0 + 0.9, 0.9);
	if (sh > 0 && sh < 1) {
		ctx.save();
		ctx.beginPath();
		ctx.arc(cx, y, r, 0, TAU);
		ctx.clip();
		ctx.globalCompositeOperation = 'lighter';
		const gx = cx - r * 1.4 + sh * r * 2.8;
		const g = ctx.createLinearGradient(gx - 60, 0, gx + 60, 0);
		g.addColorStop(0, 'rgba(255,255,255,0)');
		g.addColorStop(0.5, 'rgba(255,240,200,.35)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(cx - r, y - r, r * 2, r * 2);
		ctx.restore();
	}
	ctx.restore();
}

function sceneData(ctx: CanvasRenderingContext2D, t: number, c: TemplateContent) {
	const fade = 1 - outCubic(prog(t, B_END, 0.5));
	photoOrAge(ctx, t, c, fade);

	// el nombre, arriba a la derecha (donde la referencia pone su marca)
	const np = prog(t, FLASH_AT + 0.2, 0.5);
	if (np > 0 && fade > 0) {
		ctx.save();
		ctx.globalAlpha *= np * fade;
		const nm = c.name.toLocaleUpperCase('es');
		const ns = fitSize(ctx, nm, cabj, 300, 34, 18);
		drawText(ctx, nm, W - 52, 78, {font: cabj, size: ns, fill: GOLD, align: 'right'});
		drawText(ctx, `CUMPLE ${c.age}`, W - 52, 112, {font: mont, size: 18, fill: LIGHT, spacing: 2.5, align: 'right'});
		ctx.restore();
	}

	const blocks: Block[] = [
		{at: FLASH_AT + 0.55, x: 56, y: 170, align: 'left', label: 'EL GRAN DÍA', value: `${c.day} DE ${c.monthName.toLocaleUpperCase('es')}`, sub: `${c.weekday.toLocaleUpperCase('es')} ${c.year}`},
		{at: FLASH_AT + 1.4, x: W - 56, y: 320, align: 'right', label: 'HORA DE ENTRADA', value: c.time.toLocaleUpperCase('es')},
		{at: FLASH_AT + 2.5, x: 56, y: 955, align: 'left', label: 'EL ESTADIO', value: c.venue.toLocaleUpperCase('es')},
		{at: FLASH_AT + 3.6, x: W - 56, y: (wrapFit(ctx, c.venue.toLocaleUpperCase('es'), cabj(46), 325) ?? []).length > 1 ? 1100 : 1075, align: 'right', label: 'CÓMO LLEGAR', value: c.address.toLocaleUpperCase('es')},
	];
	for (const b of blocks) statBlock(ctx, t, b, fade);
}

function sceneClose(ctx: CanvasRenderingContext2D, t: number, c: TemplateContent) {
	const l1 = '¡TE ESPERAMOS!';
	const s1 = fitSize(ctx, l1, cabj, 620, 110);
	typed(ctx, l1, W / 2, 560, s1, prog(t, C_START + 0.2, 1.0));
	const np = prog(t, C_START + 1.3, 0.7);
	if (np > 0) {
		const nm = c.name.toLocaleUpperCase('es');
		const ns = fitSize(ctx, nm, cabj, 560, 70);
		ctx.save();
		ctx.globalAlpha *= np;
		drawText(ctx, nm, W / 2, 680 + (1 - outCubic(np)) * 16, {font: cabj, size: ns, fill: WHITE, glow: 'rgba(217,232,244,.3)'});
		drawText(ctx, `CUMPLE ${c.age}`, W / 2, 740, {font: mont, size: 30, fill: GOLD_SOFT, spacing: 4});
		ctx.restore();
	}
	const lp = outCubic(prog(t, C_START + 1.7, 0.8));
	ctx.fillStyle = GOLD;
	ctx.fillRect(W / 2 - 170 * lp, 790, 340 * lp, 3);
	const dp = prog(t, C_START + 2.2, 0.6);
	if (dp > 0) {
		ctx.save();
		ctx.globalAlpha *= dp;
		const when = `${c.weekday.toLocaleUpperCase('es')} ${c.day} DE ${c.monthName.toLocaleUpperCase('es')} · ${c.time.toLocaleUpperCase('es')}`;
		const ws = fitSize(ctx, when, mont, 620, 24, 14);
		drawText(ctx, when, W / 2, 850, {font: mont, size: ws, fill: LIGHT, spacing: 1.5});
		ctx.restore();
	}
}

function draw(ctx: CanvasRenderingContext2D, f: {t: number; content: TemplateContent}) {
	const {t, content: c} = f;
	stadium(ctx);
	atmosphere(ctx, t);

	if (t < FLASH_AT) sceneTitle(ctx, t, c);
	else if (t < C_START) {
		// la escena 2 se oscurece un poco para que el destello y los datos resalten
		ctx.fillStyle = 'rgba(2,8,28,.22)';
		ctx.fillRect(0, 0, W, H);
		sceneData(ctx, t, c);
	} else sceneClose(ctx, t, c);

	// destello claro entre escenas: sube rápido hasta el cambio y se disuelve después
	const up = prog(t, FLASH_AT - 0.3, 0.3);
	const down = 1 - prog(t, FLASH_AT, 0.7);
	const fl = t < FLASH_AT ? up * 0.92 : down * 0.92;
	if (fl > 0.003) {
		ctx.save();
		ctx.fillStyle = `rgba(255,246,222,${fl})`;
		ctx.fillRect(0, 0, W, H);
		ctx.restore();
	}
	// fundido suave entre la escena de datos y el cierre (la ficha sale mientras entra el título)
	// y entrada desde el negro al comienzo
	const fin = 1 - prog(t, 0, 0.35);
	if (fin > 0) {
		ctx.fillStyle = `rgba(2,6,20,${fin})`;
		ctx.fillRect(0, 0, W, H);
	}
}

export const camino: TemplateDefinition = {
	id: 'camino',
	name: 'Camino de Gloria',
	description: 'Estilo campaña de estadio: título dorado que se escribe, destello y datos con líneas doradas. Diseño original en azul noche y oro.',
	category: 'Fútbol',
	audience: 'juvenil',
	palette: [NAVY, BLUE, GOLD, LIGHT],
	fonts: ['CABJ1905', 'Montserrat'],
	duration: DURATION,
	fps: 24,
	defaultAudioId: 'camino-de-gloria',
	photoRule: 'La foto va en un círculo dorado en el centro de la segunda escena; sin foto, se muestra la edad en grande.',
	thumbnailTime: 6.4,
	draw,
};
