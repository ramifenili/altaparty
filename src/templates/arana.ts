// Plantilla "Héroe Arácnido": cómic de acción en rojo y azul con rascacielos,
// telarañas, viñetas y efectos de sonido. Diseño ORIGINAL inspirado en la
// temática de un héroe arácnido; no reproduce personajes, logos ni arte de
// ninguna franquicia y no es un producto oficial.

import type {TemplateDefinition, TemplateContent} from './types';
import {
	W, H, TAU, clamp01, lerp, prog, outCubic, outBack, outElastic, window01, hash, withTransform, roundRectPath, starPath, vGradient, staticLayer, drawText, fitSize, drawPhotoIn, confetti, drawDetails,
} from './kit';

const RED = '#e11d2e';
const DEEP = '#7d0d1b';
const BLUE = '#1c3faa';
const NAVY = '#0b1a4a';
const YELLOW = '#ffd93b';
const INK = '#0a0a0a';
const bang = (s: number) => `${s}px Bangers, Impact, sans-serif`;

function web(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, a0: number, a1: number, spokes: number, rings: number) {
	ctx.save();
	ctx.strokeStyle = 'rgba(255,255,255,.6)';
	ctx.lineWidth = 2.2;
	ctx.lineCap = 'round';
	for (let i = 0; i < spokes; i++) {
		const a = lerp(a0, a1, i / (spokes - 1));
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
		ctx.stroke();
	}
	for (let r = 1; r <= rings; r++) {
		const rr = (R * r) / rings;
		for (let i = 0; i < spokes - 1; i++) {
			const aA = lerp(a0, a1, i / (spokes - 1));
			const aB = lerp(a0, a1, (i + 1) / (spokes - 1));
			const mid = (aA + aB) / 2;
			ctx.beginPath();
			ctx.moveTo(cx + Math.cos(aA) * rr, cy + Math.sin(aA) * rr);
			ctx.quadraticCurveTo(cx + Math.cos(mid) * rr * 0.86, cy + Math.sin(mid) * rr * 0.86, cx + Math.cos(aB) * rr, cy + Math.sin(aB) * rr);
			ctx.stroke();
		}
	}
	ctx.restore();
}

function spider(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s, s);
	ctx.strokeStyle = INK;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.lineWidth = 9;
	for (const side of [-1, 1]) {
		for (let i = 0; i < 4; i++) {
			const wig = Math.sin(t * 6 + i + side) * 6;
			const oy = (i - 1.5) * 14;
			ctx.beginPath();
			ctx.moveTo(side * 16, oy);
			ctx.lineTo(side * (70 + i * 6), oy - 44 - i * 6 + wig);
			ctx.lineTo(side * (104 + i * 10), oy + 26 + i * 12 + wig);
			ctx.stroke();
		}
	}
	// abdomen
	ctx.fillStyle = RED;
	ctx.lineWidth = 8;
	ctx.beginPath();
	ctx.ellipse(0, 28, 34, 44, 0, 0, TAU);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = INK;
	ctx.beginPath();
	ctx.moveTo(-14, 6);
	ctx.lineTo(14, 6);
	ctx.lineTo(3, 28);
	ctx.lineTo(14, 52);
	ctx.lineTo(-14, 52);
	ctx.lineTo(-3, 28);
	ctx.closePath();
	ctx.fill();
	// cabeza con ojos
	ctx.fillStyle = RED;
	ctx.beginPath();
	ctx.ellipse(0, -26, 26, 24, 0, 0, TAU);
	ctx.fill();
	ctx.lineWidth = 7;
	ctx.stroke();
	ctx.fillStyle = '#fff';
	for (const side of [-1, 1]) {
		ctx.beginPath();
		ctx.ellipse(side * 11, -28, 8, 12, side * 0.5, 0, TAU);
		ctx.fill();
		ctx.stroke();
	}
	ctx.restore();
}

function burst(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, label: string, fill: string, textFill: string, rot: number, scale = 1) {
	withTransform(ctx, {x, y, rot, scale}, () => {
		starPath(ctx, 0, 0, 14, r, r * 0.68);
		ctx.fillStyle = INK;
		ctx.save();
		ctx.translate(7, 8);
		ctx.fill();
		ctx.restore();
		ctx.fillStyle = fill;
		ctx.fill();
		ctx.lineWidth = 7;
		ctx.strokeStyle = INK;
		ctx.lineJoin = 'round';
		ctx.stroke();
		drawText(ctx, label, 0, r * 0.2, {font: bang, size: r * 0.62, fill: textFill, stroke: INK, strokeW: r * 0.1});
	});
}

function city(ctx: CanvasRenderingContext2D) {
	staticLayer(ctx, 'arana-bg', (c) => {
		c.fillStyle = vGradient(c, 0, H, [[0, '#08133a'], [0.45, '#1c3faa'], [0.75, '#b3262f'], [1, '#e11d2e']]);
		c.fillRect(0, 0, W, H);
		// puntos de trama (halftone)
		c.fillStyle = 'rgba(255,255,255,.1)';
		for (let y = 20; y < H; y += 22) {
			const k = Math.pow(y / H, 1.4);
			for (let x = (y / 22) % 2 ? 0 : 11; x < W; x += 22) {
				c.beginPath();
				c.arc(x, y, 1 + k * 7, 0, TAU);
				c.fill();
			}
		}
		// rascacielos en tres planos
		const layers = [
			{base: 960, color: '#142a78', minH: 160, maxH: 380, seed: 1},
			{base: 1040, color: '#0d1d55', minH: 200, maxH: 460, seed: 2},
			{base: 1130, color: '#070f33', minH: 180, maxH: 420, seed: 3},
		];
		layers.forEach((L, li) => {
			let x = -20;
			let i = 0;
			while (x < W) {
				const bw = 70 + hash(i + L.seed * 50, 1) * 90;
				const bh = L.minH + hash(i + L.seed * 50, 2) * (L.maxH - L.minH);
				c.fillStyle = L.color;
				c.fillRect(x, L.base - bh, bw, bh + 400);
				if (hash(i, 3 + li) > 0.55) {
					c.fillRect(x + bw / 2 - 3, L.base - bh - 40, 6, 40);
				}
				c.fillStyle = li === 2 ? 'rgba(255,217,59,.9)' : 'rgba(255,217,59,.55)';
				for (let wy = L.base - bh + 16; wy < L.base - 10; wy += 24) {
					for (let wx = x + 10; wx < x + bw - 12; wx += 18) {
						if (hash(wx * 3 + wy, L.seed) > 0.62) c.fillRect(wx, wy, 8, 12);
					}
				}
				x += bw + 4;
				i++;
			}
		});
		c.fillStyle = '#05091f';
		c.fillRect(0, 1130, W, 150);
		web(c, 0, 0, 520, 0, Math.PI / 2, 7, 6);
		web(c, W, 0, 380, Math.PI / 2, Math.PI, 6, 5);
	});
}

function speedLines(ctx: CanvasRenderingContext2D, t: number, alpha: number) {
	ctx.save();
	ctx.fillStyle = `rgba(255,255,255,${alpha})`;
	const step = Math.floor(t * 12);
	for (let i = 0; i < 34; i++) {
		const a = (i / 34) * TAU + hash(i + step, 5) * 0.1;
		const r0 = 380 + hash(i + step, 6) * 160;
		const r1 = 900;
		const wdt = 0.025 + hash(i, 7) * 0.03;
		ctx.beginPath();
		ctx.moveTo(W / 2 + Math.cos(a) * r0, 640 + Math.sin(a) * r0);
		ctx.lineTo(W / 2 + Math.cos(a - wdt) * r1, 640 + Math.sin(a - wdt) * r1);
		ctx.lineTo(W / 2 + Math.cos(a + wdt) * r1, 640 + Math.sin(a + wdt) * r1);
		ctx.fill();
	}
	ctx.restore();
}

function caption(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rot: number, fill = YELLOW) {
	withTransform(ctx, {x: x + w / 2, y: y + h / 2, rot}, () => {
		ctx.fillStyle = INK;
		ctx.fillRect(-w / 2 + 9, -h / 2 + 10, w, h);
		ctx.fillStyle = fill;
		ctx.fillRect(-w / 2, -h / 2, w, h);
		ctx.strokeStyle = INK;
		ctx.lineWidth = 6;
		ctx.strokeRect(-w / 2, -h / 2, w, h);
	});
}

function draw(ctx: CanvasRenderingContext2D, {t, content: c}: {t: number; content: TemplateContent}) {
	city(ctx);
	const hasPhoto = !!c.photo;

	// ---------- A: la araña baja y el título golpea ----------
	const a = window01(t, -1, 3.5, 0.4);
	if (a > 0) {
		ctx.save();
		ctx.globalAlpha = a;
		speedLines(ctx, t, 0.1);
		const drop = outBack(prog(t, 0.2, 1.1));
		const sy = lerp(-120, 260, drop) + Math.sin(t * 3) * 6;
		ctx.strokeStyle = 'rgba(255,255,255,.85)';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(W / 2, -10);
		ctx.lineTo(W / 2, sy - 50);
		ctx.stroke();
		spider(ctx, W / 2, sy, 1.0, t);

		const pIn = outCubic(prog(t, 0.9, 0.45));
		const shake = t > 1.3 && t < 1.8 ? Math.sin(t * 90) * 8 * (1.8 - t) : 0;
		withTransform(ctx, {x: W / 2 + shake, y: 640, scale: lerp(3, 1, pIn), rot: -0.05, alpha: pIn * 2}, () => {
			drawText(ctx, '¡ALERTA DE', 0, -30, {font: bang, size: 128, fill: '#fff', stroke: INK, strokeW: 20, shadow: RED, shadowDy: 12});
			drawText(ctx, 'CUMPLEAÑOS!', 0, 100, {font: bang, size: fitSize(ctx, 'CUMPLEAÑOS!', bang, 640, 150), fill: YELLOW, stroke: INK, strokeW: 22, shadow: RED, shadowDy: 12});
		});
		const cp = outBack(prog(t, 1.8, 0.5));
		withTransform(ctx, {x: W / 2, y: 840, scale: Math.max(0.01, cp), rot: 0.03}, () => {
			caption(ctx, -270, -40, 540, 80, 0);
			drawText(ctx, 'UN NUEVO HÉROE CUMPLE AÑOS', 0, 12, {font: bang, size: 40, fill: INK});
		});
		if (t > 1.5) burst(ctx, 120, 1010, 100, '¡POW!', YELLOW, RED, -0.2, outElastic(prog(t, 1.5, 0.6)));
		if (t > 2.1) burst(ctx, 600, 1060, 90, '¡ZAP!', '#fff', BLUE, 0.2, outElastic(prog(t, 2.1, 0.6)));
		ctx.restore();
	}

	// ---------- B: el péndulo con la foto o la edad ----------
	const b = window01(t, 3.2, 7.1, 0.4);
	if (b > 0) {
		ctx.save();
		ctx.globalAlpha = b;
		speedLines(ctx, t, 0.08);
		const ang = Math.sin((t - 3.2) * 2.3) * 0.26 * clamp01((t - 3.2) / 0.8 + 0.15);
		const L = hasPhoto ? 470 : 430;
		const ax = W / 2;
		const ay = -40;
		const ex = ax + Math.sin(ang) * L;
		const ey = ay + Math.cos(ang) * L;
		ctx.strokeStyle = 'rgba(255,255,255,.9)';
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.moveTo(ax, ay);
		ctx.lineTo(ex, ey);
		ctx.stroke();
		const dropIn = outBack(prog(t, 3.3, 0.6));
		withTransform(ctx, {x: ex, y: ey + 170, rot: -ang * 0.8, scale: Math.max(0.01, dropIn)}, () => {
			if (hasPhoto) {
				starPath(ctx, 0, 0, 16, 190, 168);
				ctx.fillStyle = INK;
				ctx.fill();
				starPath(ctx, 0, 0, 16, 182, 162);
				ctx.fillStyle = RED;
				ctx.fill();
				drawPhotoIn(ctx, c.photo, 'circle', 0, 0, 146);
				ctx.lineWidth = 8;
				ctx.strokeStyle = INK;
				ctx.beginPath();
				ctx.arc(0, 0, 146, 0, TAU);
				ctx.stroke();
			} else {
				starPath(ctx, 0, 0, 16, 200, 176);
				ctx.fillStyle = INK;
				ctx.fill();
				starPath(ctx, 0, 0, 16, 192, 170);
				ctx.fillStyle = YELLOW;
				ctx.fill();
				const age = String(c.age);
				drawText(ctx, age, 0, 70, {font: bang, size: age.length > 2 ? 190 : 250, fill: RED, stroke: INK, strokeW: 22, shadow: INK, shadowDy: 10});
			}
		});
		// nombre en el pie de la viñeta
		const np = outBack(prog(t, 4.2, 0.55));
		const name = `¡${c.name.toLocaleUpperCase('es')}!`;
		const ns = fitSize(ctx, name, bang, 620, 150, 56);
		withTransform(ctx, {x: W / 2, y: 1000, rot: -0.05, scale: Math.max(0.01, np)}, () => {
			drawText(ctx, name, 0, 0, {font: bang, size: ns, fill: '#fff', stroke: INK, strokeW: ns * 0.16, shadow: RED, shadowDy: ns * 0.09});
		});
		withTransform(ctx, {x: W / 2, y: 1100, scale: Math.max(0.01, outBack(prog(t, 4.8, 0.5)))}, () => {
			caption(ctx, -230, -42, 460, 84, 0.02, '#fff');
			drawText(ctx, hasPhoto ? `¡CUMPLE ${c.age} AÑOS!` : 'SUPER CUMPLEAÑOS', 0, 14, {font: bang, size: 46, fill: BLUE});
		});
		if (t > 5.2) burst(ctx, 100, 900, 78, '¡BAM!', YELLOW, RED, -0.25, outElastic(prog(t, 5.2, 0.5)));
		if (t > 5.7) burst(ctx, 625, 880, 70, '¡WOW!', '#fff', RED, 0.25, outElastic(prog(t, 5.7, 0.5)));
		ctx.restore();
	}

	// ---------- transición: telaraña que se expande + destello ----------
	const wp = prog(t, 6.8, 0.6);
	if (wp > 0 && wp < 1) {
		ctx.save();
		ctx.translate(W / 2, 640);
		ctx.scale(lerp(0.2, 3.2, outCubic(wp)), lerp(0.2, 3.2, outCubic(wp)));
		ctx.globalAlpha = 1 - wp * 0.9;
		web(ctx, 0, 0, 380, 0, TAU * 0.999, 14, 6);
		ctx.restore();
		ctx.fillStyle = `rgba(255,255,255,${Math.sin(wp * Math.PI) * 0.8})`;
		ctx.fillRect(0, 0, W, H);
	}

	// ---------- C: datos en recuadros de cómic ----------
	const cc = window01(t, 7.1, 99, 0.35);
	if (cc > 0) {
		ctx.save();
		ctx.globalAlpha = cc;
		const hp = outBack(prog(t, 7.2, 0.55));
		withTransform(ctx, {x: W / 2, y: 150, scale: Math.max(0.01, hp), rot: -0.03}, () => {
			const name = c.name.toLocaleUpperCase('es');
			const ns = fitSize(ctx, name, bang, 600, 120, 46);
			drawText(ctx, name, 0, 0, {font: bang, size: ns, fill: '#fff', stroke: INK, strokeW: ns * 0.16, shadow: RED, shadowDy: ns * 0.09});
		});
		// globo de diálogo
		const bp = outBack(prog(t, 7.6, 0.5));
		withTransform(ctx, {x: W / 2, y: 290, scale: Math.max(0.01, bp), rot: 0.02}, () => {
			ctx.fillStyle = INK;
			roundRectPath(ctx, -250 + 8, -52 + 8, 500, 104, 40);
			ctx.fill();
			ctx.fillStyle = '#fff';
			roundRectPath(ctx, -250, -52, 500, 104, 40);
			ctx.fill();
			ctx.strokeStyle = INK;
			ctx.lineWidth = 6;
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-70, 48);
			ctx.lineTo(-110, 100);
			ctx.lineTo(-20, 50);
			ctx.fillStyle = '#fff';
			ctx.fill();
			ctx.stroke();
			ctx.fillStyle = '#fff';
			ctx.fillRect(-92, 44, 62, 12);
			drawText(ctx, `¡CUMPLE ${c.age} Y NO PODÉS FALTAR!`, 0, 14, {font: bang, size: fitSize(ctx, `¡CUMPLE ${c.age} Y NO PODÉS FALTAR!`, bang, 450, 40), fill: RED});
		});
		drawDetails(ctx, c, t, 7.9, {
			labelFont: bang,
			valueFont: bang,
			labelColor: RED,
			valueColor: INK,
			subColor: BLUE,
			uppercase: true,
			y: 400,
			entrance: 'pop',
			plate: (g, x, y, w, h, i) => caption(g, x, y, w, h, i % 2 ? 0.012 : -0.012, i === 1 ? '#fff' : YELLOW),
		});
		ctx.restore();
	}

	confetti(ctx, t, {count: 18, colors: [RED, '#fff', YELLOW, BLUE], seed: 70, speed: 1.2, shape: 'strip', size: 18});
}

export const arana: TemplateDefinition = {
	id: 'arana',
	name: 'Héroe Arácnido',
	description: 'Cómic de acción en rojo y azul: rascacielos, telarañas, viñetas y efectos de sonido. Diseño original, no oficial.',
	category: 'Superhéroes',
	audience: 'infantil',
	palette: [RED, BLUE, YELLOW, NAVY, DEEP],
	fonts: ['Bangers'],
	duration: 11,
	fps: 24,
	defaultAudioId: 'aventura-heroica',
	photoRule: 'La foto cuelga de una telaraña dentro de una explosión de cómic; sin foto, la edad ocupa ese lugar.',
	thumbnailTime: 5.4,
	draw,
};
