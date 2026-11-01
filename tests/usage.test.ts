import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildUsage, usageLimits, type UsageNow, type UsageSnapshot} from '../src/server/usage.ts';
import {createMemoryStore} from '../src/server/store.ts';

const MB = 1024 * 1024;
const limits = {dbBytes: 100 * MB, blobBytes: 100 * MB};
const now = (dbMb: number, blobMb: number): UsageNow => ({dbBytes: dbMb * MB, blobBytes: blobMb * MB, photoBytes: 0, purchases: 0, media: 0, tables: []});
const snap = (day: string, dbMb: number, blobMb: number): UsageSnapshot => ({day, dbBytes: dbMb * MB, blobBytes: blobMb * MB, photoBytes: 0, purchases: 0, media: 0});

test('sin historial no inventa una proyección', () => {
	const r = buildUsage(now(10, 5), '2026-11-10', [], limits);
	assert.equal(r.items[0].bytesPerDay, null);
	assert.equal(r.items[0].daysLeft, null);
	assert.equal(r.items[0].status, 'ok');
});

test('proyecta cuántos días faltan según el crecimiento de la ventana', () => {
	// 10 MB en 10 días = 1 MB por día; quedan 90 MB para llenar 100
	const r = buildUsage(now(20, 0), '2026-11-20', [snap('2026-11-10', 10, 0)], limits);
	const db = r.items[0];
	assert.equal(db.bytesPerDay, MB);
	assert.equal(db.daysLeft, 80);
	assert.equal(db.status, 'ok');
});

test('avisa cuando se llena pronto o ya está casi lleno', () => {
	const soon = buildUsage(now(60, 0), '2026-11-11', [snap('2026-11-10', 30, 0)], limits).items[0];
	assert.equal(soon.daysLeft, 1);
	assert.equal(soon.status, 'danger');
	const high = buildUsage(now(75, 0), '2026-11-10', [], limits).items[0];
	assert.equal(high.status, 'warn');
	assert.equal(buildUsage(now(95, 0), '2026-11-10', [], limits).items[0].status, 'danger');
});

test('si el uso baja (se borraron datos vencidos) no hay días restantes', () => {
	const r = buildUsage(now(5, 0), '2026-11-20', [snap('2026-11-10', 10, 0)], limits);
	assert.equal(r.items[0].daysLeft, null);
});

test('el registro de hoy reemplaza al guardado y el diario muestra los cambios', () => {
	const r = buildUsage(now(12, 3), '2026-11-02', [snap('2026-11-01', 10, 1), snap('2026-11-02', 11, 2)], limits);
	assert.equal(r.daily.length, 2);
	assert.equal(r.daily[0].day, '2026-11-02'); // el más reciente primero
	assert.equal(r.daily[0].dbBytes, 12 * MB);
	assert.equal(r.daily[0].dbDelta, 2 * MB);
	assert.equal(r.daily[0].blobDelta, 2 * MB);
});

test('el mes muestra el último valor y el crecimiento contra el cierre del anterior', () => {
	const r = buildUsage(now(30, 0), '2026-12-05', [snap('2026-11-01', 10, 0), snap('2026-11-30', 20, 0)], limits);
	assert.deepEqual(
		r.monthly.map((m) => [m.month, m.dbBytes / MB, m.dbGrowth / MB]),
		[
			['2026-12', 30, 10],
			['2026-11', 20, 10],
		]
	);
});

test('los topes salen de las variables y tienen valores por defecto', () => {
	assert.deepEqual(usageLimits({}), {dbBytes: 512 * MB, blobBytes: 1024 * MB});
	assert.deepEqual(usageLimits({DB_LIMIT_MB: '100', BLOB_LIMIT_MB: 'x'}), {dbBytes: 100 * MB, blobBytes: 1024 * MB});
});

test('el almacenamiento en memoria mide medios y guarda el historial diario', async () => {
	const store = createMemoryStore();
	await store.putMedia({id: 'abcdefgh1', kind: 'image', mime: 'image/png', bytes: 1000, name: 'a.png'}, Buffer.alloc(1000));
	const u = await store.measureUsage();
	assert.equal(u.blobBytes, 1000);
	assert.equal(u.media, 1);
	await store.recordUsage('2026-11-01', u);
	await store.recordUsage('2026-11-01', {...u, blobBytes: 2000});
	const h = await store.readUsage();
	assert.equal(h.length, 1);
	assert.equal(h[0].blobBytes, 2000);
});
