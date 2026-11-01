// Plantilla "Guerreras del Escenario": concierto pop con luces, pantalla LED,
// guerreras musicales (siluetas originales) y una photocard holográfica.
// Todo el arte es original; no replica personajes, vestuarios ni logos existentes.

import type {TemplateDefinition, TemplateContent} from './types';
import {
	W, H, TAU, clamp01, lerp, prog, outCubic, outBack, window01, withTransform, roundRectPath, starPath, sparkle4, glow, vGradient, staticLayer, drawText, fitSize, drawPhotoIn, confetti, twinkles, drawDetails,
} from './kit';

const PINK = '#ff3cac';
const CYAN = '#2de2e6';
const VIOLET = '#8b5cf6';
const YELLOW = '#ffe14d';
const NIGHT = '#0d0420';
const mont = (s: number) => `italic 800 ${s}px Montserrat, system-ui, sans-serif`;
const montR = (s: number) => `800 ${s}px Montserrat, system-ui, sans-serif`;
const BEAT = 0.5; // 120 bpm

function neon(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, color: string, font = mont, flicker = 1) {
	ctx.save();
	ctx.globalAlpha *= flicker;
	drawText(ctx, str, x, y, {font, size, fill: '#fff', stroke: color, strokeW: size * 0.09, glow: color, glowBlur: 26});
	drawText(ctx, str, x, y, {font, size, fill: '#fff', glow: color, glowBlur: 10});
	ctx.restore();
}

function stage(ctx: CanvasRenderingContext2D, t: number) {
	staticLayer(ctx, 'kpop-bg', (c) => {
		c.fillStyle = vGradient(c, 0, H, [[0, '#10002b'], [0.55, '#2b0a55'], [1, '#12002e']]);
		c.fillRect(0, 0, W, H);
		// pantalla LED
		c.fillStyle = '#07011a';
		roundRectPath(c, 50, 150, 620, 420, 18);
		c.fill();
		c.strokeStyle = 'rgba(139,92,246,.8)';
		c.lineWidth = 6;
		c.stroke();
		c.fillStyle = 'rgba(255,255,255,.05)';
		for (let y = 160; y < 560; y += 10) for (let x = 60; x < 660; x += 10) c.fillRect(x, y, 5, 5);
		// piso del escenario
		c.fillStyle = vGradient(c, 900, H, [[0, '#2a0a4d'], [1, '#0b0120']]);
		c.beginPath();
		c.moveTo(0, 900);
		c.lineTo(W, 900);
		c.lineTo(W, H);
		c.lineTo(0, H);
		c.fill();
		c.strokeStyle = 'rgba(45,226,230,.35)';
		c.lineWidth = 2;
		for (let i = -8; i <= 8; i++) {
			c.beginPath();
			c.moveTo(W / 2 + i * 24, 900);
			c.lineTo(W / 2 + i * 150, H);
			c.stroke();
		}
		for (let k = 1; k < 7; k++) {
			const y = 900 + Math.pow(k / 7, 1.8) * 380;
			c.beginPath();
			c.moveTo(0, y);
			c.lineTo(W, y);
			c.stroke();
		}
		c.fillStyle = PINK;
		c.fillRect(0, 898, W, 5);
	});

	// ecualizador en la pantalla LED (sigue el pulso de 120 bpm)
	const beat = (t / BEAT) % 1;
	const pulse = Math.pow(1 - beat, 3);
	ctx.save();
	ctx.beginPath();
	roundRectPath(ctx, 56, 156, 608, 408, 14);
	ctx.clip();
	for (let i = 0; i < 22; i++) {
		const hgt = 40 + (0.35 + 0.65 * Math.abs(Math.sin(t * 3.1 + i * 0.7) * Math.cos(t * 1.7 + i))) * 280 * (0.7 + 0.3 * pulse);
		const g = ctx.createLinearGradient(0, 560, 0, 560 - hgt);
		g.addColorStop(0, PINK);
		g.addColorStop(1, CYAN);
		ctx.fillStyle = g;
		ctx.globalAlpha = 0.5;
		ctx.fillRect(66 + i * 27, 556 - hgt, 20, hgt);
	}
	ctx.restore();

	// haces de luz
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	const cols = [PINK, CYAN, VIOLET, YELLOW, PINK, CYAN];
	const on = clamp01(t / 0.8);
	cols.forEach((col, i) => {
		const x = 60 + i * 120;
		const ang = Math.sin(t * 0.9 + i * 1.3) * 0.35 + (i - 2.5) * 0.12;
		const len = 1100;
		const spread = 70;
		const g = ctx.createLinearGradient(x, 0, x + Math.sin(ang) * len, Math.cos(ang) * len);
		g.addColorStop(0, col);
		g.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.globalAlpha = 0.22 * on * (0.75 + 0.25 * pulse);
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(x - 8, -10);
		ctx.lineTo(x + 8, -10);
		ctx.lineTo(x + Math.sin(ang) * len + spread, Math.cos(ang) * len);
		ctx.lineTo(x + Math.sin(ang) * len - spread, Math.cos(ang) * len);
		ctx.fill();
	});
	ctx.restore();
	glow(ctx, W / 2, 930, 360, 'rgba(255,60,172,.35)', 0.8 + 0.2 * pulse);

	// público con lightsticks
	for (let i = 0; i < 13; i++) {
		const x = i * 58 + 20 + (i % 2) * 8;
		const sway = Math.sin(t * 2.4 + i) * 12;
		const col = [PINK, CYAN, VIOLET, YELLOW][i % 4];
		ctx.fillStyle = '#05000f';
		ctx.beginPath();
		ctx.arc(x, 1262, 26, 0, TAU);
		ctx.fill();
		ctx.strokeStyle = col;
		ctx.lineWidth = 5;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(x + 8, 1245);
		ctx.lineTo(x + 18 + sway, 1195);
		ctx.stroke();
		glow(ctx, x + 18 + sway, 1192, 26, col, 0.9);
		ctx.fillStyle = '#fff';
		ctx.beginPath();
		ctx.arc(x + 18 + sway, 1192, 6, 0, TAU);
		ctx.fill();
	}
}

export function warrior(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, t: number, phase: number) {
	const bounce = Math.abs(Math.sin((t / BEAT) * Math.PI + phase)) * 14;
	const sway = Math.sin(t * 3 + phase);
	ctx.save();
	ctx.translate(x, y - bounce);
	ctx.scale(s, s);
	ctx.shadowColor = color;
	ctx.shadowBlur = 24;
	ctx.fillStyle = NIGHT;
	ctx.strokeStyle = color;
	ctx.lineWidth = 4;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	// piernas
	ctx.lineWidth = 22;
	ctx.strokeStyle = NIGHT;
	ctx.beginPath();
	ctx.moveTo(-14, -170);
	ctx.quadraticCurveTo(-30 + sway * 6, -90, -26, 0);
	ctx.moveTo(14, -170);
	ctx.quadraticCurveTo(34 - sway * 6, -90, 28, 0);
	ctx.stroke();
	// falda con borde de neón
	ctx.lineWidth = 4;
	ctx.strokeStyle = color;
	ctx.beginPath();
	ctx.moveTo(-34, -196);
	ctx.lineTo(34, -196);
	ctx.lineTo(74 + sway * 6, -108);
	ctx.quadraticCurveTo(0, -92, -74 + sway * 6, -108);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// torso
	roundRectPath(ctx, -34, -312, 68, 124, 22);
	ctx.fill();
	ctx.stroke();
	// brazo con espada
	ctx.lineWidth = 16;
	ctx.strokeStyle = NIGHT;
	ctx.beginPath();
	ctx.moveTo(-28, -292);
	ctx.quadraticCurveTo(-70, -300, -88, -350 - Math.abs(sway) * 12);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(28, -292);
	ctx.quadraticCurveTo(62, -250, 38, -214);
	ctx.stroke();
	// espada de luz
	ctx.save();
	ctx.shadowBlur = 30;
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 7;
	ctx.beginPath();
	ctx.moveTo(-88, -350 - Math.abs(sway) * 12);
	ctx.lineTo(-128, -520 - Math.abs(sway) * 12);
	ctx.stroke();
	ctx.strokeStyle = color;
	ctx.lineWidth = 3;
	ctx.stroke();
	ctx.restore();
	// cabeza y pelo
	ctx.fillStyle = NIGHT;
	ctx.beginPath();
	ctx.arc(0, -350, 32, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = color;
	ctx.lineWidth = 4;
	ctx.stroke();
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(0, -360, 36, Math.PI * 1.02, Math.PI * 1.98);
	ctx.fill();
	ctx.beginPath(); // coleta alta
	ctx.moveTo(18, -384);
	ctx.bezierCurveTo(70, -400 + sway * 14, 90, -330, 60 + sway * 24, -250);
	ctx.bezierCurveTo(60, -310, 40, -360, 18, -384);
	ctx.fill();
	sparkle4(ctx, 22, -388, 14, '#fff', t);
	ctx.restore();
}

function photocard(ctx: CanvasRenderingContext2D, c: TemplateContent, t: number) {
	const w = 410;
	const h = 600;
	ctx.save();
	ctx.shadowColor = 'rgba(255,60,172,.7)';
	ctx.shadowBlur = 40;
	const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
	const sh = (t * 0.4) % 1;
	['#ff3cac', '#8b5cf6', '#2de2e6', '#ffe14d', '#ff3cac'].forEach((col, i) => g.addColorStop(clamp01((i / 4 + sh) % 1.0001), col));
	ctx.fillStyle = '#ff3cac';
	roundRectPath(ctx, -w / 2, -h / 2, w, h, 34);
	ctx.fill();
	ctx.shadowBlur = 0;
	ctx.fillStyle = g;
	roundRectPath(ctx, -w / 2, -h / 2, w, h, 34);
	ctx.fill();
	ctx.fillStyle = '#12002e';
	roundRectPath(ctx, -w / 2 + 14, -h / 2 + 14, w - 28, h - 28, 24);
	ctx.fill();
	// ventana de la foto
	const cy = -h / 2 + 14 + 190;
	if (c.photo) {
		drawPhotoIn(ctx, c.photo, 'rounded', 0, cy, 172);
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 4;
		roundRectPath(ctx, -172, cy - 172, 344, 344, 48);
		ctx.stroke();
	} else {
		const gg = ctx.createLinearGradient(0, cy - 170, 0, cy + 170);
		gg.addColorStop(0, '#3b0a6b');
		gg.addColorStop(1, '#16002f');
		ctx.fillStyle = gg;
		roundRectPath(ctx, -172, cy - 172, 344, 344, 48);
		ctx.fill();
		const age = String(c.age);
		neon(ctx, age, 0, cy + 70, age.length > 2 ? 150 : 200, PINK, montR);
		sparkle4(ctx, -120, cy - 110, 24, YELLOW, t);
		sparkle4(ctx, 124, cy - 80, 18, CYAN, -t);
	}
	// nombre y edad
	const name = c.name.toLocaleUpperCase('es');
	const ns = fitSize(ctx, name, mont, w - 80, 58, 26);
	drawText(ctx, name, 0, h / 2 - 118, {font: mont, size: ns, fill: '#fff', glow: CYAN, glowBlur: 16});
	drawText(ctx, `★ ${c.age} AÑOS ★`, 0, h / 2 - 62, {font: montR, size: 32, fill: YELLOW, spacing: 1.5});
	ctx.fillStyle = 'rgba(255,255,255,.7)';
	ctx.font = montR(14);
	ctx.textAlign = 'left';
	ctx.fillText('PHOTOCARD · ED. CUMPLE', -w / 2 + 30, h / 2 - 28);
	ctx.restore();
	// badge de edad cuando hay foto
	if (c.photo) {
		withTransform(ctx, {x: w / 2 - 20, y: -h / 2 + 30, rot: 0.2, scale: 1 + Math.sin(t * 6) * 0.04}, () => {
			starPath(ctx, 0, 0, 12, 62, 50);
			ctx.fillStyle = YELLOW;
			ctx.fill();
			drawText(ctx, String(c.age), 0, 18, {font: montR, size: 52, fill: NIGHT});
		});
	}
}

function draw(ctx: CanvasRenderingContext2D, {t, content: c}: {t: number; content: TemplateContent}) {
	stage(ctx, t);

	// ---------- A: entrada de las guerreras ----------
	const a = window01(t, -1, 3.5, 0.45);
	if (a > 0) {
		ctx.save();
		ctx.globalAlpha = a;
		[[190, PINK, 0.7, 0.9], [530, CYAN, 1.4, 1.05], [360, VIOLET, 0, 1.2]].forEach(([x, col, ph, sc], i) => {
			const p = outBack(prog(t, 0.5 + i * 0.25, 0.7));
			warrior(ctx, x as number, lerp(1500, 1010, p) as number, sc as number, col as string, t, ph as number);
		});
		const fl = t < 1.4 ? (Math.sin(t * 40) > 0 ? 1 : 0.5) : 1;
		withTransform(ctx, {x: W / 2, y: 300, scale: Math.max(0.01, outBack(prog(t, 0.2, 0.7)))}, () => {
			neon(ctx, '¡SHOW TIME!', 0, 0, fitSize(ctx, '¡SHOW TIME!', mont, 620, 108), PINK, mont, fl);
		});
		withTransform(ctx, {x: W / 2, y: 392, alpha: prog(t, 1.4, 0.5)}, () => {
			neon(ctx, 'CONCIERTO DE CUMPLEAÑOS', 0, 0, 34, CYAN, montR);
		});
		ctx.restore();
	}

	// ---------- B: photocard ----------
	const b = window01(t, 3.2, 7.1, 0.4);
	if (b > 0) {
		ctx.save();
		ctx.globalAlpha = b;
		// espadas cruzadas detrás
		const sp = outCubic(prog(t, 3.4, 0.6));
		ctx.save();
		ctx.translate(W / 2, 640);
		ctx.shadowColor = CYAN;
		ctx.shadowBlur = 28;
		ctx.lineCap = 'round';
		for (const s of [-1, 1]) {
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 9;
			ctx.beginPath();
			ctx.moveTo(-s * 190 * sp, -420 * sp);
			ctx.lineTo(s * 190 * sp, 420 * sp);
			ctx.stroke();
			ctx.strokeStyle = s < 0 ? CYAN : PINK;
			ctx.lineWidth = 4;
			ctx.stroke();
		}
		ctx.restore();
		const fp = prog(t, 3.3, 0.9);
		const flip = Math.abs(Math.cos((1 - outCubic(fp)) * Math.PI / 2 * 3.0));
		withTransform(ctx, {x: W / 2, y: 650, sx: Math.max(0.02, fp < 1 ? flip : 1), sy: 1, rot: Math.sin(t * 1.8) * 0.035}, () => photocard(ctx, c, t));
		withTransform(ctx, {x: W / 2, y: 190, alpha: prog(t, 4.0, 0.4)}, () => {
			neon(ctx, `¡CUMPLE ${c.age}!`, 0, 0, 88, YELLOW, mont);
		});
		ctx.restore();
	}

	// ---------- transición: franjas de color ----------
	const cols = [PINK, CYAN, VIOLET, YELLOW, PINK, CYAN, VIOLET];
	for (let k = 0; k < 7; k++) {
		const p = prog(t, 6.8 + (k % 4) * 0.07, 0.55);
		if (p > 0 && p < 1) {
			ctx.fillStyle = cols[k];
			ctx.fillRect(k * (W / 7), -H + p * 2 * H, W / 7 + 1, H);
		}
	}

	// ---------- C: entrada al concierto ----------
	const cc = window01(t, 7.2, 99, 0.35);
	if (cc > 0) {
		ctx.save();
		ctx.globalAlpha = cc;
		const name = c.name.toLocaleUpperCase('es');
		const ns = fitSize(ctx, name, mont, 640, 96, 36);
		withTransform(ctx, {x: W / 2, y: 190, scale: Math.max(0.01, outBack(prog(t, 7.3, 0.6)))}, () => {
			neon(ctx, name, 0, 0, ns, PINK, mont);
		});
		withTransform(ctx, {x: W / 2, y: 262, alpha: prog(t, 7.7, 0.4)}, () => {
			neon(ctx, `★ ${c.age} AÑOS ★`, 0, 0, 44, YELLOW, montR);
		});
		drawDetails(ctx, c, t, 7.9, {
			labelFont: montR,
			valueFont: mont,
			labelColor: CYAN,
			valueColor: '#fff',
			subColor: '#ffd1ee',
			glow: PINK,
			uppercase: true,
			y: 330,
			plate: (g, x, y, w, h, i) => {
				g.save();
				g.fillStyle = 'rgba(18,0,46,.72)';
				roundRectPath(g, x, y, w, h, 24);
				g.fill();
				const grad = g.createLinearGradient(x, y, x + w, y + h);
				grad.addColorStop(0, i % 2 ? CYAN : PINK);
				grad.addColorStop(1, i % 2 ? PINK : CYAN);
				g.strokeStyle = grad;
				g.lineWidth = 4;
				g.shadowColor = i % 2 ? CYAN : PINK;
				g.shadowBlur = 20;
				g.stroke();
				g.restore();
			},
		});
		ctx.restore();
	}

	twinkles(ctx, t, 16, ['#fff', YELLOW, CYAN, PINK], {seed: 40, y0: 40, y1: 900, maxR: 20});
	confetti(ctx, t, {count: 26, colors: [PINK, CYAN, YELLOW, VIOLET, '#fff'], seed: 3, speed: 1.2, shape: 'strip', size: 16});
	// destello de transición A→B
	const fl = 1 - prog(t, 3.2, 0.4);
	if (t > 3.2 && fl > 0) {
		ctx.fillStyle = `rgba(255,255,255,${fl * 0.7})`;
		ctx.fillRect(0, 0, W, H);
	}
}

export const kpop: TemplateDefinition = {
	id: 'kpop',
	name: 'Guerreras del Escenario',
	description: 'Concierto pop con luces de neón, pantalla LED, guerreras musicales y una photocard holográfica.',
	category: 'Pop',
	audience: 'juvenil',
	palette: [PINK, CYAN, VIOLET, YELLOW],
	fonts: ['Montserrat'],
	duration: 11,
	fps: 24,
	defaultAudioId: 'estrella-pop',
	photoRule: 'La foto va dentro de una photocard holográfica; sin foto, la edad ocupa la ventana con efecto neón.',
	thumbnailTime: 5.2,
	draw,
};
