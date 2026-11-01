import type {SiteSettings} from '../config/site';
import type {CompiledSpec} from '../templates/compiled-types';
import type {Stats} from '../server/stats';
import type {UsageReport} from '../server/usage';
import type {ClaimRecord, MediaMeta} from '../server/db';

export class AdminApiError extends Error {
	constructor(message: string, readonly http: number) {
		super(message);
	}
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(url, {cache: 'no-store', ...init, headers: init?.body instanceof FormData ? undefined : {'Content-Type': 'application/json'}});
	} catch {
		throw new AdminApiError('Sin conexión con el servidor.', 0);
	}
	const data = (await res.json().catch(() => ({}))) as {message?: string};
	if (!res.ok) throw new AdminApiError(data.message ?? `Error ${res.status}`, res.status);
	return data as T;
}

export const adminApi = {
	me: () => call<{ok: true; testMode: boolean}>('/api/admin/me'),
	login: (password: string) => call<{ok: true}>('/api/admin/login', {method: 'POST', body: JSON.stringify({password})}),
	logout: () => call<{ok: true}>('/api/admin/logout', {method: 'POST'}),
	listClaims: () => call<ClaimRecord[]>('/api/admin/claims'),
	decideClaim: (id: string, action: 'approve' | 'reject', note?: string) => call<ClaimRecord>(`/api/admin/claims/${id}`, {method: 'POST', body: JSON.stringify({action, note})}),
	stats: (days: number) => call<Stats>(`/api/admin/stats?days=${days}`),
	usage: () => call<UsageReport>('/api/admin/usage'),
	getSettings: () => call<SiteSettings>('/api/admin/settings'),
	saveSettings: (s: SiteSettings) => call<SiteSettings>('/api/admin/settings', {method: 'PUT', body: JSON.stringify(s)}),
	listCompiled: () => call<CompiledSpec[]>('/api/admin/compiled'),
	saveCompiled: (s: unknown) => call<CompiledSpec>('/api/admin/compiled', {method: 'POST', body: JSON.stringify(s)}),
	deleteCompiled: (id: string) => call<{deleted: boolean}>(`/api/admin/compiled/${id}`, {method: 'DELETE'}),
	listMedia: () => call<MediaMeta[]>('/api/admin/media'),
	uploadMedia: (file: File | Blob, name?: string) => {
		const f = new FormData();
		f.append('file', file instanceof File ? file : new File([file], name ?? 'archivo'));
		return call<MediaMeta>('/api/admin/media', {method: 'POST', body: f});
	},
	deleteMedia: (id: string) => call<{deleted: boolean}>(`/api/admin/media/${id}`, {method: 'DELETE'}),
};
