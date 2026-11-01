import fs from 'node:fs';
import path from 'node:path';
import type {ClaimStatus, NetworkId} from '../config/gratis.ts';
import type {InvitationData} from '../domain/invitation.ts';
import type {SiteSettings} from '../config/site.ts';
import type {CompiledSpec} from '../templates/compiled-types.ts';

// Persistencia del servidor: un archivo JSON (.data/db.json) y una carpeta de
// medios (.data/media). Simple y gratuito; requiere un DISCO PERSISTENTE (VPS,
// Railway/Render con volumen). En hosting serverless sin disco hay que migrar
// esto a una base/KV y a un almacenamiento de objetos (p. ej. Cloudflare R2).
// Asume UN solo proceso de servidor.

export type SnapshotAudio = {kind: 'default' | 'mute' | 'library' | 'custom'; id?: string};

/** Lo que el cliente compró: se muestra de solo lectura y se borra al vencer. */
export type Snapshot = {data: InvitationData; audio: SnapshotAudio};

export type PurchaseRecord = {
	id: string;
	templateId: string;
	createdAt: number;
	/** importe que se cobró (se verifica contra el pago) */
	amount: number;
	currency: string;
	paidAt?: number;
	/** fin del período de descarga; después se borran los datos personales */
	expiresAt: number;
	authorizations: number;
	maxRenders: number;
	/** qué compró: el video, la imagen o las dos cosas (sin dato: el video) */
	product?: 'video' | 'image' | 'both';
	/** compra de imagen: la compra del video que se le agregó con descuento */
	upgradedTo?: string;
	/** compra de video que se agregó a una compra de imagen */
	upgradeOf?: string;
	deliveredAt?: number;
	refundedAt?: number;
	testMode: boolean;
	/** cuándo se borraron los datos personales */
	purged?: number;
	snapshot?: Snapshot;
	hasPhoto?: boolean;
	/** canje gratis (programa de difusión): no hay pago, el importe es 0 */
	free?: boolean;
	claimId?: string;
};

/** Pedido de video gratis a cambio de un posteo público. Lo revisa una persona. */
export type ClaimRecord = {
	id: string;
	createdAt: number;
	network: NetworkId;
	/** enlace normalizado */
	url: string;
	/** email o wa:<dígitos> */
	contact: string;
	templateId: string;
	/** vistas que declaró la persona (el admin las comprueba abriendo el enlace) */
	views: number;
	status: ClaimStatus;
	decidedAt?: number;
	note?: string;
	purchaseId?: string;
	/** cuándo se borró el contacto */
	purged?: number;
};

export type MediaMeta = {
	id: string;
	kind: 'video' | 'image' | 'audio' | 'font';
	mime: string;
	bytes: number;
	name: string;
	createdAt: number;
};

type DbShape = {
	version: 1;
	settings: SiteSettings | null;
	purchases: Record<string, PurchaseRecord>;
	/** contadores por día: events[YYYY-MM-DD]["evento"] y ["evento|plantilla"] */
	events: Record<string, Record<string, number>>;
	webhookEvents: Record<string, number>;
	compiled: Record<string, CompiledSpec>;
	media: Record<string, MediaMeta>;
	claims: Record<string, ClaimRecord>;
};

const empty = (): DbShape => ({version: 1, settings: null, purchases: {}, events: {}, webhookEvents: {}, compiled: {}, media: {}, claims: {}});

export class Db {
	private data: DbShape = empty();
	private loaded = false;
	private file: string | null;
	private mediaDir: string | null;
	private chain: Promise<unknown> = Promise.resolve();
	private timer: ReturnType<typeof setTimeout> | null = null;
	private memFiles = new Map<string, Buffer>();

	constructor(opts: {file: string | null; mediaDir: string | null}) {
		this.file = opts.file;
		this.mediaDir = opts.mediaDir;
	}

	private load() {
		if (this.loaded) return;
		this.loaded = true;
		if (!this.file) return;
		try {
			this.data = {...empty(), ...(JSON.parse(fs.readFileSync(this.file, 'utf8')) as Partial<DbShape>)};
		} catch {
			/* primer uso o archivo ilegible */
		}
	}

	private flush() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		if (!this.file) return;
		try {
			fs.mkdirSync(path.dirname(this.file), {recursive: true});
			const tmp = `${this.file}.tmp`;
			fs.writeFileSync(tmp, JSON.stringify(this.data));
			fs.renameSync(tmp, this.file);
		} catch (e) {
			console.error('[db] no se pudo guardar:', e);
		}
	}

	/** Ejecuta `fn` en serie sobre los datos; guarda enseguida (o con demora si `defer`). */
	tx<T>(fn: (d: DbShape) => T | Promise<T>, opts: {defer?: boolean; readOnly?: boolean} = {}): Promise<T> {
		const run = async () => {
			this.load();
			const out = await fn(this.data);
			if (!opts.readOnly) {
				if (opts.defer) this.timer ??= setTimeout(() => this.flush(), 2000);
				else this.flush();
			}
			return out;
		};
		const p = this.chain.then(run, run) as Promise<T>;
		this.chain = p.catch(() => undefined);
		return p;
	}

	// ---- archivos (medios y fotos de compra) ----
	private filePath(name: string) {
		return path.join(this.mediaDir as string, name);
	}

	async writeFile(name: string, buf: Buffer) {
		if (!this.mediaDir) {
			this.memFiles.set(name, buf);
			return;
		}
		fs.mkdirSync(this.mediaDir, {recursive: true});
		fs.writeFileSync(this.filePath(name), buf);
	}

	async readFile(name: string): Promise<Buffer | null> {
		if (!this.mediaDir) return this.memFiles.get(name) ?? null;
		try {
			return fs.readFileSync(this.filePath(name));
		} catch {
			return null;
		}
	}

	async deleteFile(name: string) {
		if (!this.mediaDir) {
			this.memFiles.delete(name);
			return;
		}
		try {
			fs.unlinkSync(this.filePath(name));
		} catch {
			/* ya no existía */
		}
	}

	fileSize(name: string): number | null {
		if (!this.mediaDir) return this.memFiles.get(name)?.length ?? null;
		try {
			return fs.statSync(this.filePath(name)).size;
		} catch {
			return null;
		}
	}

	/** Ruta absoluta del archivo (para servirlo con soporte de rangos). */
	absolutePath(name: string) {
		return this.mediaDir ? this.filePath(name) : null;
	}
}

const g = globalThis as unknown as {__inviteDb?: Db};

/** Instancia única (también entre recargas de desarrollo). */
export function getDb(): Db {
	g.__inviteDb ??= new Db({
		file: path.join(process.cwd(), '.data', 'db.json'),
		mediaDir: path.join(process.cwd(), '.data', 'media'),
	});
	return g.__inviteDb;
}

export function createMemoryDb() {
	return new Db({file: null, mediaDir: null});
}
