// Plantilla "Rugido Jurásico": paisaje prehistórico con volcán, un dinosaurio
// con gorro de fiesta, un huevo que se rompe y carteles de madera y piedra.

import type {TemplateDefinition, TemplateContent} from './types';
import {
	W, H, TAU, clamp01, lerp, prog, outCubic, outBack, outElastic, window01, hash, withTransform, roundRectPath, starPath, glow, vGradient, staticLayer, drawText, fitSize, drawPhotoIn, confetti, drawDetails,
} from './kit';

const GREEN = '#4cc552';
const DGREEN = '#1f7a3a';
const ORANGE = '#ff8a3d';
const YELLOW = '#ffd23f';
const BROWN = '#7a4a22';
const CREAM = '#fff4d6';
const fred = (s: number) => `700 ${s}px Fredoka, system-ui, sans-serif`;

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, color: string) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(ang);
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.quadraticCurveTo(len * 0.5, -len * 0.28, len, 0);
	ctx.quadraticCurveTo(len * 0.5, len * 0.28, 0, 0);
	ctx.fill();
	ctx.strokeStyle = 'rgba(0,0,0,.18)';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(len * 0.95, 0);
	ctx.stroke();
	ctx.restore();
}

function landscape(ctx: CanvasRenderingContext2D, t: number) {
	staticLayer(ctx, 'dinos-bg', (c) => {
		c.fillStyle = vGradient(c, 0, H, [[0, '#6fd8ff'], [0.5, '#c9f3ff'], [0.72, '#fff3b0'], [1, '#ffe08a']]);
		c.fillRect(0, 0, W, H);
		// volcán
		c.fillStyle = '#6b4a3a';
		c.beginPath();
		c.moveTo(60, 900);
		c.lineTo(250, 470);
		c.lineTo(310, 470);
		c.lineTo(520, 900);
		c.fill();
		c.fillStyle = '#8a604b';
		c.beginPath();
		c.moveTo(250, 470);
		c.lineTo(310, 470);
		c.lineTo(400, 700);
		c.lineTo(330, 900);
		c.lineTo(270, 600);
		c.fill();
		c.fillStyle = '#ff5a2e';
		c.beginPath();
		c.ellipse(280, 472, 36, 10, 0, 0, TAU);
		c.fill();
		c.strokeStyle = '#ff5a2e';
		c.lineWidth = 9;
		c.lineCap = 'round';
		c.beginPath();
		c.moveTo(262, 478);
		c.quadraticCurveTo(240, 600, 210, 700);
		c.moveTo(300, 480);
		c.quadraticCurveTo(320, 560, 360, 640);
		c.stroke();
		// colinas
		c.fillStyle = '#8fdc6d';
		c.beginPath();
		c.moveTo(0, 940);
		c.quadraticCurveTo(200, 820, 420, 930);
		c.quadraticCurveTo(580, 860, W, 920);
		c.lineTo(W, H);
		c.lineTo(0, H);
		c.fill();
		c.fillStyle = '#4cc552';
		c.beginPath();
		c.moveTo(0, 1030);
		c.quadraticCurveTo(260, 960, 480, 1040);
		c.quadraticCurveTo(620, 1000, W, 1030);
		c.lineTo(W, H);
		c.lineTo(0, H);
		c.fill();
		c.fillStyle = '#2f9a45';
		c.fillRect(0, 1130, W, 150);
		// helechos en los bordes
		for (let i = 0; i < 7; i++) {
			leaf(c, 0, 1150, -0.3 - i * 0.22, 190 - i * 8, i % 2 ? '#2f9a45' : '#1f7a3a');
			leaf(c, W, 1150, Math.PI + 0.3 + i * 0.22, 190 - i * 8, i % 2 ? '#2f9a45' : '#1f7a3a');
		}
		// hierba
		c.strokeStyle = '#1f7a3a';
		c.lineWidth = 5;
		for (let x = 8; x < W; x += 24) {
			c.beginPath();
			c.moveTo(x, H);
			c.quadraticCurveTo(x + 4, H - 40, x + 12 * (hash(x, 2) - 0.5) * 2, H - 60 - hash(x, 3) * 30);
			c.stroke();
		}
	});

	// sol con rayos
	ctx.save();
	ctx.translate(590, 150);
	ctx.rotate(t * 0.2);
	ctx.fillStyle = 'rgba(255,214,64,.55)';
	for (let i = 0; i < 12; i++) {
		ctx.rotate(TAU / 12);
		ctx.beginPath();
		ctx.moveTo(70, -12);
		ctx.lineTo(130, 0);
		ctx.lineTo(70, 12);
		ctx.fill();
	}
	ctx.restore();
	ctx.fillStyle = YELLOW;
	ctx.beginPath();
	ctx.arc(590, 150, 62, 0, TAU);
	ctx.fill();
	// humo del volcán
	for (let i = 0; i < 6; i++) {
		const p = ((t * 0.25 + i / 6) % 1);
		ctx.fillStyle = `rgba(120,100,100,${0.5 * (1 - p)})`;
		ctx.beginPath();
		ctx.arc(280 + Math.sin(p * 6 + i) * 24 + p * 60, 450 - p * 260, 22 + p * 46, 0, TAU);
		ctx.fill();
	}
	// nubes
	for (let i = 0; i < 3; i++) {
		const x = ((t * (10 + i * 5) + i * 300) % (W + 300)) - 150;
		const y = 120 + i * 70;
		ctx.fillStyle = 'rgba(255,255,255,.9)';
		ctx.beginPath();
		ctx.ellipse(x, y, 70, 24, 0, 0, TAU);
		ctx.ellipse(x - 40, y + 6, 40, 20, 0, 0, TAU);
		ctx.ellipse(x + 44, y + 8, 44, 18, 0, 0, TAU);
		ctx.fill();
	}
	// pterodáctilo
	const px = ((t * 90) % (W + 400)) - 200;
	const py = 250 + Math.sin(t * 1.4) * 40;
	ctx.save();
	ctx.translate(px, py);
	const flap = Math.sin(t * 8) * 26;
	ctx.fillStyle = '#7b4bd8';
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.quadraticCurveTo(-50, -40 - flap, -110, -10 - flap);
	ctx.quadraticCurveTo(-60, 0, -30, 14);
	ctx.quadraticCurveTo(0, 30, 30, 14);
	ctx.quadraticCurveTo(60, 0, 110, -10 - flap);
	ctx.quadraticCurveTo(50, -40 - flap, 0, 0);
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(0, 6, 22, 12, 0, 0, TAU);
	ctx.moveTo(18, 4);
	ctx.lineTo(58, 12);
	ctx.lineTo(18, 14);
	ctx.fill();
	ctx.restore();
}

function trex(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, flip = false) {
	const bob = Math.abs(Math.sin(t * 5)) * 8;
	const wag = Math.sin(t * 4) * 0.08;
	const mouth = Math.max(0, Math.sin(t * 3)) * 18;
	ctx.save();
	ctx.translate(x, y - bob);
	ctx.scale(flip ? -s : s, s);
	ctx.lineJoin = 'round';
	// cola
	ctx.save();
	ctx.translate(-80, -150);
	ctx.rotate(wag);
	ctx.fillStyle = GREEN;
	ctx.beginPath();
	ctx.moveTo(10, -50);
	ctx.bezierCurveTo(-90, -60, -170, -20, -250, -60);
	ctx.bezierCurveTo(-170, 20, -90, 60, 10, 50);
	ctx.fill();
	ctx.restore();
	// patas
	ctx.fillStyle = '#3aa845';
	for (const lx of [-45, 30]) {
		roundRectPath(ctx, lx, -120, 52, 110, 22);
		ctx.fill();
		ctx.beginPath();
		ctx.ellipse(lx + 30, -4, 44, 16, 0, 0, TAU);
		ctx.fill();
		ctx.fillStyle = CREAM;
		for (let i = 0; i < 3; i++) {
			ctx.beginPath();
			ctx.arc(lx + 50 + i * 10, -4, 4, 0, TAU);
			ctx.fill();
		}
		ctx.fillStyle = '#3aa845';
	}
	// cuerpo
	ctx.fillStyle = GREEN;
	ctx.beginPath();
	ctx.ellipse(0, -170, 105, 88, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#c9f2a8';
	ctx.beginPath();
	ctx.ellipse(22, -150, 76, 56, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#2f9a45';
	[[-50, -200, 14], [-20, -225, 11], [-70, -160, 10], [0, -130, 9]].forEach(([sx, sy, r]) => {
		ctx.beginPath();
		ctx.arc(sx, sy, r, 0, TAU);
		ctx.fill();
	});
	// púas
	ctx.fillStyle = ORANGE;
	for (let i = 0; i < 5; i++) {
		const px = -80 + i * 38;
		const py = -245 + Math.abs(i - 2) * 9;
		ctx.beginPath();
		ctx.moveTo(px - 16, py);
		ctx.lineTo(px, py - 38);
		ctx.lineTo(px + 16, py);
		ctx.fill();
	}
	// bracito
	ctx.strokeStyle = '#3aa845';
	ctx.lineWidth = 16;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(75, -150);
	ctx.lineTo(108, -128 + Math.sin(t * 6) * 6);
	ctx.stroke();
	// cabeza
	ctx.fillStyle = GREEN;
	ctx.beginPath();
	ctx.ellipse(110, -262, 88, 64, -0.05, 0, TAU);
	ctx.fill();
	// mandíbula inferior
	ctx.save();
	ctx.translate(70, -228);
	ctx.rotate(mouth / 120);
	ctx.fillStyle = '#7a2b2b';
	ctx.beginPath();
	ctx.ellipse(50, 8, 74, 22, 0, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#3aa845';
	ctx.beginPath();
	ctx.ellipse(50, 14, 76, 18, 0, 0, TAU);
	ctx.fill();
	ctx.restore();
	ctx.fillStyle = '#fff';
	for (let i = 0; i < 5; i++) {
		ctx.beginPath();
		ctx.moveTo(110 + i * 17, -232);
		ctx.lineTo(118 + i * 17, -218 - mouth * 0.1);
		ctx.lineTo(126 + i * 17, -232);
		ctx.fill();
	}
	// ojo
	ctx.fillStyle = '#fff';
	ctx.beginPath();
	ctx.arc(138, -284, 19, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#222';
	ctx.beginPath();
	ctx.arc(144, -284, 9, 0, TAU);
	ctx.fill();
	ctx.fillStyle = '#ff9db0';
	ctx.beginPath();
	ctx.arc(108, -250, 12, 0, TAU);
	ctx.fill();
	ctx.fillStyle = DGREEN;
	ctx.beginPath();
	ctx.arc(188, -270, 5, 0, TAU);
	ctx.fill();
	// gorro de fiesta
	ctx.save();
	ctx.translate(90, -318);
	ctx.rotate(-0.25);
	ctx.fillStyle = '#ff4f9a';
	ctx.beginPath();
	ctx.moveTo(-30, 0);
	ctx.lineTo(0, -88);
	ctx.lineTo(30, 0);
	ctx.fill();
	ctx.fillStyle = YELLOW;
	for (let i = 0; i < 3; i++) {
		ctx.beginPath();
		ctx.moveTo(-24 + i * 4 + 6, -18 - i * 24);
		ctx.lineTo(24 - i * 4 - 6, -18 - i * 24);
		ctx.lineTo(22 - i * 6 - 6, -26 - i * 24);
		ctx.lineTo(-22 + i * 6 + 6, -26 - i * 24);
		ctx.fill();
	}
	ctx.fillStyle = '#6fd8ff';
	ctx.beginPath();
	ctx.arc(0, -92, 12, 0, TAU);
	ctx.fill();
	ctx.restore();
	ctx.restore();
}

function egg(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, crack: number, t: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(s, s);
	const wob = crack < 0.05 ? Math.sin(t * 14) * 0.05 * Math.min(1, t) : 0;
	ctx.rotate(wob);
	const shell = (top: boolean) => {
		ctx.save();
		ctx.beginPath();
		ctx.ellipse(0, 0, 105, 135, 0, 0, TAU);
		ctx.clip();
		ctx.fillStyle = '#fff7e0';
		ctx.fillRect(-120, -150, 240, 300);
		ctx.fillStyle = '#9b6bff';
		[[-45, -70, 22], [40, -30, 17], [-20, 40, 26], [55, 70, 15], [-60, 90, 14], [10, -105, 12]].forEach(([sx, sy, r]) => {
			ctx.beginPath();
			ctx.arc(sx, sy, r, 0, TAU);
			ctx.fill();
		});
		ctx.restore();
		ctx.strokeStyle = '#d9b36a';
		ctx.lineWidth = 6;
		ctx.beginPath();
		ctx.ellipse(0, 0, 105, 135, 0, 0, TAU);
		ctx.stroke();
		void top;
	};
	const zig = (c2: CanvasRenderingContext2D) => {
		c2.moveTo(-130, 0);
		for (let i = 0; i < 8; i++) c2.lineTo(-130 + i * 37 + 18, i % 2 ? 10 : -22);
		c2.lineTo(130, 0);
	};
	// mitad inferior
	ctx.save();
	ctx.beginPath();
	zig(ctx);
	ctx.lineTo(130, 200);
	ctx.lineTo(-130, 200);
	ctx.closePath();
	ctx.clip();
	shell(false);
	ctx.restore();
	// mitad superior
	ctx.save();
	const lift = outCubic(crack);
	ctx.translate(-lift * 30, -lift * 190);
	ctx.rotate(-lift * 0.7);
	ctx.beginPath();
	zig(ctx);
	ctx.lineTo(130, -200);
	ctx.lineTo(-130, -200);
	ctx.closePath();
	ctx.clip();
	shell(true);
	ctx.restore();
	ctx.restore();
}

function footprint(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, alpha: number) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(rot);
	ctx.globalAlpha *= alpha;
	ctx.fillStyle = 'rgba(122,74,34,.7)';
	ctx.beginPath();
	ctx.ellipse(0, 6, 15, 18, 0, 0, TAU);
	ctx.fill();
	for (const a of [-0.7, 0, 0.7]) {
		ctx.beginPath();
		ctx.ellipse(Math.sin(a) * 22, -20 - Math.cos(a) * 8, 6, 10, a, 0, TAU);
		ctx.fill();
	}
	ctx.restore();
}

function wreath(ctx: CanvasRenderingContext2D, r: number, t: number) {
	for (let i = 0; i < 18; i++) {
		const a = (i / 18) * TAU + Math.sin(t * 1.2) * 0.03;
		leaf(ctx, Math.cos(a) * r, Math.sin(a) * r, a + Math.PI / 2 + 0.5, 60, i % 2 ? '#2f9a45' : '#4cc552');
	}
	ctx.fillStyle = '#ff4f9a';
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * TAU + 0.3;
		ctx.beginPath();
		ctx.arc(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8), 11, 0, TAU);
		ctx.fill();
	}
}

function stoneTablet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, i: number) {
	ctx.save();
	ctx.shadowColor = 'rgba(0,0,0,.3)';
	ctx.shadowBlur = 14;
	ctx.shadowOffsetY = 8;
	const g = ctx.createLinearGradient(x, y, x, y + h);
	g.addColorStop(0, '#e8d9b5');
	g.addColorStop(1, '#cdb68a');
	ctx.fillStyle = g;
	roundRectPath(ctx, x, y, w, h, 34);
	ctx.fill();
	ctx.restore();
	ctx.strokeStyle = BROWN;
	ctx.lineWidth = 5;
	roundRectPath(ctx, x + 8, y + 8, w - 16, h - 16, 28);
	ctx.stroke();
	ctx.strokeStyle = 'rgba(122,74,34,.35)';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(x + w - 70, y + 10);
	ctx.lineTo(x + w - 90, y + 40);
	ctx.lineTo(x + w - 76, y + 62);
	ctx.stroke();
	leaf(ctx, x + 14, y + h - 10, -1.1, 70, i % 2 ? '#2f9a45' : '#4cc552');
	leaf(ctx, x + w - 14, y + h - 10, Math.PI + 1.1, 70, i % 2 ? '#4cc552' : '#2f9a45');
}

function draw(ctx: CanvasRenderingContext2D, {t, content: c}: {t: number; content: TemplateContent}) {
	landscape(ctx, t);
	const hasPhoto = !!c.photo;

	// ---------- A ----------
	const a = window01(t, -1, 3.5, 0.4);
	if (a > 0) {
		ctx.save();
		ctx.globalAlpha = a;
		const walk = outCubic(prog(t, 0.1, 1.8));
		trex(ctx, lerp(-260, 270, walk), 1150, 1.15, t * (walk < 1 ? 1.4 : 0.8));
		['¡RUGIDO', 'DE CUMPLE!'].forEach((line, li) => {
			const size = fitSize(ctx, line, fred, 620, li ? 112 : 128);
			ctx.font = fred(size);
			const w = ctx.measureText(line).width;
			let x = W / 2 - w / 2;
			for (let i = 0; i < line.length; i++) {
				const chW = ctx.measureText(line[i]).width;
				const p = outBack(prog(t, 0.5 + li * 0.5 + i * 0.05, 0.5));
				const bounce = Math.sin(t * 5 + i * 0.6) * 6;
				withTransform(ctx, {x: x + chW / 2, y: 360 + li * 130 + bounce, scale: Math.max(0.01, p), alpha: p * 2}, () => {
					drawText(ctx, line[i], 0, 0, {font: fred, size, fill: li ? YELLOW : ORANGE, stroke: DGREEN, strokeW: size * 0.16, shadow: '#000', shadowDy: size * 0.06});
				});
				x += chW;
			}
		});
		const sp = outBack(prog(t, 1.9, 0.5));
		withTransform(ctx, {x: W / 2, y: 650, scale: Math.max(0.01, sp), rot: -0.02}, () => {
			ctx.fillStyle = BROWN;
			roundRectPath(ctx, -270, -40, 540, 80, 22);
			ctx.fill();
			drawText(ctx, '¡TE INVITO A LA FIESTA!', 0, 14, {font: fred, size: 38, fill: CREAM});
		});
		ctx.restore();
	}

	// ---------- B ----------
	const b = window01(t, 3.2, 7.1, 0.4);
	if (b > 0) {
		ctx.save();
		ctx.globalAlpha = b;
		const pp = outBack(prog(t, 3.3, 0.6));
		if (hasPhoto) {
			withTransform(ctx, {x: W / 2, y: 330, scale: Math.max(0.01, pp), rot: Math.sin(t * 2) * 0.03}, () => {
				ctx.fillStyle = '#fff';
				ctx.beginPath();
				ctx.arc(0, 0, 160, 0, TAU);
				ctx.fill();
				drawPhotoIn(ctx, c.photo, 'circle', 0, 0, 148);
				wreath(ctx, 172, t);
			});
		} else {
			withTransform(ctx, {x: W / 2, y: 330, scale: Math.max(0.01, pp)}, () => {
				drawText(ctx, '¡HOY SE', 0, -20, {font: fred, size: 110, fill: ORANGE, stroke: DGREEN, strokeW: 18, shadow: '#000'});
				drawText(ctx, 'FESTEJA!', 0, 100, {font: fred, size: 128, fill: YELLOW, stroke: DGREEN, strokeW: 20, shadow: '#000'});
			});
		}
		// cartel de madera con el nombre
		const sp = outBack(prog(t, 3.8, 0.6));
		const name = c.name;
		const ns = fitSize(ctx, name, fred, 520, 100, 40);
		withTransform(ctx, {x: W / 2, y: 650, scale: Math.max(0.01, sp), rot: -0.03 + Math.sin(t * 2) * 0.01}, () => {
			ctx.fillStyle = BROWN;
			ctx.fillRect(-190, 20, 26, 150);
			ctx.fillRect(164, 20, 26, 150);
			const g = ctx.createLinearGradient(0, -80, 0, 80);
			g.addColorStop(0, '#c98a4b');
			g.addColorStop(1, '#a56a32');
			ctx.fillStyle = g;
			roundRectPath(ctx, -300, -80, 600, 160, 26);
			ctx.fill();
			ctx.strokeStyle = BROWN;
			ctx.lineWidth = 8;
			ctx.stroke();
			ctx.strokeStyle = 'rgba(90,50,20,.35)';
			ctx.lineWidth = 3;
			for (let i = -3; i <= 3; i++) {
				ctx.beginPath();
				ctx.moveTo(-280, i * 20);
				ctx.quadraticCurveTo(0, i * 20 + 8, 280, i * 20 - 4);
				ctx.stroke();
			}
			drawText(ctx, name, 0, ns * 0.34, {font: fred, size: ns, fill: CREAM, stroke: '#4a2a10', strokeW: ns * 0.12});
			leaf(ctx, -296, -60, -2.2, 90, '#4cc552');
			leaf(ctx, 296, -60, -0.9, 90, '#2f9a45');
		});
		// huevo que se rompe y revela la edad
		const crack = prog(t, 4.6, 0.7);
		const eggIn = outBack(prog(t, 4.0, 0.6));
		egg(ctx, 230, 1000, Math.max(0.01, eggIn) * 0.95, crack, t - 4);
		if (crack > 0.3) {
			const ap = outElastic(prog(t, 5.0, 0.7));
			withTransform(ctx, {x: 230, y: 960, scale: Math.max(0.01, ap)}, () => {
				glow(ctx, 0, 0, 170, 'rgba(255,230,120,.9)');
				starPath(ctx, 0, 0, 12, 112, 88);
				ctx.fillStyle = YELLOW;
				ctx.fill();
				ctx.lineWidth = 6;
				ctx.strokeStyle = ORANGE;
				ctx.stroke();
				const age = String(c.age);
				drawText(ctx, age, 0, 36, {font: fred, size: age.length > 2 ? 90 : 130, fill: '#fff', stroke: ORANGE, strokeW: 14});
			});
		}
		withTransform(ctx, {x: 515, y: 900, scale: Math.max(0.01, outBack(prog(t, 5.2, 0.5))), rot: 0.05}, () => {
			drawText(ctx, '¡CUMPLE', 0, 0, {font: fred, size: 52, fill: '#fff', stroke: DGREEN, strokeW: 10});
			drawText(ctx, `${c.age} AÑOS!`, 0, 60, {font: fred, size: 52, fill: YELLOW, stroke: DGREEN, strokeW: 10});
		});
		ctx.restore();
	}

	// ---------- transición: hoja gigante ----------
	const wp = prog(t, 6.8, 0.65);
	if (wp > 0 && wp < 1) {
		const x = lerp(-W, W * 2, outCubic(wp));
		ctx.save();
		ctx.fillStyle = '#2f9a45';
		ctx.beginPath();
		ctx.moveTo(x, -20);
		ctx.lineTo(x - 360, -20);
		for (let i = 0; i < 9; i++) ctx.lineTo(x - 360 - (i % 2 ? 0 : 60), (i + 1) * (H / 8));
		ctx.lineTo(x, H + 20);
		ctx.fill();
		ctx.fillStyle = '#4cc552';
		ctx.fillRect(x - 6, 0, 10, H);
		ctx.restore();
	}

	// ---------- C ----------
	const cc = window01(t, 7.1, 99, 0.35);
	if (cc > 0) {
		ctx.save();
		ctx.globalAlpha = cc;
		const hp = outBack(prog(t, 7.2, 0.5));
		withTransform(ctx, {x: W / 2, y: 190, scale: Math.max(0.01, hp)}, () => {
			drawText(ctx, '¡TE ESPERAMOS!', 0, 0, {font: fred, size: fitSize(ctx, '¡TE ESPERAMOS!', fred, 620, 96), fill: ORANGE, stroke: DGREEN, strokeW: 16, shadow: '#000'});
		});
		withTransform(ctx, {x: W / 2, y: 275, alpha: prog(t, 7.5, 0.4)}, () => {
			drawText(ctx, `Cumple de ${c.name}`, 0, 0, {font: fred, size: fitSize(ctx, `Cumple de ${c.name}`, fred, 600, 54), fill: '#fff', stroke: DGREEN, strokeW: 10});
		});
		drawDetails(ctx, c, t, 7.7, {
			labelFont: fred,
			valueFont: fred,
			labelColor: '#2f7a3a',
			valueColor: '#4a2a10',
			subColor: '#7a4a22',
			entrance: 'pop',
			y: 330,
			plate: stoneTablet,
		});
		for (let i = 0; i < 6; i++) footprint(ctx, 80 + i * 112, 1245 - (i % 2) * 22, 0.2 * (i % 2 ? 1 : -1) + 1.57 * 0, prog(t, 9 + i * 0.25, 0.3));
		ctx.restore();
	}

	// dino pequeño en B/C
	const tr = clamp01((t - 3.0) / 0.5);
	if (tr > 0 && t > 3.2) trex(ctx, 600, 1260, 0.5, t, true);
	confetti(ctx, t, {count: 30, colors: [ORANGE, YELLOW, '#ff4f9a', '#6fd8ff', '#9b6bff'], seed: 11, speed: 0.9, shape: 'circle'});
}

export const dinos: TemplateDefinition = {
	id: 'dinos',
	name: 'Rugido Jurásico',
	description: 'Dinosaurio con gorro de fiesta, volcán, huevo que se rompe y carteles de madera. Ideal para peques.',
	category: 'Dinosaurios',
	audience: 'infantil',
	palette: [GREEN, ORANGE, YELLOW, BROWN],
	fonts: ['Fredoka'],
	duration: 11,
	fps: 24,
	defaultAudioId: 'paso-jurasico',
	photoRule: 'La foto va en un marco redondo con hojas; sin foto, un cartel grande de "¡Hoy se festeja!" ocupa ese lugar.',
	thumbnailTime: 5.6,
	draw,
};
