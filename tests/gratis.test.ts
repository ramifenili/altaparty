import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeContact, parsePostUrl} from '../src/config/gratis.ts';
import {createClaimService} from '../src/server/claims.ts';
import {createPurchaseService} from '../src/server/purchases.ts';
import {createMemoryStore} from '../src/server/store.ts';
import type {PaymentGateway} from '../src/server/gateway.ts';

const noPay: PaymentGateway = {
	async createPreference() { throw new Error('no debe cobrar'); },
	async searchPaymentsByReference() { return []; },
	async getPayment() { return null; },
};

function setup() {
	const store = createMemoryStore();
	let clock = Date.UTC(2026, 9, 24, 12);
	const purchases = createPurchaseService({gateway: noPay, store, appUrl: 'https://a.test', tokenSecret: 's', isTemplateAvailable: async (id) => id === 'boca', now: () => clock});
	const claims = createClaimService({store, grant: (t, id) => purchases.grantFree(t, id), isTemplateAvailable: async (id) => id === 'boca', now: () => clock});
	return {claims, purchases, advance: (ms: number) => (clock += ms)};
}

const ok = {network: 'instagram', url: 'https://www.instagram.com/reel/ABC123/?igsh=xyz', contact: 'Ana@Mail.com', templateId: 'boca', views: 800};

test('parsePostUrl valida la red, rechaza perfiles y quita parámetros de seguimiento', () => {
	assert.equal(parsePostUrl('instagram.com/reel/ABC/?igsh=1&utm_source=x', 'instagram'), 'https://instagram.com/reel/ABC');
	assert.equal(parsePostUrl('https://www.instagram.com/', 'instagram'), null);
	assert.equal(parsePostUrl('https://evil.com/instagram.com/reel/A', 'instagram'), null);
	assert.equal(parsePostUrl('https://notinstagram.com/reel/ABC', 'instagram'), null);
	assert.equal(parsePostUrl('https://www.youtube.com/watch?v=abc&si=1', 'youtube'), 'https://youtube.com/watch?v=abc');
	assert.equal(parsePostUrl('https://tiktok.com/@a/video/1', 'instagram'), null);
});

test('normalizeContact acepta email o WhatsApp', () => {
	assert.equal(normalizeContact(' Ana@Mail.com '), 'ana@mail.com');
	assert.equal(normalizeContact('11 2345-6789'), 'wa:1123456789');
	assert.equal(normalizeContact('hola'), null);
});

test('un canje queda pendiente; al aprobarlo se crea un código gratis que habilita el video sin pagar', async () => {
	const {claims, purchases} = setup();
	const c = await claims.submit(ok);
	assert.equal(c.status, 'pending');
	assert.equal(c.purchaseId, undefined);
	const done = await claims.decide(c.claimId, 'approve');
	assert.equal(done.status, 'approved');
	const s = await purchases.status(done.purchaseId);
	assert.equal(s.status, 'approved');
	const a = await purchases.authorize(done.purchaseId!);
	assert.ok(a.token);
	assert.equal((await claims.status(c.claimId)).purchaseId, done.purchaseId);
	// idempotente: no crea otro código
	assert.equal((await claims.decide(c.claimId, 'approve')).purchaseId, done.purchaseId);
});

test('rechaza pocas vistas, enlaces repetidos y un segundo canje de la misma persona', async () => {
	const {claims, advance} = setup();
	await assert.rejects(claims.submit({...ok, views: 10}), /vistas/);
	await claims.submit(ok);
	await assert.rejects(claims.submit({...ok, contact: 'otra@mail.com'}), /ya fue enviado/);
	await assert.rejects(claims.submit({...ok, url: 'https://instagram.com/reel/OTRO'}), /en curso o aprobado/);
	advance(31 * 86400e3);
	await claims.submit({...ok, url: 'https://instagram.com/reel/OTRO'});
});

test('un canje rechazado no aprueba nada y deja volver a intentar con otro enlace', async () => {
	const {claims} = setup();
	const c = await claims.submit(ok);
	const r = await claims.decide(c.claimId, 'reject', 'No se ven las vistas');
	assert.equal(r.status, 'rejected');
	assert.equal((await claims.status(c.claimId)).purchaseId, undefined);
	await claims.submit({...ok, url: 'https://instagram.com/reel/NUEVO'});
});
