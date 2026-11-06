import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkPassword, sameOrigin, signSession, verifySession, readCookie, SESSION_MS} from '../src/server/admin-auth.ts';
import {buildStats} from '../src/server/stats.ts';
import {sniffMedia} from '../src/server/media-sniff.ts';
import {normalizeSpec, specDuration, specMediaIds} from '../src/templates/compiled-types.ts';
import type {PurchaseRecord} from '../src/server/db.ts';

test('contraseña de admin y sesión firmada con vencimiento', () => {
	assert.equal(checkPassword('clave-larga-123', 'clave-larga-123'), true);
	assert.equal(checkPassword('otra', 'clave-larga-123'), false);
	assert.equal(checkPassword(undefined, 'clave-larga-123'), false);
	assert.equal(checkPassword('x', undefined), false);
	const t0 = 1_000_000;
	const c = signSession('secreto', t0);
	assert.equal(verifySession(c, 'secreto', t0 + 1000), true);
	assert.equal(verifySession(c, 'otro', t0 + 1000), false, 'otro secreto');
	assert.equal(verifySession(c, 'secreto', t0 + SESSION_MS + 1), false, 'vencida');
	assert.equal(verifySession('9999999999999.firma', 'secreto', t0), false, 'firma falsa');
	assert.equal(verifySession(undefined, 'secreto', t0), false);
	assert.equal(readCookie('a=1; adm=abc.def; b=2', 'adm'), 'abc.def');
});

test('CSRF: el Origin debe coincidir con el host', () => {
	const h = (o: Record<string, string>) => ({get: (k: string) => o[k] ?? null});
	assert.equal(sameOrigin(h({origin: 'https://sitio.com', host: 'sitio.com'})), true);
	assert.equal(sameOrigin(h({origin: 'https://evil.com', host: 'sitio.com'})), false);
	assert.equal(sameOrigin(h({origin: 'https://sitio.com', 'x-forwarded-host': 'sitio.com', host: 'interno:3000'})), true);
	assert.equal(sameOrigin(h({host: 'sitio.com'})), false); // sin Origin ni Sec-Fetch-Site
	assert.equal(sameOrigin(h({host: 'sitio.com', 'sec-fetch-site': 'same-origin'})), true);
	assert.equal(sameOrigin(h({host: 'sitio.com', 'sec-fetch-site': 'cross-site'})), false);
});

test('un "ftyp" sin estructura de MP4 válida se rechaza y los nombres se sanean', async () => {
	const {sniffMedia, safeFileName} = await import('../src/server/media-sniff.ts');
	assert.equal(sniffMedia(Buffer.concat([Buffer.from([0xff, 0xff, 0xff, 0xff]), Buffer.from('ftypisom'), Buffer.alloc(32)])), null);
	assert.equal(safeFileName('../../etc/<img src=x onerror=alert(1)>.mp4'), 'img srcx onerroralert(1).mp4');
	assert.equal(safeFileName('..\\..\\video final.mp4'), 'video final.mp4');
	assert.equal(safeFileName('...'), 'archivo');
});

test('los archivos se reconocen por su contenido real, no por la extensión', () => {
	const pad = (b: number[]) => Buffer.concat([Buffer.from(b), Buffer.alloc(32)]);
	assert.equal(sniffMedia(pad([0x89, 0x50, 0x4e, 0x47]))?.mime, 'image/png');
	assert.equal(sniffMedia(pad([0xff, 0xd8, 0xff, 0xe0]))?.mime, 'image/jpeg');
	assert.equal(sniffMedia(Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(32)]))?.kind, 'video');
	assert.equal(sniffMedia(pad([0x1a, 0x45, 0xdf, 0xa3]))?.mime, 'video/webm');
	assert.equal(sniffMedia(Buffer.from('MZ este es un .exe renombrado a .mp4 ......')), null);
	assert.equal(sniffMedia(Buffer.from('<html><script>alert(1)</script></html>')), null);
});

test('normalizeSpec limpia el JSON del admin y acota escenas y duración', () => {
	const spec = normalizeSpec({
		name: '  Video  ',
		enabled: true,
		scenes: [
			{
				duration: 500,
				bg: {kind: 'video', mediaId: 'abcdef1234567890abcd'},
				layers: [
					{type: 'text', text: '<script>{nombre}</script>', x: 9999, y: -9999, w: 50, size: 99, font: 'Comic Sans', color: 'rojo', enter: 'explotar', loop: 'volar'},
					{type: 'image', mediaId: '../../etc/passwd'},
					{type: 'hack'},
					{type: 'photo', shape: 'cubo'},
				],
			},
			{bg: {kind: 'gradient', from: 'no-es-color'}, layers: []},
		],
	});
	assert.ok(spec);
	assert.equal(spec!.name, 'Video');
	assert.ok(specDuration(spec!) <= 60, 'duración total acotada');
	const layers = spec!.scenes[0].layers;
	assert.equal(layers.length, 2, 'se descartan capas inválidas (imagen con id raro, tipo desconocido)');
	const t = layers[0];
	assert.ok(t.type === 'text' && t.font === 'Anton' && t.enter === 'fade' && t.loop === 'none' && t.x <= 150 && t.y >= -50);
	assert.ok(layers[1].type === 'photo' && layers[1].shape === 'circle');
	assert.deepEqual(specMediaIds(spec!).videos, ['abcdef1234567890abcd']);
	assert.equal(normalizeSpec({name: '', scenes: [{}]}), null);
	assert.equal(normalizeSpec({name: 'x', scenes: []}), null);
});

test('estadísticas: ventas, ingresos, abandonos y embudo; las pruebas no cuentan', () => {
	const now = Date.UTC(2026, 9, 24, 15);
	const rec = (o: Partial<PurchaseRecord>): PurchaseRecord => ({
		id: Math.random().toString(36),
		templateId: 'boca',
		createdAt: now - 3600e3,
		amount: 8000,
		currency: 'ARS',
		expiresAt: now + 30 * 86400e3,
		authorizations: 0,
		maxRenders: 5,
		testMode: false,
		...o,
	});
	const purchases = [
		rec({paidAt: now - 1000}),
		rec({paidAt: now - 2000, templateId: 'kpop'}),
		rec({paidAt: now - 3000, refundedAt: now}),
		rec({}), // sin pagar
		rec({paidAt: now - 1000, testMode: true}), // prueba local
	];
	const events = {'2026-10-24': {page_view: 10, 'template_selected|boca': 4, template_selected: 4, preview_ready: 3, buy_click: 2}};
	const s = buildStats(events, purchases, 7, now);
	assert.equal(s.sales, 2);
	assert.equal(s.revenue, 16000);
	assert.equal(s.refunded, 1);
	assert.equal(s.abandoned, 1);
	assert.equal(s.funnel.page_view, 10);
	assert.equal(s.byTemplate.find((t) => t.templateId === 'boca')?.selected, 4);
	assert.equal(s.byTemplate.find((t) => t.templateId === 'kpop')?.sales, 1);
	assert.equal(s.series.length, 7);
});
