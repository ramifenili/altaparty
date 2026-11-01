// Plantilla "Azul y Oro": estadio de noche, camiseta con el nombre y la edad,
// pelotas, tribuna y entradas con los datos. Estética original basada en los
// colores azul y amarillo; no usa escudos, logos ni material oficial.

import type {TemplateDefinition, TemplateContent} from './types';
import {
	W, H, TAU, clamp01, lerp, prog, outCubic, outBack, outElastic, window01, hash, withTransform, roundRectPath, sparkle4, glow, vGradient, staticLayer, drawText, fitSize, drawPhotoIn, confetti, twinkles, drawDetails,
} from './kit';

const BLUE = '#0b3a9c';
const DEEP = '#061a4d';
const GOLD = '#ffc400';
const WHITE = '#ffffff';
const anton = (s: number) => `${s}px Anton, Impact, sans-serif`;

export function ball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
	ctx.save();
	ctx.translate(x, y);
	// sombra
	ctx.fillStyle = 'rgba(0,0,0,.28)';
	ctx.beginPath();
	ctx.ellipse(0, r * 1.05, r * 0.9, r * 0.22, 0, 0, TAU);
	ctx.fill();
	ctx.rotate(rot);
	const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
	g.addColorStop(0, '#ffffff');
	g.addColorStop(1, '#cfd6e6');
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(0, 0, r, 0, TAU);
	ctx.fill();
	ctx.save();
	ctx.clip();
	ctx.fillStyle = '#10151f';
	const pent = (cx: number, cy: number, rr: number, rot0: number) => {
		ctx.beginPath();
		for (let i = 0; i < 5; i++) {
			const a = rot0 + (i * TAU) / 5;
			const px = cx + Math.cos(a) * rr;
			const py = cy + Math.sin(a) * rr;
			if (i === 0) ctx.moveTo(px, py);
			else ctx.lineTo(px, py);
		}
		ctx.closePath();
		ctx.fill();
	};
	pent(0, 0, r * 0.34, -Math.PI / 2);
	for (let i = 0; i < 5; i++) {
		const a = -Math.PI / 2 + (i * TAU) / 5 + TAU / 10;
		pent(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, r * 0.34, a + Math.PI / 2 + Math.PI / 5);
		ctx.strokeStyle = 'rgba(16,21,31,.55)';
		ctx.lineWidth = r * 0.04;
		ctx.beginPath();
		ctx.moveTo(Math.cos(a - TAU / 10) * r * 0.32, Math.sin(a - TAU / 10) * r * 0.32);
		ctx.lineTo(Math.cos(a - TAU / 10) * r * 0.62, Math.sin(a - TAU / 10) * r * 0.62);
		ctx.stroke();
	}
	ctx.restore();
	ctx.strokeStyle = 'rgba(0,0,0,.35)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(0, 0, r, 0, TAU);
	ctx.stroke();
	ctx.restore();
}

function stadium(ctx: CanvasRenderingContext2D, t: number) {
	// cielo + estructura estática
	staticLayer(ctx, 'boca-bg', (c) => {
		c.fillStyle = vGradient(c, 0, H, [[0, '#030b26'], [0.45, '#0a2a75'], [1, '#04153f']]);
		c.fillRect(0, 0, W, H);
		// pasto en perspectiva
		const py = 905;
		c.fillStyle = vGradient(c, py, H, [[0, '#0a7a3e'], [1, '#064e29']]);
		c.fillRect(0, py, W, H - py);
		for (let i = -6; i < 14; i++) {
			c.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)';
			c.beginPath();
			c.moveTo(W / 2 + (i - 0.5) * 18, py);
			c.lineTo(W / 2 + (i - 0.5) * 140, H);
			c.lineTo(W / 2 + (i + 0.5) * 140, H);
			c.lineTo(W / 2 + (i + 0.5) * 18, py);
			c.fill();
		}
		c.strokeStyle = 'rgba(255,255,255,.55)';
		c.lineWidth = 5;
		c.beginPath();
		c.ellipse(W / 2, 1120, 240, 70, 0, 0, TAU);
		c.stroke();
		c.beginPath();
		c.moveTo(0, 1120);
		c.lineTo(W, 1120);
		c.stroke();
		// gradas
		c.fillStyle = '#071a52';
		c.beginPath();
		c.moveTo(0, 250);
		c.quadraticCurveTo(W / 2, 205, W, 250);
		c.lineTo(W, 905);
		c.lineTo(0, 905);
		c.fill();
		for (let r = 0; r < 9; r++) {
			c.fillStyle = r % 2 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.18)';
			c.fillRect(0, 300 + r * 38, W, 38);
		}
		// techo del estadio
		c.fillStyle = '#020a22';
		c.beginPath();
		c.moveTo(0, 0);
		c.lineTo(W, 0);
		c.lineTo(W, 235);
		c.quadraticCurveTo(W / 2, 175, 0, 235);
		c.fill();
	});

	// reflectores con parpadeo inicial
	const flick = t < 1.6 ? (Math.sin(t * 38) > 0.2 || t > 1.2 ? 1 : 0.15) * clamp01(t / 0.3) : 1;
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	const towers = [90, 250, 470, 630];
	towers.forEach((x, i) => {
		const sway = Math.sin(t * 0.8 + i) * 20;
		const g = ctx.createLinearGradient(x, 190, x + sway * 2, 900);
		g.addColorStop(0, `rgba(255,244,200,${0.38 * flick})`);
		g.addColorStop(1, 'rgba(255,244,200,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(x - 24, 190);
		ctx.lineTo(x + 24, 190);
		ctx.lineTo(x + sway * 2 + (i < 2 ? 190 : -190), 905);
		ctx.lineTo(x + sway * 2 + (i < 2 ? -70 : 70), 905);
		ctx.fill();
	});
	ctx.restore();
	towers.forEach((x) => {
		ctx.fillStyle = '#0a0f20';
		roundRectPath(ctx, x - 38, 150, 76, 54, 6);
		ctx.fill();
		for (let a = 0; a < 3; a++)
			for (let b = 0; b < 2; b++) {
				ctx.fillStyle = `rgba(255,248,215,${0.35 + 0.65 * flick})`;
				ctx.beginPath();
				ctx.arc(x - 22 + a * 22, 166 + b * 24, 8, 0, TAU);
				ctx.fill();
			}
		glow(ctx, x, 178, 90, 'rgba(255,240,190,.55)', flick);
	});

	// multitud: puntos con "ola"
	const colors = [BLUE, GOLD, WHITE, '#1550c8'];
	const batches: Path2D[] = colors.map(() => new Path2D());
	for (let r = 0; r < 9; r++) {
		const y0 = 318 + r * 38;
		for (let i = 0; i < 24; i++) {
			const x = i * 31 + (r % 2) * 15 + 12;
			const wave = Math.sin(t * 3.2 + i * 0.45 - r * 0.2) * 5 * (1 - r / 12);
			const jump = hash(i * 9 + r, 3) > 0.8 ? Math.abs(Math.sin(t * 5 + i)) * -6 : 0;
			const ci = r === 3 || r === 4 ? 1 : Math.floor(hash(i + r * 40, 4) * 4);
			batches[ci].moveTo(x + 11, y0 + wave + jump);
			batches[ci].arc(x, y0 + wave + jump, 11, 0, TAU);
		}
	}
	batches.forEach((p, i) => {
		ctx.fillStyle = colors[i];
		ctx.fill(p);
	});
	// flashes de cámaras
	for (let k = 0; k < 9; k++) {
		const ph = (t * 1.3 + hash(k, 21)) % 1;
		if (ph < 0.07) sparkle4(ctx, hash(k, 22) * W, 330 + hash(k, 23) * 300, 24 * (1 - ph / 0.07) + 6, '#fff');
	}

	// cartel LED corrido
	ctx.fillStyle = '#05123a';
	ctx.fillRect(0, 828, W, 62);
	ctx.fillStyle = GOLD;
	ctx.fillRect(0, 824, W, 5);
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 832, W, 54);
	ctx.clip();
	const msg = '¡FELIZ CUMPLE!  ★  ¡VAMOS A FESTEJAR!  ★  ';
	ctx.font = anton(38);
	const mw = ctx.measureText(msg).width;
	const off = (t * 120) % mw;
	for (let k = -1; k < 3; k++) {
		drawText(ctx, msg, k * mw - off, 874, {font: anton, size: 38, fill: GOLD, align: 'left'});
	}
	ctx.restore();
}

function jersey(ctx: CanvasRenderingContext2D, c: TemplateContent, scale: number, t: number, wob: number) {
	ctx.save();
	ctx.scale(scale, scale);
	ctx.rotate(Math.sin(t * 2.2) * 0.025 * wob);
	const path = new Path2D();
	path.moveTo(-70, -250);
	path.quadraticCurveTo(0, -195, 70, -250);
	path.lineTo(190, -225);
	path.lineTo(312, -150);
	path.lineTo(255, -15);
	path.lineTo(195, -70);
	path.lineTo(195, 250);
	path.quadraticCurveTo(0, 278, -195, 250);
	path.lineTo(-195, -70);
	path.lineTo(-255, -15);
	path.lineTo(-312, -150);
	path.lineTo(-190, -225);
	path.closePath();
	ctx.save();
	ctx.shadowColor = 'rgba(0,0,0,.45)';
	ctx.shadowBlur = 30;
	ctx.shadowOffsetY = 18;
	ctx.fillStyle = BLUE;
	ctx.fill(path);
	ctx.restore();
	ctx.save();
	ctx.clip(path);
	const g = ctx.createLinearGradient(-300, 0, 300, 0);
	g.addColorStop(0, 'rgba(0,0,0,.25)');
	g.addColorStop(0.5, 'rgba(255,255,255,.08)');
	g.addColorStop(1, 'rgba(0,0,0,.25)');
	ctx.fillStyle = g;
	ctx.fillRect(-320, -260, 640, 540);
	// banda amarilla
	ctx.fillStyle = GOLD;
	ctx.fillRect(-320, -45, 640, 150);
	ctx.fillStyle = 'rgba(255,255,255,.12)';
	for (let i = -300; i < 300; i += 24) ctx.fillRect(i, -260, 8, 540);
	ctx.restore();
	ctx.strokeStyle = WHITE;
	ctx.lineWidth = 9;
	ctx.beginPath();
	ctx.moveTo(-70, -250);
	ctx.quadraticCurveTo(0, -195, 70, -250);
	ctx.stroke();
	ctx.strokeStyle = GOLD;
	ctx.lineWidth = 12;
	ctx.beginPath();
	ctx.moveTo(312, -150);
	ctx.lineTo(255, -15);
	ctx.moveTo(-312, -150);
	ctx.lineTo(-255, -15);
	ctx.stroke();

	const name = c.name.toLocaleUpperCase('es');
	const ns = fitSize(ctx, name, anton, 330, 74, 28);
	drawText(ctx, name, 0, -96, {font: anton, size: ns, fill: GOLD, stroke: DEEP, strokeW: ns * 0.12});
	const age = String(c.age);
	drawText(ctx, age, 0, 92, {font: anton, size: age.length > 2 ? 150 : 190, fill: BLUE, stroke: WHITE, strokeW: 8});
	ctx.restore();
}

function ticket(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
	ctx.save();
	ctx.shadowColor = 'rgba(0,0,0,.45)';
	ctx.shadowBlur = 18;
	ctx.shadowOffsetY = 8;
	ctx.fillStyle = GOLD;
	ctx.beginPath();
	roundRectPath(ctx, x, y, w, h, 18);
	ctx.fill();
	ctx.restore();
	// muescas
	ctx.fillStyle = DEEP;
	for (const nx of [x, x + w]) {
		ctx.beginPath();
		ctx.arc(nx, y + h / 2, 17, 0, TAU);
		ctx.fill();
	}
	ctx.strokeStyle = BLUE;
	ctx.setLineDash([10, 8]);
	ctx.lineWidth = 3;
	ctx.strokeRect(x + 14, y + 12, w - 28, h - 24);
	ctx.setLineDash([]);
}

function draw(ctx: CanvasRenderingContext2D, {t, content: c}: {t: number; content: TemplateContent}) {
	stadium(ctx, t);
	const hasPhoto = !!c.photo;

	// ---------- ESCENA A: presentación ----------
	const a = window01(t, -1, 3.6, 0.4);
	if (a > 0) {
		ctx.save();
		ctx.globalAlpha = a;
		const pIn = prog(t, 0.5, 0.6);
		const shake = t > 1.1 && t < 1.6 ? Math.sin(t * 90) * (1.6 - t) * 14 : 0;
		const sc = lerp(3.2, 1, outCubic(pIn));
		withTransform(ctx, {x: W / 2 + shake, y: 520 + shake * 0.6, scale: sc, alpha: pIn * 3}, () => {
			drawText(ctx, '¡HOY SE JUEGA', 0, -20, {font: anton, size: 104, fill: GOLD, stroke: DEEP, strokeW: 16, shadow: '#000'});
			drawText(ctx, 'UN CUMPLEAÑOS!', 0, 96, {font: anton, size: 94, fill: WHITE, stroke: BLUE, strokeW: 16, shadow: '#000'});
		});
		const p2 = outBack(prog(t, 1.6, 0.5));
		withTransform(ctx, {x: W / 2, y: 690, scale: Math.max(p2, 0.001), alpha: p2}, () => {
			ctx.fillStyle = GOLD;
			ctx.fillRect(-250, -34, 500, 60);
			drawText(ctx, 'ESTÁS INVITADO A LA FIESTA', 0, 12, {font: anton, size: 34, fill: DEEP, spacing: 1});
		});
		// pelota que entra rebotando
		const bp = prog(t, 0.8, 2.2);
		const bx = lerp(W + 80, 360, outCubic(bp));
		const by = 1010 - Math.abs(Math.sin(bp * Math.PI * 3)) * 150 * (1 - bp * 0.7);
		ball(ctx, bx, by, 62, -bp * 14);
		ctx.restore();
	}

	// ---------- ESCENA B: camiseta ----------
	const b = window01(t, 3.2, 7.2, 0.4);
	if (b > 0) {
		ctx.save();
		ctx.globalAlpha = b;
		const jp = outElastic(prog(t, 3.3, 0.9));
		const jy = hasPhoto ? 880 : 700;
		const js = hasPhoto ? 0.76 : 1.02;
		withTransform(ctx, {x: W / 2, y: jy - (1 - jp) * 500, scale: Math.max(0.01, jp * js)}, () => {
			jersey(ctx, c, 1, t, 1);
		});
		if (hasPhoto) {
			const pp = outBack(prog(t, 3.7, 0.6));
			withTransform(ctx, {x: W / 2, y: 410, scale: Math.max(0.01, pp)}, () => {
				ctx.rotate(Math.sin(t * 1.6) * 0.03);
				glow(ctx, 0, 0, 260, 'rgba(255,196,0,.45)');
				ctx.fillStyle = GOLD;
				ctx.beginPath();
				ctx.arc(0, 0, 168, 0, TAU);
				ctx.fill();
				ctx.fillStyle = BLUE;
				ctx.beginPath();
				ctx.arc(0, 0, 156, 0, TAU);
				ctx.fill();
				drawPhotoIn(ctx, c.photo, 'circle', 0, 0, 146);
			});
			ball(ctx, 150, 560, 44, t * 3);
		} else {
			const tp = outBack(prog(t, 3.9, 0.5));
			withTransform(ctx, {x: W / 2, y: 330, scale: Math.max(0.01, tp), alpha: tp}, () => {
				drawText(ctx, '¡FELIZ CUMPLE!', 0, 0, {font: anton, size: 92, fill: GOLD, stroke: DEEP, strokeW: 14, shadow: '#000'});
			});
			ball(ctx, 130 + Math.sin(t * 2) * 8, 1010 - Math.abs(Math.sin(t * 4)) * 90, 56, t * 5);
			ball(ctx, 590 - Math.sin(t * 2) * 8, 1010 - Math.abs(Math.cos(t * 4)) * 90, 56, -t * 5);
		}
		const sp = outBack(prog(t, 4.4, 0.5));
		withTransform(ctx, {x: W / 2, y: hasPhoto ? 1130 : 1090, scale: Math.max(0.01, sp), alpha: sp}, () => {
			drawText(ctx, `CUMPLE ${c.age} AÑOS`, 0, 0, {font: anton, size: 64, fill: WHITE, stroke: DEEP, strokeW: 12, shadow: '#000'});
		});
		ctx.restore();
	}

	// ---------- transición: barrido amarillo ----------
	const wp = prog(t, 6.75, 0.7);
	if (wp > 0 && wp < 1) {
		const x = lerp(-300, W + 500, outCubic(wp));
		ctx.save();
		ctx.fillStyle = GOLD;
		ctx.beginPath();
		ctx.moveTo(x - 260, 0);
		ctx.lineTo(x + 40, 0);
		ctx.lineTo(x - 140, H);
		ctx.lineTo(x - 440, H);
		ctx.fill();
		ctx.fillStyle = WHITE;
		ctx.beginPath();
		ctx.moveTo(x + 40, 0);
		ctx.lineTo(x + 80, 0);
		ctx.lineTo(x - 100, H);
		ctx.lineTo(x - 140, H);
		ctx.fill();
		ctx.restore();
	}

	// ---------- ESCENA C: entradas ----------
	const cc = window01(t, 7.0, 99, 0.4);
	if (cc > 0) {
		ctx.save();
		ctx.globalAlpha = cc;
		const hp = outBack(prog(t, 7.1, 0.6));
		if (hasPhoto) {
			withTransform(ctx, {x: W / 2, y: 190, scale: Math.max(0.01, hp)}, () => {
				ctx.fillStyle = GOLD;
				ctx.beginPath();
				ctx.arc(0, 0, 112, 0, TAU);
				ctx.fill();
				drawPhotoIn(ctx, c.photo, 'circle', 0, 0, 104);
			});
		} else {
			withTransform(ctx, {x: W / 2, y: 200, scale: Math.max(0.01, hp)}, () => ball(ctx, 0, 0, 78, t * 2));
		}
		const name = c.name.toLocaleUpperCase('es');
		const ns = fitSize(ctx, name, anton, 640, 104, 40);
		withTransform(ctx, {x: W / 2, y: 392, scale: Math.max(0.01, hp), alpha: hp}, () => {
			drawText(ctx, name, 0, 0, {font: anton, size: ns, fill: GOLD, stroke: DEEP, strokeW: ns * 0.14, shadow: '#000'});
		});
		drawText(ctx, `CUMPLE ${c.age} AÑOS · ENTRADA DE HONOR`, W / 2, 462, {
			font: anton, size: 32, fill: WHITE, stroke: DEEP, strokeW: 7, spacing: 0.5,
			align: 'center',
		});
		drawDetails(ctx, c, t, 7.6, {
			labelFont: anton,
			valueFont: anton,
			labelColor: BLUE,
			valueColor: DEEP,
			subColor: BLUE,
			plate: (g, x, y, w, h) => ticket(g, x, y, w, h),
			entrance: 'slide',
			y: 520,
			uppercase: true,
		});
		ctx.restore();
	}

	// confeti y brillos, siempre al frente
	confetti(ctx, t, {count: 46, colors: [GOLD, BLUE, WHITE, '#1f6bff'], seed: 5, speed: 1.1});
	confetti(ctx, t, {count: 14, colors: [GOLD, WHITE], seed: 90, speed: 0.7, shape: 'strip', size: 24});
	if (t > 0.9) twinkles(ctx, t, 8, [GOLD, WHITE], {seed: 300, y0: 80, y1: 800, maxR: 22});
	// bengala inicial
	if (t < 1.2) {
		ctx.save();
		ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - t / 1.2)})`;
		ctx.fillRect(0, 0, W, H);
		ctx.restore();
	}
}

export const boca: TemplateDefinition = {
	id: 'boca',
	name: 'Azul y Oro',
	description: 'Para el hincha: estadio de noche, camiseta con nombre y edad, pelotas y entradas. Diseño original en azul y amarillo.',
	category: 'Fútbol',
	audience: 'juvenil',
	palette: [BLUE, GOLD, WHITE, DEEP],
	fonts: ['Anton', 'Fredoka'],
	duration: 11,
	fps: 24,
	defaultAudioId: 'cancha-en-fiesta',
	photoRule: 'La foto va en un círculo dorado sobre la camiseta; sin foto, la camiseta crece y hay dos pelotas.',
	thumbnailTime: 4.9,
	draw,
};
