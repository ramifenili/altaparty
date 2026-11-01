// Plantilla "Fiesta Tropical": atardecer con palmeras, mar con olas, banderines,
// una piña con anteojos, hibiscos y carteles de madera.

import type {TemplateDefinition, TemplateContent} from './types';
import {
	W, H, TAU, lerp, prog, outCubic, outBack, outElastic, window01, withTransform, roundRectPath, starPath, glow, vGradient, staticLayer, drawText, fitSize, drawPhotoIn, confetti, drawDetails,
} from './kit';

const PINK = '#ff3d7a';
const YELLOW = '#ffd23f';
const ORANGE = '#ff8a3d';
const TURQ = '#1cc7c1';
const GREEN = '#1e9b4f';
const DGREEN = '#0f6b36';
const CREAM = '#fff4d6';
const WOOD = '#a56a32';
const paci = (s: number) => `${s}px Pacifico, cursive`;
const fred = (s: number) => `700 ${s}px Fredoka, system-ui, sans-serif`;

function frond(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, color: string) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(ang);
	ctx.fillStyle = color;
	const pt = (u: number) => ({x: len * u, y: len * 0.34 * u * u - len * 0.06 * Math.sin(u * Math.PI)});
	for (let i = 1; i <= 13; i++) {
		const u = i / 14;
		const p = pt(u);
		const q = pt(u + 0.02);
		const tang = Math.atan2(q.y - p.y, q.x - p.x);
		const ll = len * 0.3 * (1 - u * 0.55);
		for (const side of [-1, 1]) {
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(tang + side * 1.05);
			ctx.beginPath();
			ctx.ellipse(ll / 2, 0, ll / 2, 7, 0, 0, TAU);
			ctx.fill();
			ctx.restore();
		}
	}
	ctx.strokeStyle = DGREEN;
	ctx.lineWidth = 5;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	for (let i = 1; i <= 14; i++) {
		const p = pt(i / 14);
		ctx.lineTo(p.x, p.y);
	}
	ctx.stroke();
	ctx.restore();
}

function palm(ctx: CanvasRenderingContext2D, x: number, baseY: number, h: number, lean: number, t: number, flip = 1) {
	const topX = x + lean * flip;
	const topY = baseY - h;
	ctx.fillStyle = '#7a4a22';
	ctx.beginPath();
	ctx.moveTo(x - 20, baseY);
	ctx.quadraticCurveTo(x + lean * 0.1 * flip, baseY - h * 0.5, topX - 9, topY);
	ctx.lineTo(topX + 9, topY);
	ctx.quadraticCurveTo(x + lean * 0.1 * flip + 24, baseY - h * 0.5, x + 20, baseY);
	ctx.fill();
	ctx.strokeStyle = 'rgba(0,0,0,.2)';
	ctx.lineWidth = 3;
	for (let i = 1; i < 9; i++) {
		const u = i / 9;
		const cx = lerp(x, topX, u * u);
		ctx.beginPath();
		ctx.moveTo(cx - 14 * (1 - u * 0.5), baseY - h * u);
		ctx.lineTo(cx + 14 * (1 - u * 0.5), baseY - h * u + 4);
		ctx.stroke();
	}
	const sway = Math.sin(t * 1.6 + x) * 0.05;
	for (let i = 0; i < 8; i++) {
		const a = -Math.PI + 0.25 + (i / 7) * (Math.PI - 0.5) + sway;
		frond(ctx, topX, topY, a, 190, i % 2 ? GREEN : '#2cb860');
	}
	ctx.fillStyle = '#5b3412';
	ctx.beginPath();
	ctx.arc(topX - 8, topY + 10, 12, 0, TAU);
	ctx.arc(topX + 10, topY + 14, 12, 0, TAU);
	ctx.fill();
}

function hibiscus(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0, color = PINK) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(rot);
	ctx.scale(s, s);
	for (let i = 0; i < 5; i++) {
		ctx.save();
		ctx.rotate((i / 5) * TAU);
		const g = ctx.createRadialGradient(0, -30, 4, 0, -34, 48);
		g.addColorStop(0, '#a3123c');
		g.addColorStop(1, color);
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.ellipse(0, -36, 28, 42, 0, 0, TAU);
		ctx.fill();
		ctx.restore();
	}
	ctx.strokeStyle = YELLOW;
	ctx.lineWidth = 6;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.quadraticCurveTo(26, -30, 40, -62);
	ctx.stroke();
	ctx.fillStyle = ORANGE;
	for (let i = 0; i < 4; i++) {
		ctx.beginPath();
		ctx.arc(34 + i * 2, -52 - i * 6, 5, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

function pineapple(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
	const bounce = Math.abs(Math.sin(t * 5)) * 16;
	ctx.save();
	ctx.translate(x, y - bounce);
	ctx.rotate(Math.sin(t * 5) * 0.08);
	ctx.scale(s, s);
	for (let i = 0; i < 7; i++) {
		ctx.save();
		ctx.translate(0, -140);
		ctx.rotate(-1.1 + i * 0.37);
		ctx.fillStyle = i % 2 ? GREEN : '#2cb860';
		ctx.beginPath();
		ctx.moveTo(-12, 0);
		ctx.quadraticCurveTo(0, -130, 12, 0);
		ctx.fill();
		ctx.restore();
	}
	const g = ctx.createRadialGradient(-30, -40, 10, 0, 0, 130);
	g.addColorStop(0, '#ffe36b');
	g.addColorStop(1, '#f0a01e');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.ellipse(0, 0, 100, 140, 0, 0, TAU);
	ctx.fill();
	ctx.save();
	ctx.beginPath();
	ctx.ellipse(0, 0, 100, 140, 0, 0, TAU);
	ctx.clip();
	ctx.strokeStyle = 'rgba(160,90,10,.45)';
	ctx.lineWidth = 4;
	for (let i = -8; i <= 8; i++) {
		ctx.beginPath();
		ctx.moveTo(i * 28 - 140, -160);
		ctx.lineTo(i * 28 + 140, 160);
		ctx.moveTo(i * 28 + 140, -160);
		ctx.lineTo(i * 28 - 140, 160);
		ctx.stroke();
	}
	ctx.restore();
	// anteojos
	ctx.fillStyle = '#16161c';
	roundRectPath(ctx, -78, -52, 66, 48, 18);
	ctx.fill();
	roundRectPath(ctx, 12, -52, 66, 48, 18);
	ctx.fill();
	ctx.fillRect(-14, -44, 28, 8);
	ctx.fillStyle = 'rgba(255,255,255,.35)';
	ctx.fillRect(-66, -46, 18, 8);
	ctx.fillRect(24, -46, 18, 8);
	ctx.strokeStyle = '#7a3a10';
	ctx.lineWidth = 7;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.arc(0, 18, 38, 0.2, Math.PI - 0.2);
	ctx.stroke();
	ctx.fillStyle = '#ff7a8a';
	ctx.beginPath();
	ctx.arc(-62, 22, 12, 0, TAU);
	ctx.arc(62, 22, 12, 0, TAU);
	ctx.fill();
	ctx.restore();
}

function scenery(ctx: CanvasRenderingContext2D, t: number) {
	staticLayer(ctx, 'tropical-bg', (c) => {
		c.fillStyle = vGradient(c, 0, 880, [[0, '#ffb347'], [0.45, '#ff6f91'], [1, '#c64bb5']]);
		c.fillRect(0, 0, W, 880);
		c.fillStyle = vGradient(c, 860, H, [[0, '#18b7c9'], [1, '#0b7f9e']]);
		c.fillRect(0, 860, W, H - 860);
	});
	// sol que baila sobre el horizonte
	glow(ctx, W / 2, 800, 380, 'rgba(255,230,120,.7)');
	ctx.save();
	ctx.translate(W / 2, 810);
	ctx.rotate(t * 0.15);
	ctx.fillStyle = 'rgba(255,240,150,.35)';
	for (let i = 0; i < 16; i++) {
		ctx.rotate(TAU / 16);
		ctx.beginPath();
		ctx.moveTo(140, -14);
		ctx.lineTo(330, 0);
		ctx.lineTo(140, 14);
		ctx.fill();
	}
	ctx.restore();
	ctx.fillStyle = '#ffe36b';
	ctx.beginPath();
	ctx.arc(W / 2, 810, 120, Math.PI, TAU);
	ctx.fill();
	// mar con olas
	const waves = [[870, '#16b0c5', 18, 1.2], [930, '#12a0bb', 22, 1.7], [1000, '#0e8fae', 26, 2.2]] as const;
	waves.forEach(([y, col, amp, sp], k) => {
		ctx.fillStyle = col;
		ctx.beginPath();
		ctx.moveTo(0, H);
		for (let x = 0; x <= W; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.015 + t * sp + k) * amp);
		ctx.lineTo(W, H);
		ctx.fill();
		ctx.strokeStyle = 'rgba(255,255,255,.5)';
		ctx.lineWidth = 4;
		ctx.beginPath();
		for (let x = 0; x <= W; x += 12) {
			const yy = y + Math.sin(x * 0.015 + t * sp + k) * amp;
			if (x === 0) ctx.moveTo(x, yy);
			else ctx.lineTo(x, yy);
		}
		ctx.stroke();
	});
	// arena
	ctx.fillStyle = '#ffe2a8';
	ctx.beginPath();
	ctx.moveTo(0, H);
	for (let x = 0; x <= W; x += 12) ctx.lineTo(x, 1190 + Math.sin(x * 0.02 + t * 0.8) * 8);
	ctx.lineTo(W, H);
	ctx.fill();
	palm(ctx, 70, 1230, 640, 110, t);
	palm(ctx, 650, 1230, 560, -90, t, 1);
}

function bunting(ctx: CanvasRenderingContext2D, t: number, drop: number) {
	const colors = [PINK, YELLOW, TURQ, ORANGE, '#7be08a', '#a06bff'];
	ctx.save();
	ctx.translate(0, -140 * (1 - drop));
	const y = (x: number) => 70 + Math.sin((x / W) * Math.PI) * 60;
	ctx.strokeStyle = '#6b3a14';
	ctx.lineWidth = 4;
	ctx.beginPath();
	for (let x = -10; x <= W + 10; x += 10) ctx.lineTo(x, y(x));
	ctx.stroke();
	for (let i = 0; i < 11; i++) {
		const x = 30 + i * 66;
		const sw = Math.sin(t * 2.4 + i) * 0.12;
		ctx.save();
		ctx.translate(x, y(x));
		ctx.rotate(sw);
		ctx.fillStyle = colors[i % colors.length];
		ctx.beginPath();
		ctx.moveTo(-26, 0);
		ctx.lineTo(26, 0);
		ctx.lineTo(0, 78);
		ctx.fill();
		ctx.restore();
	}
	ctx.restore();
}

function woodPlate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, i: number) {
	ctx.save();
	ctx.shadowColor = 'rgba(0,0,0,.35)';
	ctx.shadowBlur = 14;
	ctx.shadowOffsetY = 8;
	const g = ctx.createLinearGradient(0, y, 0, y + h);
	g.addColorStop(0, '#c98a4b');
	g.addColorStop(1, WOOD);
	ctx.fillStyle = g;
	roundRectPath(ctx, x, y, w, h, 24);
	ctx.fill();
	ctx.restore();
	ctx.strokeStyle = '#5a3414';
	ctx.lineWidth = 6;
	roundRectPath(ctx, x, y, w, h, 24);
	ctx.stroke();
	ctx.strokeStyle = 'rgba(90,52,20,.3)';
	ctx.lineWidth = 3;
	for (let k = 1; k < 5; k++) {
		ctx.beginPath();
		ctx.moveTo(x + 14, y + (h / 5) * k);
		ctx.quadraticCurveTo(x + w / 2, y + (h / 5) * k + 8, x + w - 14, y + (h / 5) * k - 4);
		ctx.stroke();
	}
	hibiscus(ctx, i % 2 ? x + w - 8 : x + 8, y + 8, 0.42, i, i % 2 ? PINK : '#ff7a3d');
}

function draw(ctx: CanvasRenderingContext2D, {t, content: c}: {t: number; content: TemplateContent}) {
	scenery(ctx, t);
	const hasPhoto = !!c.photo;
	bunting(ctx, t, outBack(prog(t, 0, 0.9)));

	// ---------- A ----------
	const a = window01(t, -1, 3.3, 0.4);
	if (a > 0) {
		ctx.save();
		ctx.globalAlpha = a;
		['¡Fiesta', 'Tropical!'].forEach((line, li) => {
			const p = outBack(prog(t, 0.5 + li * 0.4, 0.6));
			const size = fitSize(ctx, line, paci, 600, 130);
			withTransform(ctx, {x: W / 2, y: 340 + li * 150 + Math.sin(t * 3 + li) * 6, scale: Math.max(0.01, p), rot: li ? 0.03 : -0.04}, () => {
				drawText(ctx, line, 0, 0, {font: paci, size, fill: li ? YELLOW : '#fff', stroke: li ? PINK : ORANGE, strokeW: size * 0.2, shadow: '#7a1f4a', shadowDy: size * 0.07});
			});
		});
		const pp = outElastic(prog(t, 1.2, 0.9));
		pineapple(ctx, W / 2, lerp(1500, 1010, pp) as number, 1.15, t);
		hibiscus(ctx, 150, 640, 1.0, -0.4);
		hibiscus(ctx, 590, 680, 0.9, 0.5, '#ff7a3d');
		ctx.restore();
	}

	// ---------- B ----------
	const b = window01(t, 3.2, 7.1, 0.4);
	if (b > 0) {
		ctx.save();
		ctx.globalAlpha = b;
		const pp = outBack(prog(t, 3.5, 0.7));
		withTransform(ctx, {x: W / 2, y: 410 + Math.sin(t * 2) * 10, scale: Math.max(0.01, pp), rot: Math.sin(t * 1.4) * 0.04}, () => {
			if (hasPhoto) {
				// salvavidas
				ctx.beginPath();
				ctx.arc(0, 0, 190, 0, TAU);
				ctx.fillStyle = '#fff';
				ctx.fill();
				for (let i = 0; i < 8; i++) {
					ctx.beginPath();
					ctx.arc(0, 0, 160, (i / 8) * TAU, ((i + 0.5) / 8) * TAU + 0.0);
					ctx.arc(0, 0, 130, ((i + 0.5) / 8) * TAU, (i / 8) * TAU, true);
					ctx.closePath();
					ctx.fillStyle = i % 2 ? '#fff' : '#e8344e';
					ctx.fill();
				}
				for (let i = 0; i < 8; i++) {
					ctx.beginPath();
					ctx.arc(0, 0, 190, ((i + 0.5) / 8) * TAU, ((i + 1) / 8) * TAU);
					ctx.arc(0, 0, 130, ((i + 1) / 8) * TAU, ((i + 0.5) / 8) * TAU, true);
					ctx.closePath();
					ctx.fillStyle = i % 2 ? '#e8344e' : '#fff';
					ctx.fill();
				}
				ctx.strokeStyle = 'rgba(0,0,0,.2)';
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.arc(0, 0, 190, 0, TAU);
				ctx.arc(0, 0, 130, 0, TAU);
				ctx.stroke();
				drawPhotoIn(ctx, c.photo, 'circle', 0, 0, 126);
			} else {
				starPath(ctx, 0, 0, 18, 200, 162);
				ctx.fillStyle = '#c2552a';
				ctx.save();
				ctx.translate(6, 8);
				ctx.fill();
				ctx.restore();
				ctx.fillStyle = YELLOW;
				ctx.fill();
				ctx.fillStyle = ORANGE;
				ctx.beginPath();
				ctx.arc(0, 0, 136, 0, TAU);
				ctx.fill();
				const age = String(c.age);
				drawText(ctx, age, 0, age.length > 2 ? 52 : 80, {font: paci, size: age.length > 2 ? 130 : 200, fill: '#fff', stroke: PINK, strokeW: 14, shadow: '#7a1f4a', shadowDy: 8});
			}
		});
		hibiscus(ctx, 120, 560, 0.9, -0.4);
		hibiscus(ctx, 610, 280, 0.7, 0.6, '#ff7a3d');
		// cartel con el nombre
		const np = outBack(prog(t, 4.2, 0.6));
		const ns = fitSize(ctx, c.name, paci, 500, 100, 40);
		withTransform(ctx, {x: W / 2, y: 770, scale: Math.max(0.01, np), rot: -0.03 + Math.sin(t * 1.8) * 0.012}, () => {
			ctx.strokeStyle = '#5a3414';
			ctx.lineWidth = 5;
			ctx.beginPath();
			ctx.moveTo(-210, -78);
			ctx.lineTo(-210, -150);
			ctx.moveTo(210, -78);
			ctx.lineTo(210, -150);
			ctx.stroke();
			woodPlate(ctx, -270, -80, 540, 160, 0);
			drawText(ctx, c.name, 0, ns * 0.3, {font: paci, size: ns, fill: CREAM, stroke: '#5a3414', strokeW: ns * 0.12});
		});
		// cinta con la edad
		withTransform(ctx, {x: W / 2, y: 960, scale: Math.max(0.01, outBack(prog(t, 4.8, 0.5)))}, () => {
			ctx.fillStyle = PINK;
			ctx.beginPath();
			ctx.moveTo(-280, -44);
			ctx.lineTo(280, -44);
			ctx.lineTo(250, 0);
			ctx.lineTo(280, 44);
			ctx.lineTo(-280, 44);
			ctx.lineTo(-250, 0);
			ctx.closePath();
			ctx.fill();
			drawText(ctx, `¡CUMPLE ${c.age} AÑOS!`, 0, 14, {font: fred, size: fitSize(ctx, `¡CUMPLE ${c.age} AÑOS!`, fred, 460, 46), fill: '#fff'});
		});
		pineapple(ctx, 600, 1120, 0.45, t);
		ctx.restore();
	}

	// ---------- transición: ola ----------
	const w1 = prog(t, 2.9, 0.5);
	const w2 = prog(t, 3.4, 0.5);
	const w3 = prog(t, 6.8, 0.5);
	const w4 = prog(t, 7.2, 0.5);
	const wave = (p1: number, p2: number, col: string) => {
		if (p1 <= 0 || p2 >= 1) return;
		const yTop = p1 >= 1 ? -80 : lerp(H + 80, -80, outCubic(p1));
		const yBot = lerp(H + 120, -120, outCubic(p2));
		ctx.fillStyle = col;
		ctx.beginPath();
		ctx.moveTo(0, yBot);
		for (let x = 0; x <= W; x += 12) ctx.lineTo(x, yTop + Math.sin(x * 0.02 + t * 6) * 22);
		ctx.lineTo(W, yBot);
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = 'rgba(255,255,255,.7)';
		ctx.beginPath();
		for (let x = 0; x <= W; x += 12) ctx.lineTo(x, yTop + Math.sin(x * 0.02 + t * 6) * 22 + 8);
		ctx.lineTo(W, yTop + 26);
		ctx.lineTo(0, yTop + 26);
		ctx.fill();
	};
	wave(w1, w2, TURQ);
	wave(w3, w4, PINK);

	// ---------- C ----------
	const cc = window01(t, 7.2, 99, 0.35);
	if (cc > 0) {
		ctx.save();
		ctx.globalAlpha = cc;
		withTransform(ctx, {x: W / 2, y: 250, scale: Math.max(0.01, outBack(prog(t, 7.3, 0.6))), rot: -0.03}, () => {
			drawText(ctx, '¡Te esperamos!', 0, 0, {font: paci, size: fitSize(ctx, '¡Te esperamos!', paci, 600, 100), fill: YELLOW, stroke: PINK, strokeW: 20, shadow: '#7a1f4a', shadowDy: 7});
		});
		withTransform(ctx, {x: W / 2, y: 335, alpha: prog(t, 7.7, 0.4)}, () => {
			drawText(ctx, `Cumple de ${c.name}`, 0, 0, {font: fred, size: fitSize(ctx, `Cumple de ${c.name}`, fred, 600, 48), fill: '#fff', stroke: '#7a1f4a', strokeW: 10});
		});
		drawDetails(ctx, c, t, 7.9, {
			labelFont: fred,
			valueFont: fred,
			labelColor: '#ffe9b0',
			valueColor: CREAM,
			subColor: '#ffe9b0',
			valueStroke: '#5a3414',
			entrance: 'pop',
			y: 380,
			plate: woodPlate,
		});
		ctx.restore();
	}
	confetti(ctx, t, {count: 30, colors: [PINK, YELLOW, '#fff', TURQ, ORANGE], seed: 31, speed: 0.9, shape: 'circle', size: 12});
}

export const tropical: TemplateDefinition = {
	id: 'tropical',
	name: 'Fiesta Tropical',
	description: 'Atardecer con palmeras, mar con olas, banderines, hibiscos y una piña con anteojos de sol.',
	category: 'Tropical',
	audience: 'infantil',
	palette: [PINK, YELLOW, TURQ, ORANGE, GREEN],
	fonts: ['Pacifico', 'Fredoka'],
	duration: 11,
	fps: 24,
	defaultAudioId: 'verano-tropical',
	photoRule: 'La foto va dentro de un salvavidas; sin foto, un sol gigante muestra la edad.',
	thumbnailTime: 5.6,
	draw,
};
