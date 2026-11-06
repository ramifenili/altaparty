import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MemoryLimiter, checkLimit, clientIp, RULES, type RateLimiter} from '../src/server/ratelimit.ts';

const rule = {name: 'prueba', limit: 3, windowMs: 1000};

test('permite hasta el límite y bloquea el excedente con Retry-After', async () => {
	let now = 0;
	const l = new MemoryLimiter(() => now);
	for (let i = 0; i < 3; i++) assert.equal((await l.hit('1.1.1.1', rule)).allowed, true);
	const blocked = await l.hit('1.1.1.1', rule);
	assert.equal(blocked.allowed, false);
	assert.ok(blocked.retryAfterSec >= 1);
});

test('el contador es por IP y por regla', async () => {
	const l = new MemoryLimiter(() => 0);
	for (let i = 0; i < 4; i++) await l.hit('1.1.1.1', rule);
	assert.equal((await l.hit('2.2.2.2', rule)).allowed, true);
	assert.equal((await l.hit('1.1.1.1', {...rule, name: 'otra'})).allowed, true);
});

test('la ventana se reinicia al vencer', async () => {
	let now = 0;
	const l = new MemoryLimiter(() => now);
	for (let i = 0; i < 4; i++) await l.hit('ip', rule);
	now = 1001;
	assert.equal((await l.hit('ip', rule)).allowed, true);
});

test('IP del cliente: primer valor de x-forwarded-for, luego x-real-ip', () => {
	const h = (o: Record<string, string>) => ({get: (k: string) => o[k] ?? null});
	assert.equal(clientIp(h({'x-forwarded-for': '9.9.9.9, 10.0.0.1'})), '9.9.9.9');
	assert.equal(clientIp(h({'x-real-ip': '8.8.8.8'})), '8.8.8.8');
	assert.equal(clientIp(h({})), 'sin-ip');
});

test('si el almacenamiento externo falla, se deja pasar (fail-open)', async () => {
	const broken: RateLimiter = {hit: async () => { throw new Error('caído'); }};
	const origError = console.error;
	console.error = () => {};
	try {
		const r = await checkLimit(broken, {get: () => null}, RULES.config);
		assert.equal(r.allowed, true);
	} finally {
		console.error = origError;
	}
});

test('las rutas que crean cobros tienen el límite más bajo', () => {
	assert.ok(RULES.createPurchase.limit < RULES.purchaseStatus.limit);
	assert.ok(RULES.authorize.limit <= RULES.createPurchase.limit * 2);
});

test('rutas sensibles se cierran si falla el almacenamiento; las demás se abren', async () => {
	const broken = {hit: async () => { throw new Error('caído'); }};
	const h = {get: () => null};
	const q = console.error;
	console.error = () => {};
	assert.equal((await checkLimit(broken, h, RULES.adminLogin)).allowed, false);
	assert.equal((await checkLimit(broken, h, RULES.config)).allowed, true);
	console.error = q;
	const hh = {get: (k: string) => ({'x-vercel-forwarded-for': '1.2.3.4', 'x-forwarded-for': '6.6.6.6'} as Record<string, string>)[k] ?? null};
	assert.equal(clientIp(hh, {VERCEL: '1'}), '1.2.3.4');
});
