import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPurchaseService, PurchaseError, UNPAID_TTL_MS} from '../src/server/purchases.ts';
import {FakeGateway} from '../src/server/fake-gateway.ts';
import {createMemoryStore} from '../src/server/store.ts';
import {DEFAULT_SETTINGS, normalizeSettings} from '../src/config/site.ts';
import type {PaymentGateway} from '../src/server/gateway.ts';
import type {GatewayPayment} from '../src/server/payment-evaluation.ts';

const DAY = 86400e3;
const data = {name: 'Valentina', age: '9', date: '2026-12-20', time: '17:30', venue: 'Quinta Los Aromos', address: 'Ruta 8 km 52, Pilar'};
// JPEG mínimo válido a nivel de cabecera (FFD8FF) para la prueba
const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).toString('base64');

/** pasarela que aprueba todo lo que se cree, con el importe que se le pidió */
class Gate implements PaymentGateway {
	payments: GatewayPayment[] = [];
	async createPreference(i: Parameters<PaymentGateway['createPreference']>[0]) {
		this.payments.unshift({id: 'p-' + i.purchaseId, status: 'approved', transaction_amount: i.amount, currency_id: i.currency, external_reference: i.purchaseId});
		return {id: 'x', initPoint: 'https://mp.test'};
	}
	async searchPaymentsByReference(ref: string) {
		return this.payments.filter((p) => p.external_reference === ref);
	}
	async getPayment(id: string) {
		return this.payments.find((p) => p.id === id) ?? null;
	}
}

function setup(settings = DEFAULT_SETTINGS) {
	let clock = Date.UTC(2026, 9, 24, 12);
	const store = createMemoryStore();
	const gateway = new Gate();
	const svc = createPurchaseService({
		gateway,
		store,
		appUrl: 'https://app.test',
		tokenSecret: 's',
		getSettings: async () => settings,
		isTemplateAvailable: async (id) => id === 'boca' || id === 'c-abc123',
		now: () => clock,
	});
	return {svc, store, gateway, advance: (ms: number) => (clock += ms), now: () => clock};
}

test('al comprar se guardan los datos y la foto; recuperar muestra lo comprado (solo lectura)', async () => {
	const {svc} = setup();
	const c = await svc.create('boca', {data, audio: {kind: 'library', id: 'nivel-arcade'}, photo: jpeg});
	const s = await svc.status(c.purchaseId);
	assert.equal(s.status, 'approved');
	assert.equal(s.hasSnapshot, true);
	const snap = await svc.snapshot(c.purchaseId);
	assert.equal(snap.snapshot?.data.name, 'Valentina');
	assert.deepEqual(snap.snapshot?.audio, {kind: 'library', id: 'nivel-arcade'});
	assert.match(snap.photo ?? '', /^data:image\/jpeg;base64,/);
});

test('el vencimiento se cuenta desde el pago y respeta los días configurados', async () => {
	const {svc, now} = setup({...DEFAULT_SETTINGS, retentionDays: 10});
	const c = await svc.create('boca', {data, audio: {kind: 'default'}});
	const s = await svc.status(c.purchaseId);
	assert.equal(s.expiresAt, now() + 10 * DAY);
});

test('al vencer: se borran datos y foto, no se puede autorizar ni leer el snapshot', async () => {
	const {svc, store, advance} = setup({...DEFAULT_SETTINGS, retentionDays: 5});
	const c = await svc.create('boca', {data, audio: {kind: 'default'}, photo: jpeg});
	await svc.status(c.purchaseId); // registra el pago
	advance(6 * DAY);
	const s = await svc.status(c.purchaseId);
	assert.equal(s.status, 'expired');
	await assert.rejects(svc.authorize(c.purchaseId), (e: unknown) => e instanceof PurchaseError && e.code === 'expired');
	await assert.rejects(svc.snapshot(c.purchaseId), (e: unknown) => e instanceof PurchaseError && e.code === 'expired');
	const rec = await store.getPurchase(c.purchaseId);
	assert.equal(rec?.snapshot, undefined, 'sin datos personales');
	assert.ok(rec?.purged);
	assert.equal(await store.readPhoto(c.purchaseId), null, 'foto borrada');
	assert.equal(rec?.amount, 8000, 'se conserva el registro de la venta');
});

test('la limpieza automática (purge) borra vencidas y compras impagas viejas', async () => {
	const {svc, store, advance, gateway} = setup({...DEFAULT_SETTINGS, retentionDays: 2});
	const paid = await svc.create('boca', {data, audio: {kind: 'default'}, photo: jpeg});
	await svc.status(paid.purchaseId);
	gateway.payments = []; // la otra compra nunca se paga
	const unpaid = await svc.create('boca', {data, audio: {kind: 'default'}});
	gateway.payments = [];
	advance(UNPAID_TTL_MS + 3 * DAY);
	const n = await svc.purge();
	assert.equal(n, 2);
	assert.equal(await store.getPurchase(unpaid.purchaseId), null);
	assert.equal((await store.getPurchase(paid.purchaseId))?.snapshot, undefined);
});

test('el importe cobrado queda fijado en la compra aunque cambie el precio después', async () => {
	const settings = {...DEFAULT_SETTINGS};
	const {svc, store, gateway} = setup(settings);
	const c = await svc.create('boca', {data, audio: {kind: 'default'}});
	settings.price = 12000; // el admin sube el precio
	assert.equal((await store.getPurchase(c.purchaseId))?.amount, 8000);
	assert.equal((await svc.status(c.purchaseId)).status, 'approved');
	// un pago por el importe nuevo NO aprobaría la compra vieja
	gateway.payments = [{...gateway.payments[0], transaction_amount: 12000}];
	assert.equal((await svc.status(c.purchaseId)).status, 'mismatch');
});

test('se valida el snapshot: datos incompletos, foto inválida o plantilla inexistente', async () => {
	const {svc} = setup();
	await assert.rejects(svc.create('boca', {data: {...data, name: ''}, audio: {kind: 'default'}}), PurchaseError);
	await assert.rejects(svc.create('boca', {data, audio: {kind: 'default'}, photo: 'data:image/png;base64,AAAA'}), PurchaseError);
	await assert.rejects(svc.create('boca', {data, audio: {kind: 'default'}, photo: 'data:image/jpeg;base64,' + Buffer.alloc(800 * 1024, 0xff).toString('base64')}), PurchaseError);
	await assert.rejects(svc.create('no-existe', {data, audio: {kind: 'default'}}), PurchaseError);
	await svc.create('c-abc123', {data, audio: {kind: 'mute'}}); // un video compilado publicado sí se puede comprar
});

test('sin datos guardados (compra vieja o disco perdido) el generador cae al modo editable', async () => {
	const {svc} = setup();
	const c = await svc.create('boca');
	assert.equal((await svc.status(c.purchaseId)).hasSnapshot, false);
	assert.equal((await svc.snapshot(c.purchaseId)).snapshot, null);
});

test('modo prueba: PRUEBA-<plantilla> funciona con videos compilados y no tiene datos guardados', async () => {
	const store = createMemoryStore();
	const svc = createPurchaseService({gateway: new FakeGateway(), store, appUrl: 'http://localhost:3000', tokenSecret: 's', testMode: true});
	const s = await svc.status('PRUEBA-c-tzvivuh1');
	assert.equal(s.status, 'approved');
	assert.equal(s.templateId, 'c-tzvivuh1');
	assert.equal(s.hasSnapshot, false);
});

test('normalizeSettings acota precios y plazos y rechaza URLs externas en la marca de agua', () => {
	const s = normalizeSettings({price: -5, retentionDays: 9999, maxFinalRenders: 0, watermark: {opacityPercent: 1, imageSrc: 'https://evil.com/x.png', mode: 'image'}, analytics: {gaId: 'javascript:alert(1)', clarityId: 'abcd1234ef'}});
	assert.equal(s.price, 100);
	assert.equal(s.retentionDays, 365);
	assert.equal(s.maxFinalRenders, 1);
	assert.equal(s.watermark.opacityPercent, 10, 'la marca de agua nunca queda invisible');
	assert.equal(s.watermark.imageSrc, DEFAULT_SETTINGS.watermark.imageSrc);
	assert.equal(s.analytics.gaId, '');
	assert.equal(s.analytics.clarityId, 'abcd1234ef');
	assert.equal(normalizeSettings({watermark: {imageSrc: '/api/media/abcdef1234567890abcd'}}).watermark.imageSrc, '/api/media/abcdef1234567890abcd');
});

test('videoUpgradePrice: 20% menos, siempre terminado en 500 o 750 y nunca más caro que el video', async () => {
	const {videoUpgradePrice} = await import('../src/config/pricing.ts');
	assert.equal(videoUpgradePrice(8000), 6500);
	for (const price of [3000, 5000, 8000, 8900, 12000, 20000]) {
		const v = videoUpgradePrice(price);
		assert.ok([500, 750].includes(v % 1000), `${price} → ${v}`);
		assert.ok(v <= price);
		assert.ok(Math.abs(v - price * 0.8) <= 500, `${price} → ${v} cerca del 20% de descuento`);
	}
});

test('a una compra de imagen se le puede sumar el video con descuento: mismos datos, importe del servidor y una sola vez', async () => {
	const {videoUpgradePrice} = await import('../src/config/pricing.ts');
	const {svc, store, gateway} = setup();
	const img = await svc.create('boca', {data, audio: {kind: 'default'}, photo: jpeg}, 'image');
	// un video normal no puede pedir el descuento sin una compra de imagen paga
	await assert.rejects(svc.create('boca', undefined, 'video', 'no-es-un-codigo'), PurchaseError);
	const up = await svc.create('boca', undefined, 'video', img.purchaseId);
	const paid = gateway.payments.find((p) => p.external_reference === up.purchaseId);
	assert.equal(paid?.transaction_amount, videoUpgradePrice(DEFAULT_SETTINGS.price));
	const rec = await store.getPurchase(up.purchaseId);
	assert.equal(rec?.product, 'video');
	assert.equal(rec?.snapshot?.data.name, 'Valentina');
	assert.equal(rec?.hasPhoto, true, 'se copia la foto');
	assert.equal((await svc.status(up.purchaseId)).status, 'approved');
	// la compra de imagen ahora informa el video que se sumó
	assert.equal((await svc.status(img.purchaseId)).videoPurchaseId, up.purchaseId);
	// y no se puede repetir el descuento
	await assert.rejects(svc.create('boca', undefined, 'video', img.purchaseId), PurchaseError);
	// una compra de video puede sumar la imagen (más barata), una sola vez
	const {imageUpgradePrice} = await import('../src/config/pricing.ts');
	const im = await svc.create('boca', undefined, 'image', up.purchaseId);
	assert.equal(gateway.payments.find((p) => p.external_reference === im.purchaseId)?.transaction_amount, imageUpgradePrice(DEFAULT_SETTINGS));
	assert.equal((await store.getPurchase(im.purchaseId))?.product, 'image');
	assert.equal((await svc.status(im.purchaseId)).status, 'approved');
	assert.equal((await svc.status(up.purchaseId)).imagePurchaseId, im.purchaseId);
	await assert.rejects(svc.create('boca', undefined, 'image', up.purchaseId), PurchaseError);
});

test('promos editables: el precio del admin manda, 0 usa el automático y nunca supera el precio normal', async () => {
	const {videoPromoPrice, imagePromoPrice, videoUpgradePrice} = await import('../src/config/pricing.ts');
	const {normalizeSettings} = await import('../src/config/site.ts');
	const base = {price: 8000, imagePrice: 5000, bundlePrice: 9500};
	assert.equal(videoPromoPrice(base), videoUpgradePrice(8000));
	assert.equal(imagePromoPrice(base), 1500);
	assert.equal(videoPromoPrice({...base, videoUpgrade: 7000}), 7000);
	assert.equal(imagePromoPrice({...base, imageUpgrade: 2000}), 2000);
	assert.equal(videoPromoPrice({...base, videoUpgrade: 9999}), 8000);
	const s = normalizeSettings({price: 8000, imagePrice: 5000, videoUpgrade: 99999, imageUpgrade: 3000});
	assert.equal(s.videoUpgrade, 8000, 'se acota al precio del video');
	assert.equal(s.imageUpgrade, 3000);
});
