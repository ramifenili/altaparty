import {Pool, type PoolClient} from 'pg';
import {del, get, put} from '@vercel/blob';

// Al conectar el store en Vercel con el prefijo "BLOB_READ_WRITE_TOKEN", la variable queda como BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN;
// se acepta también ese nombre.
const blobToken = () => process.env.BLOB_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN;
import type {ClaimRecord, MediaMeta, PurchaseRecord} from './db.ts';
import {normalizeSettings, type SiteSettings} from '../config/site.ts';
import {SEED_SETTINGS} from '../config/seed-settings.ts';
import {normalizeSpec, type CompiledSpec} from '../templates/compiled-types.ts';
import {MEDIA_HEADERS, type ServedMedia} from './media-serve.ts';
import type {UsageNow, UsageSnapshot} from './usage.ts';

// Persistencia para hosting sin disco (Vercel): Postgres para los datos y las fotos de las
// compras (JPEG chico, se borra al vencer) y Vercel Blob privado para los medios del admin.
// Misma interfaz que DbStore (ver AppStore en store.ts).

const photoName = (id: string) => id;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS purchases (
	id text PRIMARY KEY,
	created_at bigint NOT NULL,
	paid_at bigint,
	expires_at bigint NOT NULL,
	purged bigint,
	data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS purchases_created_idx ON purchases (created_at DESC);
CREATE TABLE IF NOT EXISTS photos (id text PRIMARY KEY, bytes bytea NOT NULL);
CREATE TABLE IF NOT EXISTS claims (
	id text PRIMARY KEY,
	created_at bigint NOT NULL,
	decided_at bigint,
	purged bigint,
	url text NOT NULL,
	contact text NOT NULL,
	status text NOT NULL,
	data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS claims_created_idx ON claims (created_at DESC);
CREATE TABLE IF NOT EXISTS kv (key text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS compiled (id text PRIMARY KEY, created_at bigint NOT NULL, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS media (id text PRIMARY KEY, created_at bigint NOT NULL, pathname text NOT NULL, meta jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS webhook_events (key text PRIMARY KEY, at bigint NOT NULL);
CREATE TABLE IF NOT EXISTS events (day text NOT NULL, name text NOT NULL, n bigint NOT NULL, PRIMARY KEY (day, name));
CREATE TABLE IF NOT EXISTS usage_daily (
	day text PRIMARY KEY,
	db_bytes bigint NOT NULL,
	blob_bytes bigint NOT NULL,
	photo_bytes bigint NOT NULL,
	purchases integer NOT NULL,
	media integer NOT NULL
);
`;

export class PgStore {
	private pool: Pool;
	private ready: Promise<void> | null = null;

	constructor(connectionString: string) {
		// pocas conexiones por instancia: en serverless cada instancia abre las suyas
		this.pool = new Pool({connectionString, max: 3});
	}

	private init() {
		this.ready ??= this.pool.query(SCHEMA).then(() => undefined);
		this.ready.catch(() => (this.ready = null));
		return this.ready;
	}

	private async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
		await this.init();
		return this.pool.query<T>(sql, params);
	}

	private async tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
		await this.init();
		const c = await this.pool.connect();
		try {
			await c.query('BEGIN');
			const out = await fn(c);
			await c.query('COMMIT');
			return out;
		} catch (e) {
			await c.query('ROLLBACK').catch(() => undefined);
			throw e;
		} finally {
			c.release();
		}
	}

	// ---- compras ----
	private savePurchase(c: Pick<PoolClient, 'query'>, r: PurchaseRecord) {
		return c.query(
			`INSERT INTO purchases (id, created_at, paid_at, expires_at, purged, data) VALUES ($1,$2,$3,$4,$5,$6)
			 ON CONFLICT (id) DO UPDATE SET paid_at = $3, expires_at = $4, purged = $5, data = $6`,
			[r.id, r.createdAt, r.paidAt ?? null, r.expiresAt, r.purged ?? null, JSON.stringify(r)]
		);
	}

	async createPurchase(r: PurchaseRecord, photo?: Buffer) {
		await this.tx(async (c) => {
			if (photo) await c.query('INSERT INTO photos (id, bytes) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET bytes = $2', [photoName(r.id), photo]);
			await this.savePurchase(c, {...r, hasPhoto: !!photo});
		});
	}

	async getPurchase(id: string) {
		const r = await this.query<{data: PurchaseRecord}>('SELECT data FROM purchases WHERE id = $1', [id]);
		return r.rows[0]?.data ?? null;
	}

	updatePurchase(id: string, fn: (r: PurchaseRecord) => void) {
		return this.tx(async (c) => {
			const r = await c.query<{data: PurchaseRecord}>('SELECT data FROM purchases WHERE id = $1 FOR UPDATE', [id]);
			const rec = r.rows[0]?.data;
			if (!rec) return null;
			fn(rec);
			await this.savePurchase(c, rec);
			return {...rec};
		});
	}

	async readPhoto(id: string) {
		const r = await this.query<{bytes: Buffer}>('SELECT bytes FROM photos WHERE id = $1', [photoName(id)]);
		return r.rows[0]?.bytes ?? null;
	}

	async recordEvent(key: string) {
		const r = await this.query('INSERT INTO webhook_events (key, at) VALUES ($1,$2) ON CONFLICT DO NOTHING', [key, Date.now()]);
		return r.rowCount === 1;
	}

	purgeExpired(now: number, unpaidTtlMs: number) {
		return this.tx(async (c) => {
			const old = await c.query<{id: string}>('DELETE FROM purchases WHERE paid_at IS NULL AND created_at + $2 <= $1 RETURNING id', [now, unpaidTtlMs]);
			const ids = old.rows.map((r) => photoName(r.id));
			const exp = await c.query<{data: PurchaseRecord}>('SELECT data FROM purchases WHERE paid_at IS NOT NULL AND expires_at <= $1 AND purged IS NULL FOR UPDATE', [now]);
			for (const {data: r} of exp.rows) {
				// se conserva solo el registro de la venta (sin datos personales)
				ids.push(photoName(r.id));
				delete r.snapshot;
				r.hasPhoto = false;
				r.purged = now;
				await this.savePurchase(c, r);
			}
			if (ids.length) await c.query('DELETE FROM photos WHERE id = ANY($1)', [ids]);
			return old.rowCount! + exp.rows.length;
		});
	}

	async listPurchases(limit: number) {
		const r = await this.query<{data: PurchaseRecord}>('SELECT data FROM purchases ORDER BY created_at DESC LIMIT $1', [limit]);
		return r.rows.map((x) => x.data);
	}

	// ---- canjes gratis ----
	private saveClaim(c: Pick<PoolClient, 'query'>, k: ClaimRecord) {
		return c.query(
			`INSERT INTO claims (id, created_at, decided_at, purged, url, contact, status, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
			 ON CONFLICT (id) DO UPDATE SET decided_at = $3, purged = $4, url = $5, contact = $6, status = $7, data = $8`,
			[k.id, k.createdAt, k.decidedAt ?? null, k.purged ?? null, k.url, k.contact, k.status, JSON.stringify(k)]
		);
	}

	async createClaim(k: ClaimRecord): Promise<undefined> {
		await this.tx((c) => this.saveClaim(c, k));
	}

	async getClaim(id: string) {
		const r = await this.query<{data: ClaimRecord}>('SELECT data FROM claims WHERE id = $1', [id]);
		return r.rows[0]?.data ?? null;
	}

	async listClaims(limit: number) {
		const r = await this.query<{data: ClaimRecord}>('SELECT data FROM claims ORDER BY created_at DESC LIMIT $1', [limit]);
		return r.rows.map((x) => x.data);
	}

	updateClaim(id: string, fn: (c: ClaimRecord) => void) {
		return this.tx(async (c) => {
			const r = await c.query<{data: ClaimRecord}>('SELECT data FROM claims WHERE id = $1 FOR UPDATE', [id]);
			const rec = r.rows[0]?.data;
			if (!rec) return null;
			fn(rec);
			await this.saveClaim(c, rec);
			return {...rec};
		});
	}

	/** Registra el canje de forma atómica: devuelve el motivo si el enlace o el contacto ya se usaron. */
	submitClaim(k: ClaimRecord, contactSinceMs: number): Promise<'duplicate_url' | 'duplicate_contact' | null> {
		return this.tx(async (c) => {
			await c.query('SELECT pg_advisory_xact_lock(7001)');
			const url = await c.query("SELECT 1 FROM claims WHERE url = $1 AND status <> 'rejected' LIMIT 1", [k.url]);
			if (url.rowCount) return 'duplicate_url' as const;
			const contact = await c.query("SELECT 1 FROM claims WHERE contact = $1 AND status <> 'rejected' AND created_at >= $2 LIMIT 1", [k.contact, contactSinceMs]);
			if (contact.rowCount) return 'duplicate_contact' as const;
			await this.saveClaim(c, k);
			return null;
		});
	}

	/** borra el email/WhatsApp de los canjes ya resueltos hace más de `olderThanMs` */
	purgeClaimContacts(now: number, olderThanMs: number) {
		return this.tx(async (c) => {
			const r = await c.query<{data: ClaimRecord}>(
				"SELECT data FROM claims WHERE status <> 'pending' AND purged IS NULL AND COALESCE(decided_at, created_at) + $2 <= $1 FOR UPDATE",
				[now, olderThanMs]
			);
			for (const {data: k} of r.rows) {
				k.contact = '';
				k.purged = now;
				await this.saveClaim(c, k);
			}
			return r.rows.length;
		});
	}

	// ---- ajustes ----
	async getSettings(): Promise<SiteSettings> {
		const r = await this.query<{data: unknown}>("SELECT data FROM kv WHERE key = 'settings'");
		// base vacía: se parte de la configuración inicial del sitio hasta que se guarde algo desde el admin
		return r.rows[0] ? normalizeSettings(r.rows[0].data) : SEED_SETTINGS;
	}

	async saveSettings(raw: unknown): Promise<SiteSettings> {
		const s = normalizeSettings(raw);
		await this.query("INSERT INTO kv (key, data) VALUES ('settings', $1) ON CONFLICT (key) DO UPDATE SET data = $1", [JSON.stringify(s)]);
		return s;
	}

	// ---- videos compilados ----
	async listCompiled(): Promise<CompiledSpec[]> {
		const r = await this.query<{data: CompiledSpec}>('SELECT data FROM compiled ORDER BY created_at ASC');
		return r.rows.map((x) => x.data);
	}

	async getCompiled(id: string): Promise<CompiledSpec | null> {
		const r = await this.query<{data: CompiledSpec}>('SELECT data FROM compiled WHERE id = $1', [id]);
		return r.rows[0]?.data ?? null;
	}

	saveCompiled(raw: unknown): Promise<CompiledSpec | null> {
		return this.tx(async (c) => {
			const id = (raw as {id?: string} | null)?.id;
			const prev = id ? (await c.query<{data: CompiledSpec}>('SELECT data FROM compiled WHERE id = $1 FOR UPDATE', [id])).rows[0]?.data : undefined;
			const spec = normalizeSpec(raw, prev);
			if (!spec) return null;
			await c.query(
				'INSERT INTO compiled (id, created_at, data) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET data = $3',
				[spec.id, spec.createdAt, JSON.stringify(spec)]
			);
			return spec;
		});
	}

	async deleteCompiled(id: string) {
		const r = await this.query('DELETE FROM compiled WHERE id = $1', [id]);
		return (r.rowCount ?? 0) > 0;
	}

	// ---- medios ----
	async putMedia(meta: Omit<MediaMeta, 'createdAt'>, buf: Buffer) {
		const blob = await put(`media/${meta.id}`, buf, {access: 'private', contentType: meta.mime, addRandomSuffix: false, allowOverwrite: true, token: blobToken()});
		const full: MediaMeta = {...meta, createdAt: Date.now()};
		await this.query('INSERT INTO media (id, created_at, pathname, meta) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET pathname = $3, meta = $4', [
			full.id,
			full.createdAt,
			blob.pathname,
			JSON.stringify(full),
		]);
		return full;
	}

	async getMediaMeta(id: string) {
		const r = await this.query<{meta: MediaMeta}>('SELECT meta FROM media WHERE id = $1', [id]);
		return r.rows[0]?.meta ?? null;
	}

	async listMedia() {
		const r = await this.query<{meta: MediaMeta}>('SELECT meta FROM media ORDER BY created_at DESC');
		return r.rows.map((x) => x.meta);
	}

	async deleteMedia(id: string) {
		const r = await this.query<{pathname: string}>('DELETE FROM media WHERE id = $1 RETURNING pathname', [id]);
		if (!r.rows[0]) return false;
		await del(r.rows[0].pathname, {token: blobToken()}).catch(() => undefined);
		return true;
	}

	/** Sirve el medio desde Blob (privado, se lee con el token del servidor) pasando el pedido de rango. */
	async serveMedia(id: string, rangeHeader: string | null): Promise<ServedMedia | null> {
		const r = await this.query<{pathname: string; meta: MediaMeta}>('SELECT pathname, meta FROM media WHERE id = $1', [id]);
		const row = r.rows[0];
		if (!row) return null;
		const blob = await get(row.pathname, {access: 'private', token: blobToken(), headers: rangeHeader ? {Range: rangeHeader} : undefined});
		if (!blob || blob.statusCode !== 200) return null;
		const headers: Record<string, string> = {...MEDIA_HEADERS, 'Content-Type': row.meta.mime};
		const contentRange = blob.headers.get('content-range');
		const length = blob.headers.get('content-length');
		if (contentRange) headers['Content-Range'] = contentRange;
		headers['Content-Length'] = length ?? String(blob.blob.size);
		return {status: contentRange ? 206 : 200, headers, body: blob.stream};
	}

	// ---- uso de espacio (panel del admin) ----
	async measureUsage(): Promise<UsageNow> {
		const [db, tables, photos, media, purchases] = await Promise.all([
			this.query<{n: string}>('SELECT pg_database_size(current_database()) AS n'),
			this.query<{name: string; bytes: string}>(
				"SELECT c.relname AS name, pg_total_relation_size(c.oid) AS bytes FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname = 'public' ORDER BY bytes DESC"
			),
			this.query<{n: string}>('SELECT COALESCE(SUM(octet_length(bytes)), 0) AS n FROM photos'),
			this.query<{n: string; c: string}>("SELECT COALESCE(SUM((meta->>'bytes')::bigint), 0) AS n, COUNT(*) AS c FROM media"),
			this.query<{c: string}>('SELECT COUNT(*) AS c FROM purchases'),
		]);
		return {
			dbBytes: Number(db.rows[0].n),
			blobBytes: Number(media.rows[0].n),
			photoBytes: Number(photos.rows[0].n),
			purchases: Number(purchases.rows[0].c),
			media: Number(media.rows[0].c),
			tables: tables.rows.map((t) => ({name: t.name, bytes: Number(t.bytes)})),
		};
	}

	/** Guarda (o reemplaza) el registro de uso de ese día. */
	async recordUsage(day: string, u: UsageNow): Promise<void> {
		await this.query(
			`INSERT INTO usage_daily (day, db_bytes, blob_bytes, photo_bytes, purchases, media) VALUES ($1,$2,$3,$4,$5,$6)
			 ON CONFLICT (day) DO UPDATE SET db_bytes = $2, blob_bytes = $3, photo_bytes = $4, purchases = $5, media = $6`,
			[day, u.dbBytes, u.blobBytes, u.photoBytes, u.purchases, u.media]
		);
	}

	async readUsage(): Promise<UsageSnapshot[]> {
		const r = await this.query<{day: string; db_bytes: string; blob_bytes: string; photo_bytes: string; purchases: number; media: number}>(
			'SELECT * FROM usage_daily ORDER BY day DESC LIMIT 400'
		);
		return r.rows
			.map((x) => ({day: x.day, dbBytes: Number(x.db_bytes), blobBytes: Number(x.blob_bytes), photoBytes: Number(x.photo_bytes), purchases: x.purchases, media: x.media}))
			.reverse();
	}

	// ---- analítica propia (solo contadores, sin datos personales) ----
	async trackEvent(day: string, name: string, templateId?: string) {
		const names = templateId ? [name, `${name}|${templateId}`] : [name];
		await this.query(
			'INSERT INTO events (day, name, n) SELECT $1, unnest($2::text[]), 1 ON CONFLICT (day, name) DO UPDATE SET n = events.n + 1',
			[day, names]
		);
	}

	async readEvents(): Promise<Record<string, Record<string, number>>> {
		const r = await this.query<{day: string; name: string; n: string}>('SELECT day, name, n FROM events');
		const out: Record<string, Record<string, number>> = {};
		for (const {day, name, n} of r.rows) (out[day] ??= {})[name] = Number(n);
		return out;
	}
}
