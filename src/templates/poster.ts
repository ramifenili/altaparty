// Diseño genérico de la imagen 1080×1920 para las plantillas que no tienen uno propio (`poster`): usa la paleta y la
// tipografía de la plantilla, el nombre y la edad bien grandes (o la foto) y todos los datos de la fiesta a la vez.
// Se dibuja en el lienzo de 720×1280; el exportador lo escala.

import type {TemplateContent, TemplateDefinition} from './types';
import {tplImage} from './assets';
import {W, H, TAU, glow, vGradient, drawText, fitSize, drawPhotoIn, starPath, roundRectPath, hash, uniformRows, dateLine, dateParts} from './kit';

/** Mezcla un color #rrggbb con negro (k < 0) o blanco (k > 0). */
function shade(hex: string, k: number) {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return hex;
	const n = parseInt(m[1], 16);
	const f = (v: number) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
	return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const luma = (hex: string) => {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return 0.5;
	const n = parseInt(m[1], 16);
	return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

export function drawGenericPoster(ctx: CanvasRenderingContext2D, template: Pick<TemplateDefinition, 'id' | 'palette' | 'fonts' | 'posterArt'>, c: TemplateContent) {
	const pal = template.palette.filter((x) => /^#[0-9a-f]{6}$/i.test(x));
	const main = pal[0] ?? '#3b2a8c';
	const accent = [...pal.slice(1), '#ffd23f'].find((x) => luma(x) > 0.35 && x !== main) ?? '#ffd23f';
	const family = template.fonts[0] ?? 'Anton';
	const font = (s: number) => `${s}px ${family}, Anton, Impact, sans-serif`;
	const dark = shade(main, -0.55);
	const mid = shade(main, -0.25);

	// fondo: degradé de la paleta, resplandor, rayas suaves y confeti
	ctx.fillStyle = vGradient(ctx, 0, H, [
		[0, mid],
		[0.55, shade(main, -0.45)],
		[1, dark],
	]);
	ctx.fillRect(0, 0, W, H);
	glow(ctx, W / 2, 470, 560, accent, 0.28);
	ctx.save();
	ctx.globalAlpha = 0.07;
	ctx.fillStyle = '#fff';
	for (let i = -6; i < 14; i++) {
		ctx.beginPath();
		ctx.moveTo(i * 90, 0);
		ctx.lineTo(i * 90 + 45, 0);
		ctx.lineTo(i * 90 + 45 + 500, H);
		ctx.lineTo(i * 90 + 500, H);
		ctx.fill();
	}
	ctx.restore();
	const cols = [accent, '#ffffff', shade(main, 0.45), pal[2] ?? accent];
	for (let i = 0; i < 46; i++) {
		const x = hash(i, 1) * W;
		const y = hash(i, 2) * H;
		const r = 5 + hash(i, 3) * 10;
		ctx.save();
		ctx.globalAlpha = 0.35 + hash(i, 4) * 0.4;
		ctx.fillStyle = cols[i % cols.length];
		ctx.translate(x, y);
		ctx.rotate(hash(i, 5) * TAU);
		if (i % 3 === 0) {
			starPath(ctx, 0, 0, 4, r * 1.6, r * 0.5);
			ctx.fill();
		} else if (i % 3 === 1) ctx.fillRect(-r / 2, -r, r, r * 2);
		else {
			ctx.beginPath();
			ctx.arc(0, 0, r * 0.7, 0, TAU);
			ctx.fill();
		}
		ctx.restore();
	}

	// encabezado y nombre
	drawText(ctx, '¡FELIZ CUMPLEAÑOS!', W / 2, 104, {font, size: fitSize(ctx, '¡FELIZ CUMPLEAÑOS!', font, 560, 50), fill: accent, spacing: 1.5, shadow: dark});
	const nm = c.name.toLocaleUpperCase('es');
	const ns = fitSize(ctx, nm, font, 650, 170, 40);
	drawText(ctx, nm, W / 2, 118 + ns * 1.02, {font, size: ns, fill: '#ffffff', stroke: dark, strokeW: ns * 0.14, shadow: shade(main, -0.7), shadowDy: ns * 0.07});

	// edad (o foto con la edad en una insignia)
	// con personajes (posterArt) la edad o la foto suben y los personajes ocupan una fila entre ella y los datos
	const art = (template.posterArt ?? []).map((n) => tplImage(template.id, n)).filter((x): x is NonNullable<typeof x> => !!x);
	const cy = art.length ? 435 : 560;
	const badge = (x: number, y: number, R: number) => {
		ctx.save();
		ctx.shadowColor = 'rgba(0,0,0,.4)';
		ctx.shadowBlur = 24;
		ctx.shadowOffsetY = 10;
		starPath(ctx, x, y, 14, R, R * 0.84, -Math.PI / 2);
		ctx.fillStyle = accent;
		ctx.fill();
		ctx.restore();
		ctx.beginPath();
		ctx.arc(x, y, R * 0.74, 0, TAU);
		ctx.fillStyle = shade(main, -0.35);
		ctx.fill();
		const age = String(c.age);
		const as = fitSize(ctx, age, font, R * 1.15, R * 1.05, 30);
		drawText(ctx, age, x, y + as * 0.36, {font, size: as, fill: '#ffffff', stroke: dark, strokeW: as * 0.08});
		drawText(ctx, 'AÑOS', x, y + R * 0.62, {font, size: R * 0.2, fill: accent, spacing: 1.5});
	};
	if (c.photo) {
		const r = art.length ? 140 : 180;
		glow(ctx, W / 2, cy, r * 1.6, accent, 0.3);
		ctx.fillStyle = accent;
		ctx.beginPath();
		ctx.arc(W / 2, cy, r + 14, 0, TAU);
		ctx.fill();
		ctx.fillStyle = dark;
		ctx.beginPath();
		ctx.arc(W / 2, cy, r + 4, 0, TAU);
		ctx.fill();
		drawPhotoIn(ctx, c.photo, 'circle', W / 2, cy, r);
		badge(W / 2 + r * 0.82, cy + r * 0.82, art.length ? 66 : 88);
	} else {
		badge(W / 2, cy, art.length ? 140 : 190);
	}
	// personajes: una fila, apoyados sobre el panel de datos y todos del mismo alto
	art.forEach((im, i) => {
		const h = 270;
		const w = Math.min((im.width / im.height) * h, W / art.length - 10);
		const hh = w / (im.width / im.height);
		const x = (W * (i + 0.5)) / art.length;
		ctx.save();
		ctx.shadowColor = 'rgba(0,0,0,.45)';
		ctx.shadowBlur = 18;
		ctx.shadowOffsetY = 8;
		ctx.drawImage(im, x - w / 2, 800 - hh, w, hh);
		ctx.restore();
	});

	// datos de la fiesta sobre un panel
	const top = 800;
	const rows = [
		{label: 'FECHA', value: dateLine(c).toLocaleUpperCase('es'), hint: dateParts(c).map((x) => x.toLocaleUpperCase('es'))},
		{label: 'HORARIO', value: c.time.toLocaleUpperCase('es')},
		{label: 'LUGAR', value: c.venue.toLocaleUpperCase('es')},
		{label: 'DIRECCIÓN', value: c.address.toLocaleUpperCase('es')},
	];
	// un único tamaño para todos los datos; solo se pasa a dos líneas lo que no entra en una
	const {size: vsz, lines: split} = uniformRows(
		ctx,
		rows.map((r) => ({text: r.value, hint: r.hint})),
		font,
		580,
		46,
		22,
		(sz, ls) => ls.reduce((a, l) => a + 82 + (l.length - 1) * sz * 1.05, 0) <= 404
	);
	const gap = 82;
	const sizes = rows.map(() => vsz);
	const advs = split.map((l) => gap + (l.length - 1) * vsz * 1.05);
	const panelH = Math.max(392, 24 + advs.reduce((a, b) => a + b, 0));
	ctx.save();
	roundRectPath(ctx, 40, top, W - 80, panelH, 34);
	ctx.fillStyle = 'rgba(0,0,0,.38)';
	ctx.fill();
	ctx.lineWidth = 4;
	ctx.strokeStyle = accent;
	ctx.globalAlpha = 0.9;
	ctx.stroke();
	ctx.restore();
	let ry = top + 22;
	rows.forEach((r, i) => {
		drawText(ctx, r.label, W / 2, ry + 24, {font, size: 24, fill: accent, spacing: 2});
		const vs = sizes[i];
		split[i].forEach((l, j) => drawText(ctx, l, W / 2, ry + 30 + vs * 1.05 + j * vs * 1.05, {font, size: vs, fill: '#ffffff', shadow: dark, shadowDy: vs * 0.06}));
		ry += advs[i];
	});
	drawText(ctx, '¡TE ESPERAMOS!', W / 2, Math.min(1262, Math.max(1245, top + panelH + 52)), {font, size: 46, fill: accent, spacing: 1.5, shadow: dark});
}
