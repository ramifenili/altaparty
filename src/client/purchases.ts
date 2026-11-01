// Cliente HTTP de las compras. Nunca recibe ni guarda credenciales de Mercado Pago.

import type {TemplateId} from '../templates/types';

export type PurchaseStatus =
	| 'unpaid'
	| 'pending'
	| 'approved'
	| 'rejected'
	| 'cancelled'
	| 'refunded'
	| 'mismatch'
	| 'expired';

export type PurchaseInfo = {
	/** qué incluye la compra */
	product: import('../config/pricing').Product;
	/** compra de imagen: código de la compra del video que se agregó (y pagó) con descuento */
	videoPurchaseId: string | null;
	/** compra de video: código de la compra de la imagen que se agregó (y pagó) con descuento */
	imagePurchaseId: string | null;
	purchaseId: string;
	templateId: TemplateId;
	status: PurchaseStatus;
	delivered: boolean;
	/** generaciones finales que quedan con esta compra */
	remaining: number;
	/** pagos simulados (solo entorno local) */
	testMode: boolean;
	/** fin del período de descarga (ms); null si todavía no se pagó */
	expiresAt: number | null;
	/** el servidor guarda los datos comprados: se muestran de solo lectura */
	hasSnapshot: boolean;
};

export type PurchaseSnapshot = {
	purchaseId: string;
	snapshot: {data: import('../domain/invitation').InvitationData; audio: {kind: 'default' | 'mute' | 'library' | 'custom'; id?: string}} | null;
	photo: string | null;
	expiresAt: number | null;
};

export type SnapshotInput = {
	data: import('../domain/invitation').InvitationData;
	audio: {kind: 'default' | 'mute' | 'library' | 'custom'; id?: string};
	photo: string | null;
};

export type FinalAuthorization = {
	kind?: 'video' | 'image';
	purchaseId: string;
	templateId: TemplateId;
	token: string;
	expiresAt: number;
	remaining?: number;
};

export class ApiError extends Error {
	constructor(message: string, readonly code: string, readonly http: number) {
		super(message);
	}
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(url, {...init, cache: 'no-store', headers: {'Content-Type': 'application/json'}});
	} catch {
		throw new ApiError('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.', 'network', 0);
	}
	const data = (await res.json().catch(() => ({}))) as {error?: string; message?: string};
	if (!res.ok) throw new ApiError(data.message ?? 'Ocurrió un error inesperado.', data.error ?? 'unknown', res.status);
	return data as T;
}

export const createPurchase = (templateId: TemplateId, snapshot?: SnapshotInput, product: import('../config/pricing').Product = 'video', upgradeFrom?: string) =>
	call<{purchaseId: string; checkoutUrl: string}>('/api/purchases', {method: 'POST', body: JSON.stringify({templateId, snapshot, product, upgradeFrom})});

export const fetchSnapshot = (purchaseId: string) =>
	call<PurchaseSnapshot>(`/api/purchases/${encodeURIComponent(purchaseId)}/snapshot`);

export const fetchPurchase = (purchaseId: string) =>
	call<PurchaseInfo>(`/api/purchases/${encodeURIComponent(purchaseId)}`);

export const requestFinalAuthorization = (purchaseId: string, kind: 'video' | 'image' = 'video') =>
	call<FinalAuthorization>(`/api/purchases/${encodeURIComponent(purchaseId)}/authorize`, {method: 'POST', body: JSON.stringify({kind})});

export const verifyAuthorizationWithServer = async (a: FinalAuthorization) => {
	await call('/api/authorization/verify', {method: 'POST', body: JSON.stringify({token: a.token})});
};

export const markDelivered = (a: FinalAuthorization) =>
	call(`/api/purchases/${encodeURIComponent(a.purchaseId)}/delivered`, {method: 'POST', body: JSON.stringify({token: a.token})});
