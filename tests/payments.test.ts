import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePayments, type GatewayPayment} from '../src/server/payment-evaluation.ts';
import {createPurchaseService, PurchaseError} from '../src/server/purchases.ts';
import type {PaymentGateway, PreferenceInput} from '../src/server/gateway.ts';
import {createMemoryStore} from '../src/server/store.ts';
import {DEFAULT_SETTINGS} from '../src/config/site.ts';
import {signToken, verifyToken} from '../src/server/token.ts';
import {verifyMercadoPagoSignature} from '../src/server/webhook.ts';
import {PRICING} from '../src/config/pricing.ts';
import {createHmac} from 'node:crypto';

const EXPECTED = {amount: PRICING.price, currency: PRICING.currency};
const PID = '11111111-2222-3333-4444-555555555555.boca';

const pay = (o: Partial<GatewayPayment> = {}): GatewayPayment => ({
	id: '900',
	status: 'approved',
	transaction_amount: PRICING.price,
	currency_id: 'ARS',
	external_reference: PID,
	...o,
});

// ---------- evaluación de pagos ----------
test('pago aprobado con importe, moneda y referencia correctos → approved', () => {
	assert.equal(evaluatePayments(PID, [pay()], EXPECTED).status, 'approved');
});

test('importe distinto → mismatch (nunca approved)', () => {
	assert.equal(evaluatePayments(PID, [pay({transaction_amount: 100})], EXPECTED).status, 'mismatch');
});

test('moneda distinta → mismatch', () => {
	assert.equal(evaluatePayments(PID, [pay({currency_id: 'USD'})], EXPECTED).status, 'mismatch');
});

test('un pago de otra compra no habilita esta', () => {
	assert.equal(evaluatePayments(PID, [pay({external_reference: 'otro'})], EXPECTED).status, 'unpaid');
});

test('estados pendiente, rechazado, cancelado y devuelto', () => {
	assert.equal(evaluatePayments(PID, [pay({status: 'pending'})], EXPECTED).status, 'pending');
	assert.equal(evaluatePayments(PID, [pay({status: 'in_process'})], EXPECTED).status, 'pending');
	assert.equal(evaluatePayments(PID, [pay({status: 'rejected'})], EXPECTED).status, 'rejected');
	assert.equal(evaluatePayments(PID, [pay({status: 'cancelled'})], EXPECTED).status, 'cancelled');
	assert.equal(evaluatePayments(PID, [pay({status: 'refunded'})], EXPECTED).status, 'refunded');
	assert.equal(evaluatePayments(PID, [], EXPECTED).status, 'unpaid');
});

test('un pago rechazado más reciente no anula uno aprobado, y duplicados no cambian el resultado', () => {
	const list = [pay({id: '2', status: 'rejected'}), pay({id: '1'}), pay({id: '1'})];
	assert.equal(evaluatePayments(PID, list, EXPECTED).status, 'approved');
});

// ---------- servicio de compras con pasarela falsa ----------
function setup(payments: GatewayPayment[] = [], now = () => Date.now()) {
	const created: PreferenceInput[] = [];
	const gateway: PaymentGateway = {
		async createPreference(i) {
			created.push(i);
			return {id: 'pref-1', initPoint: 'https://mp.test/checkout'};
		},
		async searchPaymentsByReference(ref) {
			return payments.filter((p) => p.external_reference === ref);
		},
		async getPayment(id) {
			return payments.find((p) => p.id === id) ?? null;
		},
	};
	const store = createMemoryStore();
	const svc = createPurchaseService({gateway, store, appUrl: 'https://app.test', tokenSecret: 'secreto-de-prueba', now});
	return {svc, created, payments, store};
}

test('el importe lo fija el servidor: se cobra siempre el precio configurado', async () => {
	const {svc, created} = setup();
	const r = await svc.create('boca');
	assert.equal(created.length, 1);
	assert.equal(created[0].amount, PRICING.price);
	assert.equal(created[0].currency, 'ARS');
	assert.equal(created[0].purchaseId, r.purchaseId);
	assert.match(r.purchaseId, /^[0-9a-f-]{36}\.boca$/);
	assert.equal(r.checkoutUrl, 'https://mp.test/checkout');
});

test('el importe depende del producto (video, imagen o ambas) y lo fija el servidor', async () => {
	const casos: [unknown, number][] = [
		['video', PRICING.price],
		['image', PRICING.imagePrice],
		['both', PRICING.bundlePrice],
		['gratis', PRICING.price],
		[undefined, PRICING.price],
	];
	for (const [product, amount] of casos) {
		const {svc, created} = setup();
		await svc.create('boca', undefined, product);
		assert.equal(created[0].amount, amount, `producto ${String(product)}`);
	}
});

test('el video y la imagen se autorizan solo si la compra los incluye; la imagen no gasta generaciones', async () => {
	const {svc, payments} = setup();
	const r = await svc.create('boca', undefined, 'image');
	payments.push(pay({external_reference: r.purchaseId, transaction_amount: PRICING.imagePrice}));
	await assert.rejects(svc.authorize(r.purchaseId), (e: unknown) => e instanceof PurchaseError && e.http === 403);
	const a = await svc.authorize(r.purchaseId, 'image');
	assert.equal(a.kind, 'image');
	assert.equal(a.remaining, DEFAULT_SETTINGS.maxFinalRenders);
	assert.equal(svc.checkAuthorization(a.token).kind, 'image');
	assert.equal((await svc.status(r.purchaseId)).product, 'image');
});

test('pasarela de prueba: cobra el importe de la preferencia (video + imagen no da "no coincide")', async () => {
	const gateway = new FakeGateway();
	const store = createMemoryStore();
	const svc = createPurchaseService({gateway, store, appUrl: 'http://localhost:3000', tokenSecret: 's'});
	for (const [product, amount] of [['video', PRICING.price], ['image', PRICING.imagePrice], ['both', PRICING.bundlePrice]] as const) {
		const r = await svc.create('boca', undefined, product);
		const st = await svc.status(r.purchaseId);
		assert.equal(st.status, 'approved', `producto ${product} por ${amount}`);
		assert.equal(st.product, product);
	}
});

test('rechaza plantillas inexistentes y códigos de compra inválidos', async () => {
	const {svc} = setup();
	await assert.rejects(svc.create('no-existe'), PurchaseError);
	await assert.rejects(svc.create({amount: 1}), PurchaseError);
	await assert.rejects(svc.status('../../etc/passwd'), PurchaseError);
	await assert.rejects(svc.authorize(undefined), PurchaseError);
});

test('sin pago aprobado NO se emite autorización de render final', async () => {
	for (const payments of [[], [pay({status: 'pending'})], [pay({status: 'rejected'})], [pay({transaction_amount: 1})]]) {
		const {svc} = setup(payments);
		await assert.rejects(svc.authorize(PID), (e: unknown) => e instanceof PurchaseError && e.code === 'not_paid' && e.http === 402);
	}
});

test('con pago aprobado se emite una autorización firmada y verificable', async () => {
	const {svc} = setup([pay()]);
	const a = await svc.authorize(PID);
	assert.equal(a.templateId, 'boca');
	assert.deepEqual(svc.checkAuthorization(a.token), {purchaseId: PID, templateId: 'boca', kind: 'video'});
});

test('un token manipulado, de otro secreto o vencido es rechazado', async () => {
	let clock = 1_000_000;
	const {svc} = setup([pay()], () => clock);
	const a = await svc.authorize(PID);
	const [body, sig] = a.token.split('.');
	const forged = Buffer.from(JSON.stringify({pid: PID.replace('boca', 'dinos'), tpl: 'dinos', exp: clock + 99999})).toString('base64url');
	assert.throws(() => svc.checkAuthorization(`${forged}.${sig}`), PurchaseError);
	assert.throws(() => svc.checkAuthorization(`${body}.AAAA`), PurchaseError);
	assert.throws(() => svc.checkAuthorization(signToken({pid: PID, tpl: 'boca', exp: clock + 1000}, 'otro-secreto')), PurchaseError);
	clock += 31 * 60 * 1000;
	assert.throws(() => svc.checkAuthorization(a.token), PurchaseError);
});

test('markDelivered solo funciona con una autorización válida y es idempotente', async () => {
	const {svc, store} = setup([pay()]);
	await assert.rejects(svc.markDelivered('basura'), PurchaseError);
	assert.equal((await svc.status(PID)).delivered, false);
	const a = await svc.authorize(PID);
	await svc.markDelivered(a.token);
	await svc.markDelivered(a.token);
	assert.ok((await store.getPurchase(PID))?.deliveredAt);
	assert.equal((await svc.status(PID)).delivered, true);
});

test('una notificación duplicada se registra una sola vez y no cambia el estado', async () => {
	const {svc} = setup([pay()]);
	const first = await svc.handlePaymentNotification('900');
	const second = await svc.handlePaymentNotification('900');
	assert.deepEqual([first.handled && first.duplicate, second.handled && second.duplicate], [false, true]);
	assert.equal((await svc.status(PID)).status, 'approved');
	assert.equal((await svc.handlePaymentNotification('999')).handled, false);
});

// ---------- tokens y firma del webhook ----------
test('token: firma y vencimiento', () => {
	const t = signToken({pid: 'a', tpl: 'boca', exp: 2000}, 's');
	assert.ok(verifyToken(t, 's', 1000));
	assert.equal(verifyToken(t, 's', 3000), null);
	assert.equal(verifyToken(t, 'x', 1000), null);
	assert.equal(verifyToken('a.b.c', 's'), null);
});

test('webhook: firma x-signature de Mercado Pago', () => {
	const secret = 'clave-webhook';
	const ts = String(Date.now());
	const sign = (dataId: string, reqId: string) =>
		createHmac('sha256', secret).update(`id:${dataId.toLowerCase()};request-id:${reqId};ts:${ts};`).digest('hex');
	const header = `ts=${ts},v1=${sign('ABC123', 'req-1')}`;
	assert.equal(verifyMercadoPagoSignature({secret, signatureHeader: header, requestId: 'req-1', dataId: 'ABC123'}), true);
	assert.equal(verifyMercadoPagoSignature({secret, signatureHeader: header, requestId: 'req-2', dataId: 'ABC123'}), false);
	assert.equal(verifyMercadoPagoSignature({secret: 'otra', signatureHeader: header, requestId: 'req-1', dataId: 'ABC123'}), false);
	assert.equal(verifyMercadoPagoSignature({secret, signatureHeader: null, requestId: 'req-1', dataId: 'ABC123'}), false);
	assert.equal(verifyMercadoPagoSignature({secret, signatureHeader: header, requestId: 'req-1', dataId: 'ABC123', now: Date.now() + 3600_000}), false);
});

// ---------- modo de prueba local y límite de generaciones ----------
import {FakeGateway, fakePaymentsAllowed} from '../src/server/fake-gateway.ts';

function testService(max = 2) {
	const store = createMemoryStore();
	const svc = createPurchaseService({gateway: new FakeGateway(), store, appUrl: 'http://localhost:3000', tokenSecret: 's', testMode: true, getSettings: async () => ({...DEFAULT_SETTINGS, maxFinalRenders: max})});
	return {svc, store};
}

test('fakePaymentsAllowed: solo con la variable y nunca en un dominio público', () => {
	assert.equal(fakePaymentsAllowed({NODE_ENV: 'development', MP_FAKE_PAYMENTS: '1'}), true);
	assert.equal(fakePaymentsAllowed({NODE_ENV: 'development'}), false);
	assert.equal(fakePaymentsAllowed({NODE_ENV: 'production', MP_FAKE_PAYMENTS: '1', APP_URL: 'https://misitio.com'}), false);
	assert.equal(fakePaymentsAllowed({NODE_ENV: 'production', MP_FAKE_PAYMENTS: '1'}), false);
	assert.equal(fakePaymentsAllowed({NODE_ENV: 'production', MP_FAKE_PAYMENTS: '1', APP_URL: 'http://localhost:3000'}), true);
});

test('modo prueba: el código PRUEBA-<plantilla> equivale a una compra aprobada de esa plantilla', async () => {
	const {svc} = testService();
	const s = await svc.status('PRUEBA-dinos');
	assert.equal(s.status, 'approved');
	assert.equal(s.templateId, 'dinos');
	assert.equal(s.testMode, true);
	assert.equal(s.remaining, 2);
});

test('sin modo prueba, PRUEBA-<plantilla> es un código inválido', async () => {
	const {svc} = setup([pay()]);
	await assert.rejects(svc.status('PRUEBA-boca'), PurchaseError);
});

test('pago simulado: compra → aprobada con el importe del servidor', async () => {
	const {svc} = testService();
	const c = await svc.create('kpop');
	assert.match(c.checkoutUrl, /\?compra=/);
	assert.equal((await svc.status(c.purchaseId)).status, 'approved');
});

test('cada compra permite un máximo de generaciones finales (no hay videos infinitos)', async () => {
	const {svc} = testService(2);
	const a1 = await svc.authorize('PRUEBA-boca');
	assert.equal(a1.remaining, 1);
	await svc.authorize('PRUEBA-boca');
	await assert.rejects(svc.authorize('PRUEBA-boca'), (e: unknown) => e instanceof PurchaseError && e.code === 'limit_reached');
	assert.equal((await svc.status('PRUEBA-boca')).remaining, 0);
	// otra plantilla es otra compra
	assert.equal((await svc.authorize('PRUEBA-dinos')).remaining, 1);
});

test('pedidos simultáneos no superan el máximo de generaciones', async () => {
	const {svc} = testService(2);
	const results = await Promise.allSettled(Array.from({length: 8}, () => svc.authorize('PRUEBA-boca')));
	assert.equal(results.filter((r) => r.status === 'fulfilled').length, 2);
	assert.equal((await svc.status('PRUEBA-boca')).remaining, 0);
});

test('la autorización queda atada a la plantilla comprada', async () => {
	const {svc} = testService();
	const a = await svc.authorize('PRUEBA-gamer');
	assert.equal(svc.checkAuthorization(a.token).templateId, 'gamer');
});
