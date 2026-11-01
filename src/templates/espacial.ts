// Plantilla "Misión Espacial": cuenta regresiva, cohete, astronauta flotando
// (la foto va dentro del visor), planetas con anillos y panel de misión.

import type {TemplateDefinition, TemplateContent} from './types';
import {
	W, H, TAU, clamp01, lerp, prog, outCubic, outBack, outElastic, window01, hash, withTransform, roundRectPath, sparkle4, glow, vGradient, staticLayer, drawText, fitSize, drawPhotoIn, drawDetails,
} from './kit';

const CYAN = '#5de0ff';
const ORANGE = '#ff8a3d';
const YELLOW = '#ffd23f';
const PURPLE = '#8b5cf6';
const mont = (s: number) => `800 ${s}px Montserrat, system-ui, sans-serif`;
const fred = (s: number) => `700 ${s}px Fredoka, system-ui, sans-serif`;

function space(ctx: CanvasRenderingContext2D, t: number, warp: number) {
	staticLayer(ctx, 'space-bg', (c) => {
		c.fillStyle = vGradient(c, 0, H, [[0, '#04061a'], [0.5, '#150a45'], [1, '#07103a']]);
		c.fillRect(0, 0, W, H);
		const blobs: [number, number, number, string][] = [[140, 260, 340, 'rgba(255,60,172,.22)'], [600, 640, 380, 'rgba(93,224,255,.16)'], [260, 1050, 360, 'rgba(139,92,246,.25)']];
		blobs.forEach(([x, y, r, col]) => {
			const g = c.createRadialGradient(x, y, 0, x, y, r);
			g.addColorStop(0, col);
			g.addColorStop(1, 'rgba(0,0,0,0)');
			c.fillStyle = g;
			c.fillRect(0, 0, W, H);
		});
	});
	// estrellas (con estela durante el salto al hiperespacio)
	for (let i = 0; i < 90; i++) {
		const x = hash(i, 1) * W;
		const y0 = hash(i, 2) * H;
		const speed = 6 + hash(i, 3) * 26;
		const y = (y0 + t * speed) % H;
		const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
		ctx.fillStyle = `rgba(255,255,255,${0.35 + tw * 0.5})`;
		const r = 0.8 + hash(i, 4) * 1.8;
		if (warp > 0.01) {
			ctx.fillRect(x, y - warp * 160 * hash(i, 5), r, r + warp * 200 * hash(i, 5));
		} else {
			ctx.beginPath();
			ctx.arc(x, y, r, 0, TAU);
			ctx.fill();
		}
	}
	// planeta anillado
	ctx.save();
	ctx.translate(590 + Math.sin(t * 0.3) * 8, 190);
	ctx.rotate(-0.35);
	ctx.strokeStyle = 'rgba(255,214,120,.8)';
	ctx.lineWidth = 14;
	ctx.beginPath();
	ctx.ellipse(0, 0, 130, 34, 0, Math.PI, TAU);
	ctx.stroke();
	const pg = ctx.createRadialGradient(-20, -24, 6, 0, 0, 80);
	pg.addColorStop(0, '#ffcf8a');
	pg.addColorStop(1, '#d26a2a');
	ctx.fillStyle = pg;
	ctx.beginPath();
	ctx.arc(0, 0, 74, 0, TAU);
	ctx.fill();
	ctx.save();
	ctx.beginPath();
	ctx.arc(0, 0, 74, 0, TAU);
	ctx.clip();
	ctx.fillStyle = 'rgba(160,70,20,.35)';
	ctx.fillRect(-80, -22, 160, 16);
	ctx.fillRect(-80, 16, 160, 12);
	ctx.restore();
	ctx.strokeStyle = 'rgba(255,214,120,.9)';
	ctx.lineWidth = 14;
	ctx.beginPath();
	ctx.ellipse(0, 0, 130, 34, 0, 0, Math.PI);
	ctx.stroke();
	ctx.restore();
	// planeta azul
	const bg = ctx.createRadialGradient(100, 880, 8, 110, 900, 110);
	bg.addColorStop(0, '#9ff0c8');
	bg.addColorStop(0.5, '#2f8fe0');
	bg.addColorStop(1, '#10357a');
	ctx.fillStyle = bg;
	ctx.beginPath();
	ctx.arc(110 + Math.sin(t * 0.4) * 6, 900, 90, 0, TAU);
	ctx.fill();
	ctx.fillStyle = 'rgba(80,200,120,.7)';
	ctx.beginPath();
	ctx.ellipse(90, 880, 34, 22, 0.5, 0, TAU);
	ctx.ellipse(140, 930, 24, 14, -0.3, 0, TAU);
	ctx.fill();
	// lunita roja
	ctx.fillStyle = '#e0553a';
	ctx.beginPath();
	ctx.arc(640, 1040, 36, 0, TAU);
	ctx.fill();
	ctx.fillStyle = 'rgba(0,0,0,.2)';
	ctx.beginPath();
	ctx.arc(630, 1032, 9, 0, TAU);
	ctx.arc(654, 1052, 6, 0, TAU);
	ctx.fill();
}

function rocket(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s, s);
	const fl = 0.8 + Math.sin(t * 40) * 0.2;
	const fg = ctx.createLinearGradient(0, 110, 0, 280 * fl);
	fg.addColorStop(0, '#fff7b0');
	fg.addColorStop(0.4, ORANGE);
	fg.addColorStop(1, 'rgba(255,60,60,0)');
	ctx.fillStyle = fg;
	ctx.beginPath();
	ctx.moveTo(-40, 100);
	ctx.quadraticCurveTo(0, 340 * fl, 40, 100);
	ctx.fill();
	ctx.fillStyle = '#e0334a';
	for (const side of [-1, 1]) {
		ctx.beginPath();
		ctx.moveTo(side * 50, 20);
		ctx.lineTo(side * 110, 130);
		ctx.lineTo(side * 50, 110);
		ctx.fill();
	}
	const bg = ctx.createLinearGradient(-60, 0, 60, 0);
	bg.addColorStop(0, '#d9e2f2');
	bg.addColorStop(0.5, '#fff');
	bg.addColorStop(1, '#b9c6dd');
	ctx.fillStyle = bg;
	ctx.beginPath();
	ctx.moveTo(0, -170);
	ctx.bezierCurveTo(90, -90, 66, 60, 54, 110);
	ctx.lineTo(-54, 110);
	ctx.bezierCurveTo(-66, 60, -90, -90, 0, -170);
	ctx.fill();
	ctx.fillStyle = '#e0334a';
	ctx.beginPath();
	ctx.moveTo(0, -170);
	ctx.bezierCurveTo(38, -140, 52, -110, 58, -90);
	ctx.lineTo(-58, -90);
	ctx.bezierCurveTo(-52, -110, -38, -140, 0, -170);
	ctx.fill();
	ctx.fillStyle = '#2a6fdb';
	ctx.beginPath();
	ctx.arc(0, -30, 30, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = '#8fb4e8';
	ctx.lineWidth = 8;
	ctx.stroke();
	ctx.fillStyle = 'rgba(255,255,255,.6)';
	ctx.beginPath();
	ctx.arc(-9, -40, 8, 0, TAU);
	ctx.fill();
	ctx.restore();
}

function astronaut(ctx: CanvasRenderingContext2D, c: TemplateContent, x: number, y: number, s: number, t: number) {
	const float = Math.sin(t * 1.6) * 14;
	ctx.save();
	ctx.translate(x, y + float);
	ctx.rotate(Math.sin(t * 1.1) * 0.09);
	ctx.scale(s, s);
	const white = ctx.createLinearGradient(-90, 0, 90, 0);
	white.addColorStop(0, '#dfe7f5');
	white.addColorStop(0.5, '#ffffff');
	white.addColorStop(1, '#b8c5df');
	// mochila
	ctx.fillStyle = '#9fb0d0';
	roundRectPath(ctx, -118, 70, 236, 220, 40);
	ctx.fill();
	// piernas
	ctx.fillStyle = white;
	roundRectPath(ctx, -78, 270, 62, 150, 28);
	ctx.fill();
	roundRectPath(ctx, 16, 270, 62, 150, 28);
	ctx.fill();
	ctx.fillStyle = '#e0334a';
	roundRectPath(ctx, -84, 400, 74, 40, 16);
	ctx.fill();
	roundRectPath(ctx, 10, 400, 74, 40, 16);
	ctx.fill();
	// torso
	ctx.fillStyle = white;
	roundRectPath(ctx, -94, 90, 188, 200, 50);
	ctx.fill();
	ctx.fillStyle = '#2a3a66';
	roundRectPath(ctx, -52, 140, 104, 70, 16);
	ctx.fill();
	[[-30, '#ff4f6a'], [0, YELLOW], [30, '#5de07a']].forEach(([bx, col]) => {
		ctx.fillStyle = col as string;
		ctx.beginPath();
		ctx.arc(bx as number, 175, 9, 0, TAU);
		ctx.fill();
	});
	// brazos
	ctx.strokeStyle = '#e8eef9';
	ctx.lineCap = 'round';
	ctx.lineWidth = 46;
	const wave = Math.sin(t * 5) * 0.4;
	ctx.beginPath();
	ctx.moveTo(-84, 130);
	ctx.quadraticCurveTo(-150, 150, -150 - Math.cos(wave) * 20, 60 + wave * 20);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(84, 130);
	ctx.quadraticCurveTo(150, 190, 134, 250);
	ctx.stroke();
	ctx.fillStyle = '#ffd23f';
	ctx.beginPath();
	ctx.arc(-150 - Math.cos(wave) * 20, 56 + wave * 20, 24, 0, TAU);
	ctx.fill();
	// casco
	ctx.fillStyle = white;
	ctx.beginPath();
	ctx.arc(0, 0, 124, 0, TAU);
	ctx.fill();
	ctx.strokeStyle = '#b8c5df';
	ctx.lineWidth = 8;
	ctx.stroke();
	// visor
	ctx.save();
	ctx.beginPath();
	ctx.ellipse(0, 4, 96, 82, 0, 0, TAU);
	ctx.clip();
	const vg = ctx.createLinearGradient(0, -80, 0, 90);
	vg.addColorStop(0, '#1a2a6a');
	vg.addColorStop(1, '#0a1240');
	ctx.fillStyle = vg;
	ctx.fillRect(-100, -90, 200, 190);
	if (c.photo) {
		drawPhotoIn(ctx, c.photo, 'circle', 0, 4, 92);
		ctx.fillStyle = 'rgba(30,60,160,.18)';
		ctx.fillRect(-100, -90, 200, 190);
	} else {
		ctx.fillStyle = YELLOW;
		sparkle4(ctx, -30, -20, 26, YELLOW, t);
		ctx.fillStyle = '#fff';
		ctx.beginPath();
		ctx.arc(-34, 10, 9, 0, TAU);
		ctx.arc(34, 10, 9, 0, TAU);
		ctx.fill();
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 7;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.arc(0, 18, 36, 0.25, Math.PI - 0.25);
		ctx.stroke();
	}
	const rg = ctx.createLinearGradient(-90, -80, 20, 20);
	rg.addColorStop(0, 'rgba(255,255,255,.55)');
	rg.addColorStop(0.45, 'rgba(255,255,255,0)');
	ctx.fillStyle = rg;
	ctx.fillRect(-100, -90, 200, 190);
	ctx.restore();
	ctx.strokeStyle = '#2a3a66';
	ctx.lineWidth = 8;
	ctx.beginPath();
	ctx.ellipse(0, 4, 96, 82, 0, 0, TAU);
	ctx.stroke();
	ctx.restore();
}

function hudPlate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
	ctx.save();
	ctx.fillStyle = 'rgba(8,14,50,.78)';
	roundRectPath(ctx, x, y, w, h, 14);
	ctx.fill();
	ctx.strokeStyle = 'rgba(93,224,255,.35)';
	ctx.lineWidth = 2;
	roundRectPath(ctx, x, y, w, h, 14);
	ctx.stroke();
	ctx.strokeStyle = CYAN;
	ctx.lineWidth = 5;
	ctx.shadowColor = CYAN;
	ctx.shadowBlur = 14;
	const L = 34;
	for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
		ctx.beginPath();
		ctx.moveTo(cx + dx * L, cy);
		ctx.lineTo(cx, cy);
		ctx.lineTo(cx, cy + dy * L);
		ctx.stroke();
	}
	ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, {t, content: c}: {t: number; content: TemplateContent}) {
	const warp = clamp01(Math.sin(clamp01((t - 3.0) / 0.9) * Math.PI)) * 0.9;
	space(ctx, t, warp);

	// ---------- A: cuenta regresiva y despegue ----------
	const a = window01(t, -1, 3.6, 0.4);
	if (a > 0) {
		ctx.save();
		ctx.globalAlpha = a;
		const digit = t < 0.9 ? '3' : t < 1.6 ? '2' : t < 2.3 ? '1' : '';
		if (digit) {
			const local = (t < 0.9 ? t : t < 1.6 ? t - 0.9 : t - 1.6) / 0.7;
			withTransform(ctx, {x: W / 2, y: 520, scale: lerp(1.5, 0.9, clamp01(local)), alpha: 1 - clamp01(local - 0.7) * 3}, () => {
				glow(ctx, 0, -60, 260, 'rgba(93,224,255,.5)');
				drawText(ctx, digit, 0, 0, {font: mont, size: 360, fill: '#fff', stroke: CYAN, strokeW: 14, glow: CYAN, glowBlur: 40});
			});
		}
		if (t > 2.3) {
			const p = outBack(prog(t, 2.3, 0.5));
			withTransform(ctx, {x: W / 2, y: 400, scale: Math.max(0.01, p)}, () => {
				drawText(ctx, '¡DESPEGUE!', 0, 0, {font: mont, size: fitSize(ctx, '¡DESPEGUE!', mont, 620, 110), fill: '#fff', stroke: ORANGE, strokeW: 14, glow: ORANGE, glowBlur: 30});
			});
		}
		const ry = t < 2.3 ? 1000 + Math.sin(t * 30) * 3 : lerp(1000, -500, Math.pow(prog(t, 2.3, 1.2), 2));
		rocket(ctx, W / 2, ry, 1.3, t);
		drawText(ctx, 'MISIÓN CUMPLEAÑOS', W / 2, 140, {font: mont, size: 38, fill: CYAN, glow: CYAN, glowBlur: 16, spacing: 3});
		ctx.restore();
	}

	// ---------- B: astronauta con la foto en el visor ----------
	const b = window01(t, 3.3, 7.1, 0.4);
	if (b > 0) {
		ctx.save();
		ctx.globalAlpha = b;
		const ap = outBack(prog(t, 3.5, 0.8));
		astronaut(ctx, c, W / 2, lerp(1500, 450, ap), 1.05, t);
		// planeta pequeño con la edad en órbita
		const ang = t * 1.1;
		const ox = W / 2 + Math.cos(ang) * 270;
		const oy = 520 + Math.sin(ang) * 80;
		const behind = Math.sin(ang) < 0;
		if (!behind || true) {
			withTransform(ctx, {x: ox, y: oy, scale: 0.8 + Math.sin(ang) * 0.15}, () => {
				const g = ctx.createRadialGradient(-16, -18, 6, 0, 0, 74);
				g.addColorStop(0, '#fff2a8');
				g.addColorStop(1, '#ff8a3d');
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.arc(0, 0, 70, 0, TAU);
				ctx.fill();
				const age = String(c.age);
				drawText(ctx, age, 0, 28, {font: mont, size: age.length > 2 ? 52 : 74, fill: '#fff', stroke: '#c0541a', strokeW: 10});
			});
		}
		const np = outBack(prog(t, 4.3, 0.55));
		const ns = fitSize(ctx, c.name.toLocaleUpperCase('es'), mont, 620, 96, 38);
		withTransform(ctx, {x: W / 2, y: 940, scale: Math.max(0.01, np)}, () => {
			drawText(ctx, c.name.toLocaleUpperCase('es'), 0, 0, {font: mont, size: ns, fill: '#fff', stroke: PURPLE, strokeW: ns * 0.12, glow: CYAN, glowBlur: 24});
		});
		withTransform(ctx, {x: W / 2, y: 1030, scale: Math.max(0.01, outBack(prog(t, 4.8, 0.5)))}, () => {
			drawText(ctx, `ASTRONAUTA DE ${c.age} AÑOS`, 0, 0, {font: mont, size: fitSize(ctx, `ASTRONAUTA DE ${c.age} AÑOS`, mont, 600, 40), fill: YELLOW, glow: YELLOW, glowBlur: 14, spacing: 1});
		});
		ctx.restore();
	}

	// ---------- transición: anillo de energía ----------
	const wp = prog(t, 6.8, 0.6);
	if (wp > 0 && wp < 1) {
		ctx.save();
		ctx.strokeStyle = CYAN;
		ctx.lineWidth = 40 * (1 - wp) + 4;
		ctx.shadowColor = CYAN;
		ctx.shadowBlur = 40;
		ctx.globalAlpha = 1 - wp * 0.7;
		ctx.beginPath();
		ctx.arc(W / 2, 640, outCubic(wp) * 1100, 0, TAU);
		ctx.stroke();
		ctx.fillStyle = `rgba(93,224,255,${Math.sin(wp * Math.PI) * 0.35})`;
		ctx.fillRect(0, 0, W, H);
		ctx.restore();
	}

	// ---------- C: panel de misión ----------
	const cc = window01(t, 7.1, 99, 0.35);
	if (cc > 0) {
		ctx.save();
		ctx.globalAlpha = cc;
		const hp = outElastic(prog(t, 7.2, 0.8));
		withTransform(ctx, {x: W / 2, y: 150, scale: Math.max(0.01, hp)}, () => {
			drawText(ctx, 'MISIÓN: CUMPLEAÑOS', 0, 0, {font: mont, size: fitSize(ctx, 'MISIÓN: CUMPLEAÑOS', mont, 640, 56), fill: '#fff', glow: CYAN, glowBlur: 22, spacing: 1});
		});
		const name = c.name.toLocaleUpperCase('es');
		withTransform(ctx, {x: W / 2, y: 255, alpha: prog(t, 7.5, 0.4)}, () => {
			drawText(ctx, name, 0, 0, {font: mont, size: fitSize(ctx, name, mont, 620, 78, 34), fill: YELLOW, stroke: '#7a4b00', strokeW: 8, glow: ORANGE, glowBlur: 20});
		});
		drawDetails(ctx, c, t, 7.8, {
			labelFont: mont,
			valueFont: fred,
			labelColor: CYAN,
			valueColor: '#fff',
			subColor: '#b8d4ff',
			labels: ['FECHA DE LANZAMIENTO', 'HORA DE DESPEGUE', 'BASE ESPACIAL'],
			entrance: 'slide',
			y: 310,
			glow: 'rgba(93,224,255,.6)',
			fontScale: 1,
			plate: hudPlate,
		});
		ctx.restore();
	}
	// destellos
	for (let i = 0; i < 8; i++) {
		const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 2);
		sparkle4(ctx, hash(i, 31) * W, hash(i, 32) * H, 16 * tw, '#fff', t * 0.4);
	}
}

export const espacial: TemplateDefinition = {
	id: 'espacial',
	name: 'Misión Espacial',
	description: 'Cuenta regresiva, cohete y un astronauta que lleva tu foto en el visor, con planetas y panel de misión.',
	category: 'Espacio',
	audience: 'infantil',
	palette: ['#150a45', CYAN, ORANGE, YELLOW],
	fonts: ['Montserrat', 'Fredoka'],
	duration: 11,
	fps: 24,
	defaultAudioId: 'cuenta-regresiva',
	photoRule: 'La foto se ve dentro del visor del astronauta; sin foto, el visor muestra una carita con estrellas.',
	thumbnailTime: 5.4,
	draw,
};
