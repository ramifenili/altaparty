// Plantilla "Nivel Arcade": estética de videojuego retro con neón, grilla
// synthwave, pixel art original, barra de experiencia y diálogos con texto que
// se escribe solo. Todos los sprites son originales.

import type {TemplateDefinition, TemplateContent} from './types';
import {
	W, H, TAU, clamp01, lerp, prog, outCubic, outBack, window01, hash, withTransform, vGradient, staticLayer, drawText, fitSize, drawPhotoIn, drawDetails,
} from './kit';

const MAGENTA = '#ff2bd6';
const CYAN = '#19f9ff';
const YELLOW = '#fff200';
const GREEN = '#39ff14';
const NIGHT = '#0a0420';
const px = (s: number) => `${s}px PressStart, 'Courier New', monospace`;

const INVADER_A = ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...'];
const INVADER_B = ['..#.....#..', '#..#...#..#', '#.#######.#', '###.###.###', '###########', '.#########.', '..#.....#..', '.#.......#.'];
const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const COIN = ['..####..', '.######.', '###..###', '###..###', '###..###', '###..###', '.######.', '..####..'];
const HERO = ['....####....', '..########..', '.##########.', '.##.####.##.', '.##.####.##.', '.##########.', '.####..####.', '.##########.', '..########..', '...######...', '..##.##.##..', '.##......##.'];

function sprite(ctx: CanvasRenderingContext2D, rows: string[], x: number, y: number, s: number, color: string, eye?: string) {
	ctx.fillStyle = color;
	rows.forEach((row, ry) => {
		for (let rx = 0; rx < row.length; rx++) {
			if (row[rx] === '#') ctx.fillRect(Math.round(x + rx * s), Math.round(y + ry * s), s + 0.5, s + 0.5);
		}
	});
	if (eye) {
		ctx.fillStyle = eye;
		ctx.fillRect(x + 3 * s, y + 3 * s, s * 2, s * 2);
		ctx.fillRect(x + 7 * s, y + 3 * s, s * 2, s * 2);
	}
}

function arcade(ctx: CanvasRenderingContext2D, t: number) {
	staticLayer(ctx, 'gamer-bg', (c) => {
		c.fillStyle = vGradient(c, 0, H, [[0, '#0a0420'], [0.5, '#2a0a5e'], [0.68, '#7a1a8c'], [1, '#0a0420']]);
		c.fillRect(0, 0, W, H);
		// sol synthwave
		const g = c.createLinearGradient(0, 560, 0, 860);
		g.addColorStop(0, '#fff200');
		g.addColorStop(1, '#ff2bd6');
		c.save();
		c.beginPath();
		c.arc(W / 2, 710, 150, 0, TAU);
		c.clip();
		c.fillStyle = g;
		c.fillRect(0, 540, W, 340);
		c.fillStyle = '#2a0a5e';
		for (let i = 0; i < 8; i++) c.fillRect(0, 700 + i * 22, W, 4 + i * 2.4);
		c.restore();
		c.fillStyle = NIGHT;
		c.fillRect(0, 860, W, H - 860);
		c.fillStyle = MAGENTA;
		c.fillRect(0, 858, W, 4);
	});
	// grilla en movimiento
	ctx.save();
	ctx.strokeStyle = 'rgba(25,249,255,.75)';
	ctx.lineWidth = 3;
	for (let i = -12; i <= 12; i++) {
		ctx.beginPath();
		ctx.moveTo(W / 2 + i * 34, 862);
		ctx.lineTo(W / 2 + i * 210, H);
		ctx.stroke();
	}
	const ph = (t * 0.7) % 1;
	for (let k = 0; k < 9; k++) {
		const p = (k + ph) / 9;
		const y = 862 + p * p * 420;
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(W, y);
		ctx.stroke();
	}
	ctx.restore();
	// estrellas pixel
	for (let i = 0; i < 40; i++) {
		if (Math.sin(t * 3 + i * 5) < -0.3) continue;
		ctx.fillStyle = i % 3 ? '#fff' : CYAN;
		const s = 4 + (i % 2) * 4;
		ctx.fillRect(Math.round(hash(i, 1) * W / 8) * 8, Math.round(hash(i, 2) * 560 / 8) * 8, s, s);
	}
}

function pixelBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c1 = CYAN, c2 = MAGENTA, fill = '#12063a') {
	const n = 10;
	const notch = (xx: number, yy: number, ww: number, hh: number) => {
		ctx.beginPath();
		ctx.moveTo(xx + n, yy);
		ctx.lineTo(xx + ww - n, yy);
		ctx.lineTo(xx + ww - n, yy + n);
		ctx.lineTo(xx + ww, yy + n);
		ctx.lineTo(xx + ww, yy + hh - n);
		ctx.lineTo(xx + ww - n, yy + hh - n);
		ctx.lineTo(xx + ww - n, yy + hh);
		ctx.lineTo(xx + n, yy + hh);
		ctx.lineTo(xx + n, yy + hh - n);
		ctx.lineTo(xx, yy + hh - n);
		ctx.lineTo(xx, yy + n);
		ctx.lineTo(xx + n, yy + n);
		ctx.closePath();
	};
	notch(x, y, w, h);
	ctx.fillStyle = c1;
	ctx.fill();
	notch(x + 6, y + 6, w - 12, h - 12);
	ctx.fillStyle = c2;
	ctx.fill();
	notch(x + 12, y + 12, w - 24, h - 24);
	ctx.fillStyle = fill;
	ctx.fill();
}

function glitchText(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, color: string, t: number, amount = 5) {
	const j = Math.sin(t * 40) > 0.7 ? amount * 2 : amount * 0.4;
	drawText(ctx, str, x - j, y, {font: px, size, fill: MAGENTA});
	drawText(ctx, str, x + j, y, {font: px, size, fill: CYAN});
	drawText(ctx, str, x, y, {font: px, size, fill: color});
}

function draw(ctx: CanvasRenderingContext2D, {t, content: c}: {t: number; content: TemplateContent}) {
	arcade(ctx, t);
	const hasPhoto = !!c.photo;
	const blink = Math.floor(t * 2.5) % 2 === 0;

	// ---------- A ----------
	const a = window01(t, -1, 3.5, 0.3);
	if (a > 0) {
		ctx.save();
		ctx.globalAlpha = a;
		// invasores desfilando
		for (let row = 0; row < 3; row++) {
			for (let i = 0; i < 5; i++) {
				const dir = row % 2 ? -1 : 1;
				const x = ((i * 130 + t * 60 * dir + row * 60) % (W + 160) + (W + 160)) % (W + 160) - 80;
				sprite(ctx, Math.floor(t * 2 + i) % 2 ? INVADER_A : INVADER_B, x, 120 + row * 90, 6, [GREEN, MAGENTA, CYAN][row]);
			}
		}
		if (t < 2.2) {
			if (blink) drawText(ctx, 'INSERTÁ UNA FICHA', W / 2, 560, {font: px, size: fitSize(ctx, 'INSERTÁ UNA FICHA', px, 600, 40), fill: YELLOW});
			const cp = prog(t, 0.2, 1.0);
			sprite(ctx, COIN, W / 2 - 36, lerp(620, 740, outCubic(cp)), 9, YELLOW);
			ctx.fillStyle = '#000';
			ctx.fillRect(W / 2 - 80, 800, 160, 14);
			ctx.fillStyle = MAGENTA;
			ctx.fillRect(W / 2 - 80, 800, 160, 4);
		} else {
			const p = outBack(prog(t, 2.2, 0.4));
			withTransform(ctx, {x: W / 2, y: 620, scale: Math.max(0.01, p)}, () => {
				glitchText(ctx, '¡NUEVO', 0, -20, 74, '#fff', t);
				glitchText(ctx, 'NIVEL!', 0, 80, 74, YELLOW, t);
			});
			if (blink && t > 2.8) drawText(ctx, 'PRESS START', W / 2, 860, {font: px, size: 26, fill: '#fff'});
		}
		ctx.restore();
	}

	// ---------- B ----------
	const b = window01(t, 3.2, 7.1, 0.3);
	if (b > 0) {
		ctx.save();
		ctx.globalAlpha = b;
		const cp = outBack(prog(t, 3.3, 0.5));
		withTransform(ctx, {x: W / 2, y: 520, scale: Math.max(0.01, cp)}, () => {
			pixelBox(ctx, -280, -400, 560, 820);
			drawText(ctx, 'JUGADOR 1', 0, -330, {font: px, size: 30, fill: YELLOW});
			for (let i = 0; i < 3; i++) sprite(ctx, HEART, -76 + i * 56, -296, 6, '#ff3b5c');
			if (hasPhoto) {
				ctx.save();
				ctx.translate(0, -90);
				drawPhotoIn(ctx, c.photo, 'rounded', 0, 0, 150, undefined, 10);
				ctx.strokeStyle = YELLOW;
				ctx.lineWidth = 8;
				ctx.strokeRect(-150, -150, 300, 300);
				ctx.restore();
			} else {
				const bob = Math.floor(t * 4) % 2 ? 6 : 0;
				sprite(ctx, HERO, -120, -210 - bob, 20, CYAN, NIGHT);
			}
			const ns = fitSize(ctx, c.name.toLocaleUpperCase('es'), px, 500, 44, 18);
			glitchText(ctx, c.name.toLocaleUpperCase('es'), 0, 150, ns, '#fff', t, 3);
			drawText(ctx, `NIVEL ${c.age}`, 0, 220, {font: px, size: 34, fill: CYAN});
			// barra de experiencia
			const xp = clamp01((t - 3.9) / 2.2);
			ctx.fillStyle = '#000';
			ctx.fillRect(-220, 262, 440, 34);
			ctx.fillStyle = GREEN;
			ctx.fillRect(-216, 266, 432 * xp, 26);
			ctx.fillStyle = 'rgba(255,255,255,.35)';
			ctx.fillRect(-216, 266, 432 * xp, 8);
			drawText(ctx, 'EXP', -246, 292, {font: px, size: 14, fill: '#fff', align: 'right'});
			if (xp >= 1 && blink) drawText(ctx, '¡LEVEL UP!', 0, 366, {font: px, size: 34, fill: YELLOW});
			else if (xp < 1) drawText(ctx, 'CARGANDO...', 0, 366, {font: px, size: 20, fill: '#ffffff99'});
		});
		ctx.restore();
	}

	// ---------- transición: píxeles ----------
	const wp = prog(t, 6.8, 0.6);
	if (wp > 0 && wp < 1) {
		const cols = 12;
		const rows = 20;
		const cw = W / cols;
		const ch = H / rows;
		ctx.fillStyle = MAGENTA;
		for (let r = 0; r < rows; r++) {
			for (let k = 0; k < cols; k++) {
				const thr = hash(r * cols + k, 9);
				const on = wp < 0.5 ? thr < wp * 2 : thr > (wp - 0.5) * 2;
				if (on) ctx.fillRect(k * cw, r * ch, cw + 1, ch + 1);
			}
		}
	}

	// ---------- C ----------
	const cc = window01(t, 7.1, 99, 0.3);
	if (cc > 0) {
		ctx.save();
		ctx.globalAlpha = cc;
		const hp = outBack(prog(t, 7.2, 0.5));
		withTransform(ctx, {x: W / 2, y: 150, scale: Math.max(0.01, hp)}, () => {
			glitchText(ctx, '¡MISIÓN DE', 0, -10, fitSize(ctx, '¡MISIÓN DE', px, 560, 48), '#fff', t, 3);
			glitchText(ctx, 'LA NOCHE!', 0, 70, fitSize(ctx, 'LA NOCHE!', px, 560, 48), YELLOW, t, 3);
		});
		const name = `CUMPLE DE ${c.name.toLocaleUpperCase('es')}`;
		drawText(ctx, name, W / 2, 300, {font: px, size: fitSize(ctx, name, px, 640, 24, 12), fill: CYAN, glow: CYAN, glowBlur: 10});
		drawDetails(ctx, c, t, 7.6, {
			labelFont: px,
			valueFont: px,
			labelColor: MAGENTA,
			valueColor: '#fff',
			subColor: CYAN,
			labels: ['> FECHA', '> HORA', '> LUGAR'],
			entrance: 'type',
			y: 340,
			fontScale: 0.58,
			uppercase: true,
			delay: 0.7,
			plate: (g, x, y, w, h, i) => pixelBox(g, x, y, w, h, i % 2 ? MAGENTA : CYAN, i % 2 ? CYAN : MAGENTA),
		});
		for (let i = 0; i < 5; i++) sprite(ctx, COIN, 150 + i * 90, 1200 + Math.sin(t * 6 + i) * 6, 5, YELLOW);
		ctx.restore();
	}

	// confeti pixel
	for (let i = 0; i < 26; i++) {
		const x = Math.round(hash(i, 51) * W / 12) * 12;
		const y = ((hash(i, 52) * H + t * (80 + hash(i, 53) * 120)) % (H + 40)) - 20;
		ctx.fillStyle = [MAGENTA, CYAN, YELLOW, GREEN][i % 4];
		ctx.fillRect(x, Math.round(y / 8) * 8, 10, 10);
	}
	// scanlines + viñeta CRT
	staticLayer(ctx, 'gamer-crt', (g) => {
		g.fillStyle = 'rgba(0,0,0,.16)';
		for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
		const v = g.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 900);
		v.addColorStop(0, 'rgba(0,0,0,0)');
		v.addColorStop(1, 'rgba(0,0,0,.55)');
		g.fillStyle = v;
		g.fillRect(0, 0, W, H);
	});
}

export const gamer: TemplateDefinition = {
	id: 'gamer',
	name: 'Nivel Arcade',
	description: 'Estética de videojuego retro con neón, invasores pixel, barra de experiencia y diálogos que se escriben solos.',
	category: 'Gamer',
	audience: 'juvenil',
	palette: [MAGENTA, CYAN, YELLOW, NIGHT],
	fonts: ['PressStart'],
	duration: 11,
	fps: 24,
	defaultAudioId: 'nivel-arcade',
	photoRule: 'La foto se pixela dentro del marco del jugador; sin foto, aparece un héroe de pixel art.',
	thumbnailTime: 5.6,
	draw,
};
