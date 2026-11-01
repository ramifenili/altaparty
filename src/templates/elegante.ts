// Plantilla "Gala Dorada": negro y oro, marco art déco que se dibuja,
// confeti fino, luces bokeh, cortinas doradas y tipografía serif elegante.

import type {TemplateDefinition, TemplateContent} from './types';
import {
	W, H, TAU, clamp01, lerp, prog, outCubic, inOutCubic, outBack, window01, hash, withTransform, sparkle4, glow, staticLayer, drawText, fitSize, drawPhotoIn, confetti, drawDetails,
} from './kit';

const GOLD = '#d4af37';
const GOLD_L = '#f7e7a8';
const GOLD_D = '#8a6d1d';
const CREAM = '#f5ecd7';
const INK = '#0b0b0f';
const serif = (s: number) => `700 ${s}px Playfair, Georgia, serif`;
const sans = (s: number) => `800 ${s}px Montserrat, system-ui, sans-serif`;

function goldFill(ctx: CanvasRenderingContext2D, y0: number, y1: number) {
	const g = ctx.createLinearGradient(0, y0, 0, y1);
	g.addColorStop(0, GOLD_L);
	g.addColorStop(0.45, GOLD);
	g.addColorStop(0.75, GOLD_D);
	g.addColorStop(1, '#f3d98a');
	return g;
}

function goldText(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, font = serif, spacing?: number) {
	drawText(ctx, str, x, y, {font, size, fill: goldFill(ctx, y - size, y + size * 0.2), spacing, shadow: 'rgba(0,0,0,.6)', shadowDy: size * 0.04});
}

function ornament(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, alpha = 1) {
	ctx.save();
	ctx.globalAlpha *= alpha;
	ctx.strokeStyle = GOLD;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(x - w / 2, y);
	ctx.lineTo(x - 18, y);
	ctx.moveTo(x + 18, y);
	ctx.lineTo(x + w / 2, y);
	ctx.stroke();
	ctx.fillStyle = GOLD;
	ctx.beginPath();
	ctx.moveTo(x, y - 10);
	ctx.lineTo(x + 10, y);
	ctx.lineTo(x, y + 10);
	ctx.lineTo(x - 10, y);
	ctx.fill();
	ctx.restore();
}

function background(ctx: CanvasRenderingContext2D, t: number) {
	staticLayer(ctx, 'elegante-bg', (c) => {
		c.fillStyle = INK;
		c.fillRect(0, 0, W, H);
		const g = c.createRadialGradient(W / 2, 380, 20, W / 2, 380, 760);
		g.addColorStop(0, 'rgba(212,175,55,.28)');
		g.addColorStop(1, 'rgba(0,0,0,0)');
		c.fillStyle = g;
		c.fillRect(0, 0, W, H);
		c.fillStyle = 'rgba(212,175,55,.05)';
		for (let x = 0; x < W; x += 36) c.fillRect(x, 0, 2, H);
	});
	// bokeh
	for (let i = 0; i < 14; i++) {
		const p = (t * (0.015 + hash(i, 2) * 0.02) + hash(i, 3)) % 1;
		const x = hash(i, 4) * W + Math.sin(t * 0.4 + i) * 30;
		const y = H + 80 - p * (H + 160);
		glow(ctx, x, y, 30 + hash(i, 5) * 60, i % 2 ? 'rgba(247,231,168,.5)' : 'rgba(212,175,55,.5)', 0.35);
	}
}

function frame(ctx: CanvasRenderingContext2D, p: number) {
	const inset = 34;
	const w = W - inset * 2;
	const h = H - inset * 2;
	const per = (w + h) * 2;
	ctx.save();
	ctx.strokeStyle = goldFill(ctx, 0, H);
	for (const [off, lw] of [[0, 4], [16, 1.5]] as const) {
		ctx.lineWidth = lw;
		ctx.setLineDash([per * p, per]);
		ctx.strokeRect(inset + off, inset + off, w - off * 2, h - off * 2);
	}
	ctx.setLineDash([]);
	if (p > 0.9) {
		const a = clamp01((p - 0.9) * 10);
		ctx.globalAlpha = a;
		for (const [cx, cy, sx, sy] of [[inset, inset, 1, 1], [W - inset, inset, -1, 1], [inset, H - inset, 1, -1], [W - inset, H - inset, -1, -1]]) {
			ctx.save();
			ctx.translate(cx, cy);
			ctx.scale(sx, sy);
			ctx.strokeStyle = GOLD;
			ctx.lineWidth = 2;
			for (let r = 30; r <= 90; r += 20) {
				ctx.beginPath();
				ctx.arc(0, 0, r, 0, Math.PI / 2);
				ctx.stroke();
			}
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(96, 96);
			ctx.stroke();
			ctx.restore();
		}
	}
	ctx.restore();
}

function curtains(ctx: CanvasRenderingContext2D, amount: number) {
	if (amount <= 0.001) return;
	const w = (W / 2) * amount;
	for (const side of [0, 1]) {
		const x = side ? W - w : 0;
		const g = ctx.createLinearGradient(x, 0, x + w, 0);
		g.addColorStop(0, '#5c4510');
		g.addColorStop(0.5, '#c9a43a');
		g.addColorStop(1, '#5c4510');
		ctx.fillStyle = g;
		ctx.fillRect(x, 0, w, H);
		ctx.strokeStyle = 'rgba(0,0,0,.25)';
		ctx.lineWidth = 6;
		for (let k = 1; k < 6; k++) {
			ctx.beginPath();
			ctx.moveTo(x + (w / 6) * k, 0);
			ctx.lineTo(x + (w / 6) * k, H);
			ctx.stroke();
		}
	}
}

function draw(ctx: CanvasRenderingContext2D, {t, content: c}: {t: number; content: TemplateContent}) {
	background(ctx, t);
	const hasPhoto = !!c.photo;
	frame(ctx, outCubic(prog(t, 0.2, 1.6)));

	// ---------- A ----------
	const a = window01(t, -1, 3.2, 0.4);
	if (a > 0) {
		ctx.save();
		ctx.globalAlpha = a;
		const p1 = prog(t, 1.0, 0.8);
		ctx.save();
		ctx.globalAlpha *= p1;
		goldText(ctx, 'TE INVITO A CELEBRAR', W / 2, 520 + (1 - p1) * 20, 28, sans, 8);
		ctx.restore();
		const p2 = outCubic(prog(t, 1.4, 1.0));
		ctx.save();
		ctx.globalAlpha *= p2;
		goldText(ctx, 'MI', W / 2, 630 + (1 - p2) * 30, 64);
		goldText(ctx, 'CUMPLEAÑOS', W / 2, 740 + (1 - p2) * 30, fitSize(ctx, 'CUMPLEAÑOS', serif, 600, 112));
		ctx.restore();
		ornament(ctx, W / 2, 800, 420, prog(t, 2.0, 0.6));
		const p3 = prog(t, 2.2, 0.6);
		ctx.globalAlpha = a * p3;
		drawText(ctx, 'Una noche inolvidable', W / 2, 880, {font: serif, size: 36, fill: CREAM, spacing: 0.5});
		ctx.globalAlpha = a;
		// destello que recorre el título
		const sh = prog(t, 2.0, 1.0);
		if (sh > 0 && sh < 1) sparkle4(ctx, lerp(60, 660, sh), 700, 44, '#fff', sh * 6);
		ctx.restore();
	}

	// ---------- B ----------
	const b = window01(t, 3.3, 7.1, 0.4);
	if (b > 0) {
		ctx.save();
		ctx.globalAlpha = b;
		const pp = outBack(prog(t, 3.5, 0.8));
		withTransform(ctx, {x: W / 2, y: 470, scale: Math.max(0.01, pp)}, () => {
			glow(ctx, 0, 0, 340, 'rgba(212,175,55,.45)');
			const R = 210;
			// aro dorado con perlas
			ctx.save();
			ctx.scale(0.82, 1);
			ctx.strokeStyle = goldFill(ctx, -R, R);
			ctx.lineWidth = 14;
			ctx.beginPath();
			ctx.arc(0, 0, R + 10, 0, TAU);
			ctx.stroke();
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(0, 0, R + 34, 0, TAU);
			ctx.stroke();
			ctx.restore();
			for (let i = 0; i < 40; i++) {
				const an = (i / 40) * TAU + t * 0.1;
				ctx.fillStyle = i % 2 ? GOLD_L : GOLD;
				ctx.beginPath();
				ctx.arc(Math.cos(an) * (R + 34) * 0.82, Math.sin(an) * (R + 34), 5, 0, TAU);
				ctx.fill();
			}
			ctx.save();
			ctx.beginPath();
			ctx.ellipse(0, 0, R * 0.82, R, 0, 0, TAU);
			ctx.clip();
			ctx.fillStyle = '#17140c';
			ctx.fillRect(-R, -R, R * 2, R * 2);
			ctx.restore();
			if (hasPhoto) {
				drawPhotoIn(ctx, c.photo, 'oval', 0, 0, R);
			} else {
				const age = String(c.age);
				goldText(ctx, age, 0, age.length > 2 ? 90 : 120, age.length > 2 ? 250 : 340);
				goldText(ctx, 'AÑOS', 0, 170, 36, sans, 10);
			}
		});
		if (hasPhoto) {
			withTransform(ctx, {x: 520, y: 650, scale: Math.max(0.01, outBack(prog(t, 4.2, 0.6)))}, () => {
				ctx.fillStyle = goldFill(ctx, -64, 64);
				ctx.beginPath();
				ctx.arc(0, 0, 64, 0, TAU);
				ctx.fill();
				ctx.strokeStyle = INK;
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.arc(0, 0, 54, 0, TAU);
				ctx.stroke();
				const age = String(c.age);
				drawText(ctx, age, 0, 20, {font: serif, size: age.length > 2 ? 44 : 62, fill: INK});
			});
		}
		const np = prog(t, 4.3, 0.8);
		ctx.save();
		ctx.globalAlpha *= np;
		const ns = fitSize(ctx, c.name, serif, 600, 104, 42);
		goldText(ctx, c.name, W / 2, 900 + (1 - outCubic(np)) * 24, ns);
		ctx.restore();
		ctx.save();
		ctx.globalAlpha *= prog(t, 4.9, 0.6);
		drawText(ctx, hasPhoto ? `CUMPLE ${c.age} AÑOS` : 'FELIZ CUMPLEAÑOS', W / 2, 980, {font: sans, size: 30, fill: CREAM, spacing: 4});
		ctx.restore();
		ornament(ctx, W / 2, 1030, 420, prog(t, 5.2, 0.6));
		ctx.restore();
	}

	// ---------- C ----------
	const cc = window01(t, 7.2, 99, 0.4);
	if (cc > 0) {
		ctx.save();
		ctx.globalAlpha = cc;
		ornament(ctx, W / 2, 120, 420, prog(t, 7.3, 0.5));
		ctx.save();
		ctx.globalAlpha *= prog(t, 7.4, 0.6);
		goldText(ctx, 'RESERVÁ LA FECHA', W / 2, 190, 28, sans, 8);
		const ns = fitSize(ctx, c.name, serif, 600, 92, 38);
		goldText(ctx, c.name, W / 2, 290, ns);
		ctx.restore();
		drawDetails(ctx, c, t, 7.9, {
			labelFont: sans,
			valueFont: serif,
			labelColor: GOLD,
			valueColor: CREAM,
			subColor: GOLD_L,
			entrance: 'fade',
			y: 350,
			uppercase: false,
			plate: (g, x, y, w, h) => {
				g.save();
				g.fillStyle = 'rgba(255,255,255,.04)';
				g.fillRect(x, y, w, h);
				g.strokeStyle = GOLD;
				g.lineWidth = 1.5;
				g.beginPath();
				g.moveTo(x, y);
				g.lineTo(x + w, y);
				g.moveTo(x, y + h);
				g.lineTo(x + w, y + h);
				g.stroke();
				g.fillStyle = GOLD;
				for (const dx of [x, x + w]) {
					for (const dy of [y, y + h]) {
						g.beginPath();
						g.moveTo(dx, dy - 6);
						g.lineTo(dx + 6, dy);
						g.lineTo(dx, dy + 6);
						g.lineTo(dx - 6, dy);
						g.fill();
					}
				}
				g.restore();
			},
		});
		ctx.restore();
	}

	// ---------- cortinas (A→B) y brillo (B→C) ----------
	const cur = t < 3.6 ? inOutCubic(prog(t, 2.6, 0.7)) : 1 - inOutCubic(prog(t, 3.3, 0.8));
	curtains(ctx, t > 2.6 && t < 4.1 ? clamp01(cur) : 0);
	const sw = prog(t, 6.8, 0.8);
	if (sw > 0 && sw < 1) {
		const x = lerp(-300, W + 300, outCubic(sw));
		const g = ctx.createLinearGradient(x - 160, 0, x + 160, 0);
		g.addColorStop(0, 'rgba(255,240,180,0)');
		g.addColorStop(0.5, 'rgba(255,240,180,.55)');
		g.addColorStop(1, 'rgba(255,240,180,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, W, H);
	}

	confetti(ctx, t, {count: 46, colors: [GOLD, GOLD_L, '#fff', GOLD_D], seed: 21, speed: 0.55, size: 9});
	confetti(ctx, t, {count: 20, colors: [GOLD, GOLD_L], seed: 77, speed: 0.4, size: 6, shape: 'circle'});
	for (let i = 0; i < 6; i++) {
		const tw = Math.max(0, Math.sin(t * 1.5 + i * 2.1));
		sparkle4(ctx, 80 + hash(i, 41) * 560, 100 + hash(i, 42) * 1000, 22 * tw, GOLD_L, t * 0.3);
	}
}

export const elegante: TemplateDefinition = {
	id: 'elegante',
	name: 'Gala Dorada',
	description: 'Negro y oro con marco art déco que se dibuja, cortinas doradas, confeti fino y tipografía serif.',
	category: 'Elegante',
	audience: 'elegante',
	palette: [INK, GOLD, GOLD_L, CREAM],
	fonts: ['Playfair', 'Montserrat'],
	duration: 11,
	fps: 24,
	defaultAudioId: 'gala-dorada',
	photoRule: 'La foto va en un óvalo dorado con perlas y la edad en un medallón; sin foto, la edad se luce en dorado.',
	thumbnailTime: 5.6,
	draw,
};
