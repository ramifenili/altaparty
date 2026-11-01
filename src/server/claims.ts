import {randomUUID} from 'node:crypto';
import {getNetwork, GRATIS, normalizeContact, parsePostUrl, type ClaimView} from '../config/gratis.ts';
import type {ClaimRecord} from './db.ts';
import type {DbStore} from './store.ts';

export class ClaimError extends Error {
	readonly code: 'invalid' | 'duplicate' | 'not_found' | 'unavailable';
	readonly http: number;
	constructor(message: string, code: ClaimError['code'], http = 400) {
		super(message);
		this.name = 'ClaimError';
		this.code = code;
		this.http = http;
	}
}

const DAY = 24 * 60 * 60 * 1000;
const CLAIM_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** el contacto (email/WhatsApp) se conserva 90 días después de resolver el canje */
const CONTACT_TTL_MS = 90 * DAY;

export type ClaimService = ReturnType<typeof createClaimService>;

export function createClaimService(deps: {
	store: Pick<DbStore, 'submitClaim' | 'getClaim' | 'listClaims' | 'updateClaim' | 'purgeClaimContacts'>;
	/** habilita el video sin cobrar y devuelve el código de compra */
	grant: (templateId: string, claimId: string) => Promise<string>;
	isTemplateAvailable: (id: string) => Promise<boolean>;
	now?: () => number;
}) {
	const now = deps.now ?? (() => Date.now());

	const view = (c: ClaimRecord): ClaimView => ({
		claimId: c.id,
		status: c.status,
		network: c.network,
		templateId: c.templateId,
		createdAt: c.createdAt,
		purchaseId: c.status === 'approved' ? c.purchaseId : undefined,
		note: c.status === 'rejected' ? c.note : undefined,
	});

	return {
		/** Registra el pedido. Nada se aprueba solo: lo revisa una persona. */
		async submit(input: {network?: unknown; url?: unknown; contact?: unknown; templateId?: unknown; views?: unknown}) {
			const net = getNetwork(input.network);
			if (!net) throw new ClaimError('Elegí la red social donde publicaste.', 'invalid');
			const url = parsePostUrl(input.url, net.id);
			if (!url) throw new ClaimError(`Pegá el enlace de tu publicación de ${net.name} (no el de tu perfil).`, 'invalid');
			const contact = normalizeContact(input.contact);
			if (!contact) throw new ClaimError('Escribí un email o un WhatsApp válido para avisarte.', 'invalid');
			if (typeof input.templateId !== 'string' || !(await deps.isTemplateAvailable(input.templateId))) {
				throw new ClaimError('Elegí el diseño que querés recibir.', 'invalid');
			}
			const views = Math.floor(Number(input.views));
			if (!Number.isFinite(views) || views < 0 || views > 1e9) throw new ClaimError('Indicá cuántas vistas tiene tu publicación.', 'invalid');
			if (views < net.threshold) {
				throw new ClaimError(`En ${net.name} hace falta que una publicación llegue a ${net.threshold.toLocaleString('es-AR')} vistas. ¡Volvé cuando la alcance!`, 'invalid');
			}
			const t = now();
			const rec: ClaimRecord = {id: randomUUID(), createdAt: t, network: net.id, url, contact, templateId: input.templateId, views, status: 'pending'};
			const dup = await deps.store.submitClaim(rec, t - GRATIS.perContactDays * DAY);
			if (dup === 'duplicate_url') throw new ClaimError('Ese enlace ya fue enviado.', 'duplicate', 409);
			if (dup === 'duplicate_contact') {
				throw new ClaimError(`Con ese email/WhatsApp ya hay un canje en curso o aprobado. Se puede uno cada ${GRATIS.perContactDays} días.`, 'duplicate', 409);
			}
			return view(rec);
		},

		/** Estado para quien lo pidió: el id (UUID aleatorio) es el comprobante. */
		async status(idRaw: unknown) {
			if (typeof idRaw !== 'string' || !CLAIM_ID_RE.test(idRaw)) throw new ClaimError('El código de seguimiento no es válido.', 'invalid');
			const c = await deps.store.getClaim(idRaw);
			if (!c) throw new ClaimError('No encontramos ese canje.', 'not_found', 404);
			return view(c);
		},

		list(limit = 200) {
			return deps.store.listClaims(limit);
		},

		/** Decisión del administrador. Aprobar crea el código gratis una sola vez (idempotente). */
		async decide(idRaw: unknown, action: unknown, note?: unknown) {
			if (typeof idRaw !== 'string' || !CLAIM_ID_RE.test(idRaw)) throw new ClaimError('Canje inválido.', 'invalid');
			if (action !== 'approve' && action !== 'reject') throw new ClaimError('Acción inválida.', 'invalid');
			const c = await deps.store.getClaim(idRaw);
			if (!c) throw new ClaimError('No encontramos ese canje.', 'not_found', 404);
			if (c.status !== 'pending') return c;
			const text = typeof note === 'string' ? note.trim().slice(0, 200) : '';
			let purchaseId: string | undefined;
			if (action === 'approve') purchaseId = await deps.grant(c.templateId, c.id);
			return (await deps.store.updateClaim(c.id, (r) => {
				if (r.status !== 'pending') return;
				r.status = action === 'approve' ? 'approved' : 'rejected';
				r.decidedAt = now();
				if (text) r.note = text;
				if (purchaseId) r.purchaseId = purchaseId;
			}))!;
		},

		purge() {
			return deps.store.purgeClaimContacts(now(), CONTACT_TTL_MS);
		},
	};
}
