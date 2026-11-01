// Plantilla "Magia de Unicornio": cielo pastel, arcoíris que se dibuja,
// un unicornio de crin multicolor, nubes, corazones y destellos.

import type {TemplateDefinition, TemplateContent} from './types';
import {
	W, H, TAU, lerp, prog, outCubic, outBack, outElastic, window01, hash, withTransform, roundRectPath, starPath, heartPath, sparkle4, glow, vGradient, staticLayer, drawText, fitSize, drawPhotoIn, twinkles, drawDetails,
} from './kit';

const PINK = '#ff7ab8';
const LILAC = '#b891ff';
const PURPLE = '#5b2b8f';
const GOLD = '#ffd36b';
const RAINBOW = ['#ff6b8b', '#ffa45c', '#ffe066', '#7be08a', '#6bc8ff', '#8f8bff', '#c08bff'];
const paci = (s: number) => `${s}px Pacifico, cursive`;
const fred = (s: number) => `700 ${s}px Fredoka, system-ui, sans-serif`;

function sky(ctx: CanvasRenderingContext2D, t: number, rainbowP: number) {
	staticLayer(ctx, 'uni-bg', (c) => {
		c.fillStyle = vGradient(c, 0, H, [[0, '#ffc9e6'], [0.45, '#e2d0ff'], [1, '#bfe6ff']]);
		c.fillRect(0, 0, W, H);
	});
	// arcoíris
	if (rainbowP > 0) {
		ctx.save();
		ctx.lineWidth = 34;
		ctx.lineCap = 'butt';
		RAINBOW.forEach((col, i) => {
			ctx.strokeStyle = col;
			ctx.globalAlpha = 0.85;
			ctx.beginPath();
			ctx.arc(W / 2, 1000, 560 - i * 32, Math.PI, Math.PI + Math.PI * rainbowP);
			ctx.stroke();
		});
		ctx.restore();
	}
	// nubes grandes
	const cloud = (x: number, y: number, s: number) => {
		ctx.fillStyle = 'rgba(255,255,255,.95)';
		ctx.beginPath();
		ctx.arc(x, y, 50 * s, 0, TAU);
		ctx.arc(x + 60 * s, y - 24 * s, 62 * s, 0, TAU);
		ctx.arc(x + 130 * s, y, 50 * s, 0, TAU);
		ctx.arc(x + 70 * s, y + 20 * s, 56 * s, 0, TAU);
		ctx.fill();
	};
	cloud(-30 + Math.sin(t * 0.6) * 12, 1010, 1.1);
	cloud(470 - Math.sin(t * 0.5) * 12, 1040, 1.05);
	cloud(250 + Math.sin(t * 0.4) * 10, 1130, 1.3);
	cloud(40 + ((t * 8) % 800) - 100, 190, 0.6);
	cloud(((t * 6 + 500) % 900) - 150, 120, 0.5);

	// burbujas y corazones que suben
	for (let i = 0; i < 14; i++) {
		const p = (t * (0.06 + hash(i, 3) * 0.06) + hash(i, 4)) % 1;
		const x = hash(i, 5) * W + Math.sin(t + i) * 20;
		const y = H + 40 - p * (H + 120);
		const r = 10 + hash(i, 6) * 18;
		ctx.save();
		ctx.globalAlpha = 0.7;
		if (i % 3 === 0) {
			heartPath(ctx, x, y, r * 0.8);
			ctx.fillStyle = PINK;
			ctx.fill();
		} else {
			ctx.beginPath();
			ctx.arc(x, y, r, 0, TAU);
			ctx.strokeStyle = 'rgba(255,255,255,.95)';
			ctx.lineWidth = 3;
			ctx.stroke();
			ctx.fillStyle = 'rgba(255,255,255,.25)';
			ctx.fill();
		}
		ctx.restore();
	}
}

function unicorn(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
	const tilt = Math.sin(t * 1.8) * 0.06;
	const blink = (t % 3.2) > 3.05 ? 0.1 : 1;
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(tilt);
	ctx.scale(s, s);
	// crin (detrás)
	for (const side of [-1, 1]) {
		for (let i = 0; i < 7; i++) {
			const sway = Math.sin(t * 2 + i * 0.7 + side) * 8;
			ctx.fillStyle = RAINBOW[(i + (side > 0 ? 3 : 0)) % 7];
			ctx.beginPath();
			ctx.ellipse(side * (148 + i * 4 + sway * 0.4), -80 + i * 42, 34, 46, side * 0.25, 0, TAU);
			ctx.fill();
		}
	}
	// orejas
	for (const side of [-1, 1]) {
		ctx.fillStyle = '#fff';
		ctx.beginPath();
		ctx.moveTo(side * 70, -120);
		ctx.lineTo(side * 138, -210);
		ctx.lineTo(side * 128, -100);
		ctx.fill();
		ctx.fillStyle = '#ffc2e0';
		ctx.beginPath();
		ctx.moveTo(side * 90, -124);
		ctx.lineTo(side * 128, -184);
		ctx.lineTo(side * 122, -112);
		ctx.fill();
	}
	// cabeza
	const hg = ctx.createRadialGradient(-30, -60, 20, 0, 0, 170);
	hg.addColorStop(0, '#ffffff');
	hg.addColorStop(1, '#f0e6ff');
	ctx.fillStyle = hg;
	ctx.beginPath();
	ctx.ellipse(0, 0, 150, 160, 0, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = 'rgba(184,145,255,.5)';
	ctx.lineWidth = 5;
	ctx.stroke();
	// cuerno
	ctx.save();
	ctx.translate(0, -150);
	const hornG = ctx.createLinearGradient(0, -190, 0, 0);
	hornG.addColorStop(0, '#fff2a8');
	hornG.addColorStop(1, GOLD);
	ctx.fillStyle = hornG;
	ctx.beginPath();
	ctx.moveTo(-34, 10);
	ctx.lineTo(0, -190);
	ctx.lineTo(34, 10);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = '#e8a93a';
	ctx.lineWidth = 5;
	for (let i = 0; i < 5; i++) {
		ctx.beginPath();
		ctx.moveTo(-30 + i * 3, -2 - i * 36);
		ctx.lineTo(30 - i * 5, -26 - i * 36);
		ctx.stroke();
	}
	ctx.restore();
	sparkle4(ctx, 0, -345, 22 + Math.sin(t * 6) * 6, '#fff', t);
	// flequillo
	for (let i = 0; i < 4; i++) {
		ctx.fillStyle = RAINBOW[i * 2 % 7];
		ctx.beginPath();
		ctx.ellipse(-60 + i * 40, -128 + Math.abs(i - 1.5) * 8, 28, 36, (i - 1.5) * 0.25, 0, TAU);
		ctx.fill();
	}
	// ojos
	for (const side of [-1, 1]) {
		ctx.save();
		ctx.translate(side * 62, -4);
		ctx.scale(1, blink);
		ctx.fillStyle = PURPLE;
		ctx.beginPath();
		ctx.ellipse(0, 0, 24, 32, 0, 0, TAU);
		ctx.fill();
		ctx.fillStyle = '#fff';
		ctx.beginPath();
		ctx.arc(-7, -12, 9, 0, TAU);
		ctx.arc(8, 8, 4.5, 0, TAU);
		ctx.fill();
		ctx.strokeStyle = PURPLE;
		ctx.lineWidth = 5;
		ctx.lineCap = 'round';
		for (let l = 0; l < 3; l++) {
			ctx.beginPath();
			ctx.moveTo(side * 18, -22 + l * 4);
			ctx.lineTo(side * (36 + l * 3), -34 + l * 10);
			ctx.stroke();
		}
		ctx.restore();
		ctx.fillStyle = 'rgba(255,122,184,.45)';
		ctx.beginPath();
		ctx.ellipse(side * 100, 48, 26, 16, 0, 0, TAU);
		ctx.fill();
	}
	// hocico
	ctx.fillStyle = '#ffd9ec';
	ctx.beginPath();
	ctx.ellipse(0, 82, 74, 50, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#e0709f';
	ctx.beginPath();
	ctx.ellipse(-24, 76, 8, 12, 0.3, 0, TAU);
	ctx.ellipse(24, 76, 8, 12, -0.3, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = '#e0709f';
	ctx.lineWidth = 5;
	ctx.beginPath();
	ctx.arc(0, 90, 24, 0.2, Math.PI - 0.2);
	ctx.stroke();
	ctx.restore();
}

function cloudPlate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, i: number) {
	ctx.save();
	ctx.shadowColor = 'rgba(91,43,143,.25)';
	ctx.shadowBlur = 18;
	ctx.shadowOffsetY = 8;
	ctx.fillStyle = '#fff';
	roundRectPath(ctx, x, y + 14, w, h - 14, 40);
	ctx.fill();
	ctx.beginPath();
	for (let k = 0; k < 4; k++) {
		const r = 22 + (k % 2) * 8;
		ctx.moveTo(x + 80 + k * ((w - 160) / 3) + r, y + 18);
		ctx.arc(x + 80 + k * ((w - 160) / 3), y + 18, r, 0, TAU);
	}
	ctx.fill();
	ctx.restore();
	ctx.strokeStyle = RAINBOW[(i * 2) % 7];
	ctx.lineWidth = 5;
	roundRectPath(ctx, x + 8, y + 22, w - 16, h - 30, 34);
	ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, {t, content: c}: {t: number; content: TemplateContent}) {
	sky(ctx, t, outCubic(prog(t, 0, 2.2)));
	const hasPhoto = !!c.photo;

	// ---------- A ----------
	const a = window01(t, -1, 3.5, 0.4);
	if (a > 0) {
		ctx.save();
		ctx.globalAlpha = a;
		const up = outBack(prog(t, 0.6, 0.9));
		unicorn(ctx, W / 2, lerp(1500, 740, up), 1.25, t);
		withTransform(ctx, {x: W / 2, y: 230, scale: Math.max(0.01, outBack(prog(t, 0.3, 0.7))), rot: -0.04}, () => {
			drawText(ctx, '¡Fiesta', 0, 0, {font: paci, size: 112, fill: '#fff', stroke: PINK, strokeW: 22, shadow: PURPLE, shadowDy: 8});
			drawText(ctx, 'mágica!', 0, 110, {font: paci, size: 112, fill: '#fff', stroke: LILAC, strokeW: 22, shadow: PURPLE, shadowDy: 8});
		});
		ctx.restore();
	}

	// ---------- B ----------
	const b = window01(t, 3.2, 7.1, 0.4);
	if (b > 0) {
		ctx.save();
		ctx.globalAlpha = b;
		const pp = outBack(prog(t, 3.3, 0.7));
		withTransform(ctx, {x: W / 2, y: 410, scale: Math.max(0.01, pp), rot: Math.sin(t * 1.6) * 0.03}, () => {
			glow(ctx, 0, 0, 300, 'rgba(255,255,255,.9)');
			// aro arcoíris en forma de corazón
			RAINBOW.forEach((col, i) => {
				heartPath(ctx, 0, 14, 196 - i * 6);
				ctx.strokeStyle = col;
				ctx.lineWidth = 12;
				ctx.stroke();
			});
			if (hasPhoto) {
				drawPhotoIn(ctx, c.photo, 'heart', 0, 0, 200);
			} else {
				heartPath(ctx, 0, 14, 154);
				ctx.fillStyle = '#fff';
				ctx.fill();
				const age = String(c.age);
				drawText(ctx, age, 0, 76, {font: paci, size: age.length > 2 ? 150 : 210, fill: PINK, stroke: '#fff', strokeW: 16, shadow: LILAC, shadowDy: 8});
			}
			sparkle4(ctx, -180, -150, 30 + Math.sin(t * 5) * 8, GOLD, t);
			sparkle4(ctx, 190, -110, 24 + Math.cos(t * 5) * 6, '#fff', -t);
		});
		const np = outBack(prog(t, 4.0, 0.6));
		const ns = fitSize(ctx, c.name, paci, 620, 120, 48);
		withTransform(ctx, {x: W / 2, y: 780, scale: Math.max(0.01, np), rot: -0.03}, () => {
			drawText(ctx, c.name, 0, 0, {font: paci, size: ns, fill: '#fff', stroke: PINK, strokeW: ns * 0.2, shadow: PURPLE, shadowDy: ns * 0.07});
		});
		withTransform(ctx, {x: W / 2, y: 870, scale: Math.max(0.01, outBack(prog(t, 4.5, 0.5)))}, () => {
			drawText(ctx, `¡Cumple ${c.age} añitos!`, 0, 0, {font: fred, size: fitSize(ctx, `¡Cumple ${c.age} añitos!`, fred, 600, 60), fill: PURPLE, stroke: '#fff', strokeW: 12});
		});
		unicorn(ctx, W / 2, 1090, 0.62, t);
		ctx.restore();
	}

	// ---------- transición: estrellas y brillo ----------
	const wp = prog(t, 6.8, 0.6);
	if (wp > 0 && wp < 1) {
		ctx.save();
		for (let i = 0; i < 9; i++) {
			const a2 = (i / 9) * TAU;
			const r = outCubic(wp) * 900;
			ctx.globalAlpha = Math.sin(wp * Math.PI);
			starPath(ctx, W / 2 + Math.cos(a2) * r, 640 + Math.sin(a2) * r, 5, 80 * (1 - wp * 0.4), 36);
			ctx.fillStyle = RAINBOW[i % 7];
			ctx.fill();
		}
		ctx.fillStyle = `rgba(255,255,255,${Math.sin(wp * Math.PI) * 0.8})`;
		ctx.fillRect(0, 0, W, H);
		ctx.restore();
	}

	// ---------- C ----------
	const cc = window01(t, 7.1, 99, 0.35);
	if (cc > 0) {
		ctx.save();
		ctx.globalAlpha = cc;
		const hp = outElastic(prog(t, 7.2, 0.8));
		unicorn(ctx, 140, 180, 0.42, t);
		withTransform(ctx, {x: 440, y: 150, scale: Math.max(0.01, hp), rot: -0.03}, () => {
			drawText(ctx, '¡Te esperamos!', 0, 0, {font: paci, size: fitSize(ctx, '¡Te esperamos!', paci, 400, 66), fill: '#fff', stroke: PINK, strokeW: 14, shadow: PURPLE, shadowDy: 5});
		});
		withTransform(ctx, {x: 440, y: 230, alpha: prog(t, 7.6, 0.4)}, () => {
			drawText(ctx, `Cumple de ${c.name}`, 0, 0, {font: fred, size: fitSize(ctx, `Cumple de ${c.name}`, fred, 420, 44), fill: PURPLE, stroke: '#fff', strokeW: 9});
		});
		drawDetails(ctx, c, t, 7.8, {
			labelFont: fred,
			valueFont: fred,
			labelColor: PINK,
			valueColor: PURPLE,
			subColor: '#7a52b8',
			entrance: 'pop',
			y: 330,
			plate: cloudPlate,
		});
		ctx.restore();
	}
	twinkles(ctx, t, 14, ['#fff', GOLD, PINK], {seed: 90, y0: 60, y1: 1000, maxR: 22});
}

export const unicornios: TemplateDefinition = {
	id: 'unicornios',
	name: 'Magia de Unicornio',
	description: 'Arcoíris que se dibuja, unicornio de crin multicolor, nubes y corazones con paleta pastel.',
	category: 'Fantasía',
	audience: 'infantil',
	palette: [PINK, LILAC, GOLD, '#bfe6ff'],
	fonts: ['Pacifico', 'Fredoka'],
	duration: 11,
	fps: 24,
	defaultAudioId: 'cielo-de-caramelo',
	photoRule: 'La foto va dentro de un corazón con aro arcoíris; sin foto, la edad ocupa el corazón.',
	thumbnailTime: 5.6,
	draw,
};
