import {createMemoryDb, getDb, type ClaimRecord, type Db, type MediaMeta, type PurchaseRecord} from './db.ts';
import {DEFAULT_SETTINGS, normalizeSettings, type SiteSettings} from '../config/site.ts';
import {normalizeSpec, type CompiledSpec} from '../templates/compiled-types.ts';

// Acceso a los datos. La FUENTE DE VERDAD del pago sigue siendo la API de
// Mercado Pago; acá se guarda la compra (qué se compró, límites, vencimiento),
// los datos del cliente hasta que vencen, contadores de analítica y la
// configuración del sitio.

export interface PurchaseStore {
	createPurchase(r: PurchaseRecord, photo?: Buffer): Promise<void>;
	getPurchase(id: string): Promise<PurchaseRecord | null>;
	/** aplica `fn` al registro y lo guarda; null si no existe */
	updatePurchase(id: string, fn: (r: PurchaseRecord) => void): Promise<PurchaseRecord | null>;
	readPhoto(id: string): Promise<Buffer | null>;
	/** true si es la primera vez que se ve esta clave (evento de webhook nuevo) */
	recordEvent(key: string): Promise<boolean>;
	/** borra datos personales vencidos y compras impagas viejas; devuelve cuántas tocó */
	purgeExpired(now: number, unpaidTtlMs: number): Promise<number>;
	listPurchases(limit: number): Promise<PurchaseRecord[]>;
}

const photoName = (id: string) => `photo-${id}.jpg`;

export class DbStore implements PurchaseStore {
	readonly db: Db;

	constructor(db: Db = getDb()) {
		this.db = db;
	}

	async createPurchase(r: PurchaseRecord, photo?: Buffer) {
		if (photo) await this.db.writeFile(photoName(r.id), photo);
		await this.db.tx((d) => {
			d.purchases[r.id] = {...r, hasPhoto: !!photo};
		});
	}

	getPurchase(id: string) {
		return this.db.tx((d) => d.purchases[id] ?? null, {readOnly: true});
	}

	updatePurchase(id: string, fn: (r: PurchaseRecord) => void) {
		return this.db.tx((d) => {
			const r = d.purchases[id];
			if (!r) return null;
			fn(r);
			return {...r};
		});
	}

	readPhoto(id: string) {
		return this.db.readFile(photoName(id));
	}

	recordEvent(key: string) {
		return this.db.tx((d) => {
			if (key in d.webhookEvents) return false;
			d.webhookEvents[key] = Date.now();
			return true;
		});
	}

	async purgeExpired(now: number, unpaidTtlMs: number) {
		const photos: string[] = [];
		const n = await this.db.tx((d) => {
			let count = 0;
			for (const r of Object.values(d.purchases)) {
				const unpaidOld = !r.paidAt && r.createdAt + unpaidTtlMs <= now;
				const paidExpired = !!r.paidAt && r.expiresAt <= now;
				if (unpaidOld) {
					if (r.hasPhoto) photos.push(r.id);
					delete d.purchases[r.id];
					count++;
				} else if (paidExpired && !r.purged) {
					// se conserva solo el registro de la venta (sin datos personales)
					if (r.hasPhoto) photos.push(r.id);
					delete r.snapshot;
					r.hasPhoto = false;
					r.purged = now;
					count++;
				}
			}
			return count;
		});
		for (const id of photos) await this.db.deleteFile(photoName(id));
		return n;
	}

	listPurchases(limit: number) {
		return this.db.tx(
			(d) =>
				Object.values(d.purchases)
					.sort((a, b) => b.createdAt - a.createdAt)
					.slice(0, limit)
					.map((r) => ({...r})),
			{readOnly: true}
		);
	}

	// ---- canjes gratis ----
	createClaim(c: ClaimRecord) {
		return this.db.tx((d) => void (d.claims[c.id] = c));
	}

	getClaim(id: string) {
		return this.db.tx((d) => (d.claims[id] ? {...d.claims[id]} : null), {readOnly: true});
	}

	listClaims(limit: number) {
		return this.db.tx((d) => Object.values(d.claims).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map((c) => ({...c})), {readOnly: true});
	}

	/** aplica `fn` al canje y lo guarda; null si no existe */
	updateClaim(id: string, fn: (c: ClaimRecord) => void) {
		return this.db.tx((d) => {
			const c = d.claims[id];
			if (!c) return null;
			fn(c);
			return {...c};
		});
	}

	/** Registra el canje de forma atómica: devuelve el motivo si el enlace o el contacto ya se usaron. */
	submitClaim(c: ClaimRecord, contactSinceMs: number): Promise<'duplicate_url' | 'duplicate_contact' | null> {
		return this.db.tx((d) => {
			for (const o of Object.values(d.claims)) {
				if (o.url === c.url && o.status !== 'rejected') return 'duplicate_url' as const;
				if (o.contact === c.contact && o.status !== 'rejected' && o.createdAt >= contactSinceMs) return 'duplicate_contact' as const;
			}
			d.claims[c.id] = c;
			return null;
		});
	}

	/** borra el email/WhatsApp de los canjes ya resueltos hace más de `olderThanMs` */
	purgeClaimContacts(now: number, olderThanMs: number) {
		return this.db.tx((d) => {
			let n = 0;
			for (const c of Object.values(d.claims)) {
				if (c.status !== 'pending' && !c.purged && (c.decidedAt ?? c.createdAt) + olderThanMs <= now) {
					c.contact = '';
					c.purged = now;
					n++;
				}
			}
			return n;
		});
	}

	// ---- ajustes ----
	getSettings(): Promise<SiteSettings> {
		return this.db.tx((d) => (d.settings ? normalizeSettings(d.settings) : DEFAULT_SETTINGS), {readOnly: true});
	}

	saveSettings(raw: unknown): Promise<SiteSettings> {
		return this.db.tx((d) => {
			d.settings = normalizeSettings(raw);
			return d.settings;
		});
	}

	// ---- videos compilados ----
	listCompiled(): Promise<CompiledSpec[]> {
		return this.db.tx((d) => Object.values(d.compiled).sort((a, b) => a.createdAt - b.createdAt), {readOnly: true});
	}

	getCompiled(id: string): Promise<CompiledSpec | null> {
		return this.db.tx((d) => d.compiled[id] ?? null, {readOnly: true});
	}

	saveCompiled(raw: unknown): Promise<CompiledSpec | null> {
		return this.db.tx((d) => {
			const id = (raw as {id?: string} | null)?.id;
			const spec = normalizeSpec(raw, id ? d.compiled[id] : undefined);
			if (!spec) return null;
			d.compiled[spec.id] = spec;
			return spec;
		});
	}

	deleteCompiled(id: string) {
		return this.db.tx((d) => {
			const had = id in d.compiled;
			delete d.compiled[id];
			return had;
		});
	}

	// ---- medios ----
	async putMedia(meta: Omit<MediaMeta, 'createdAt'>, buf: Buffer) {
		await this.db.writeFile(`media-${meta.id}`, buf);
		return this.db.tx((d) => {
			d.media[meta.id] = {...meta, createdAt: Date.now()};
			return d.media[meta.id];
		});
	}

	getMediaMeta(id: string) {
		return this.db.tx((d) => d.media[id] ?? null, {readOnly: true});
	}

	listMedia() {
		return this.db.tx((d) => Object.values(d.media).sort((a, b) => b.createdAt - a.createdAt), {readOnly: true});
	}

	async deleteMedia(id: string) {
		const had = await this.db.tx((d) => {
			const h = id in d.media;
			delete d.media[id];
			return h;
		});
		await this.db.deleteFile(`media-${id}`);
		return had;
	}

	// ---- analítica propia (solo contadores, sin datos personales) ----
	trackEvent(day: string, name: string, templateId?: string) {
		return this.db.tx(
			(d) => {
				const m = (d.events[day] ??= {});
				m[name] = (m[name] ?? 0) + 1;
				if (templateId) {
					const k = `${name}|${templateId}`;
					m[k] = (m[k] ?? 0) + 1;
				}
			},
			{defer: true}
		);
	}

	readEvents(): Promise<Record<string, Record<string, number>>> {
		return this.db.tx((d) => d.events, {readOnly: true});
	}
}

let shared: DbStore | null = null;
export function getStore() {
	shared ??= new DbStore();
	return shared;
}

export function createMemoryStore() {
	return new DbStore(createMemoryDb());
}
