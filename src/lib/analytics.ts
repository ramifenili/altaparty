// Analítica. Hay dos capas:
//  1) Contadores propios (/api/events): solo cuentan eventos, sin cookies ni datos
//     personales. Alimentan el embudo del admin y no requieren consentimiento.
//  2) Google Analytics 4 y Microsoft Clarity: se cargan SOLO si el admin configuró
//     los IDs y el visitante aceptó el aviso de cookies.

export type AnalyticsIds = {gaId: string; clarityId: string};
export type Consent = 'granted' | 'denied' | 'unknown';

import type {EventName} from './events';
export {EVENTS, type EventName} from './events';

const CONSENT_KEY = 'analytics:consent';
let ids: AnalyticsIds = {gaId: '', clarityId: ''};
let loaded = {ga: false, clarity: false};
const listeners = new Set<() => void>();

export function getConsent(): Consent {
	try {
		const v = localStorage.getItem(CONSENT_KEY);
		return v === 'granted' || v === 'denied' ? v : 'unknown';
	} catch {
		return 'unknown';
	}
}

export function setConsent(v: 'granted' | 'denied') {
	try {
		localStorage.setItem(CONSENT_KEY, v);
	} catch {
		/* sin almacenamiento */
	}
	maybeLoad();
	listeners.forEach((l) => l());
}

export function subscribeConsent(l: () => void) {
	listeners.add(l);
	return () => void listeners.delete(l);
}

export function hasAnalyticsConfigured() {
	return !!(ids.gaId || ids.clarityId);
}

export function setAnalyticsIds(next: AnalyticsIds) {
	ids = next;
	maybeLoad();
	listeners.forEach((l) => l());
}

type W = Window & {dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; clarity?: (...a: unknown[]) => void};

function maybeLoad() {
	if (typeof window === 'undefined' || getConsent() !== 'granted') return;
	const w = window as W;
	if (ids.gaId && !loaded.ga) {
		loaded.ga = true;
		w.dataLayer = w.dataLayer || [];
		w.gtag = function gtag(...args: unknown[]) {
			w.dataLayer!.push(args);
		};
		w.gtag('js', new Date());
		w.gtag('config', ids.gaId, {anonymize_ip: true});
		const s = document.createElement('script');
		s.async = true;
		s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids.gaId)}`;
		document.head.appendChild(s);
	}
	if (ids.clarityId && !loaded.clarity) {
		loaded.clarity = true;
		w.clarity =
			w.clarity ||
			function (...args: unknown[]) {
				((w.clarity as unknown as {q?: unknown[]}).q = (w.clarity as unknown as {q?: unknown[]}).q || []).push(args);
			};
		const s = document.createElement('script');
		s.async = true;
		s.src = `https://www.clarity.ms/tag/${encodeURIComponent(ids.clarityId)}`;
		document.head.appendChild(s);
	}
}

/** Registra un evento (contador propio + GA4/Clarity si hay consentimiento). Nunca lanza. */
export function track(name: EventName, params: {templateId?: string; renderMs?: number; device?: 'mobile' | 'desktop'} = {}) {
	if (typeof window === 'undefined') return;
	try {
		if (name === 'page_view') {
			if (sessionStorage.getItem('pv')) return; // una vez por sesión
			sessionStorage.setItem('pv', '1');
		}
		void fetch('/api/events', {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({name, templateId: params.templateId}),
			keepalive: true,
		}).catch(() => undefined);
		if (getConsent() === 'granted') {
			const w = window as W;
			w.gtag?.('event', name, {template_id: params.templateId, ...(params.renderMs !== undefined && {render_ms: Math.round(params.renderMs)}), ...(params.device && {device_type: params.device})});
			w.clarity?.('event', name);
			if (params.templateId) w.clarity?.('set', 'template', params.templateId);
			if (params.device) w.clarity?.('set', 'device_type', params.device);
			if (params.renderMs !== undefined) w.clarity?.('set', 'preview_render_s', String(Math.round(params.renderMs / 1000)));
		}
	} catch {
		/* la analítica nunca debe romper la app */
	}
}
