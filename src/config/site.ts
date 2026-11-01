// Ajustes del sitio que edita el admin. Se guardan en el servidor; el público
// recibe solo la parte pública (PublicConfig) por /api/config.

import {PRICING} from './pricing.ts';
import {WATERMARK, type WatermarkConfig} from './watermark.ts';
import type {CompiledSpec} from '../templates/compiled-types.ts';
import {SLUG_RE, stripSiteSuffix, SITE_NAME, normalizeTags} from '../lib/seo.ts';

/** `name` y `category` (la etiqueta) pisan los de la plantilla; sin ellos se usan los originales. */
export type TemplateOverride = {enabled: boolean; order: number; slug?: string; seoTitle?: string; seoDescription?: string; name?: string; category?: string; tags?: string[]};

export type SiteSettings = {
	price: number;
	/** precio de la imagen sola y del combo video + imagen */
	imagePrice: number;
	bundlePrice: number;
	/** promos para quien ya compró el otro producto; 0 = automático */
	videoUpgrade: number;
	imageUpgrade: number;
	referencePrice: number;
	showReferencePrice: boolean;
	/** generaciones finales por compra */
	maxFinalRenders: number;
	/** días que se conservan los datos de una compra (y se puede volver a descargar) */
	retentionDays: number;
	templates: Record<string, TemplateOverride>;
	watermark: WatermarkConfig;
	analytics: {gaId: string; clarityId: string};
};

export const DEFAULT_SETTINGS: SiteSettings = {
	price: PRICING.price,
	imagePrice: PRICING.imagePrice,
	bundlePrice: PRICING.bundlePrice,
	videoUpgrade: 0,
	imageUpgrade: 0,
	referencePrice: PRICING.referencePrice,
	showReferencePrice: PRICING.showReferencePrice,
	maxFinalRenders: PRICING.maxFinalRenders,
	retentionDays: 30,
	templates: {},
	watermark: WATERMARK,
	analytics: {gaId: '', clarityId: ''},
};

const num = (v: unknown, min: number, max: number, d: number) => {
	const n = typeof v === 'number' && Number.isFinite(v) ? v : d;
	return Math.min(max, Math.max(min, n));
};
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const text = (v: unknown, max: number, d: string) => (typeof v === 'string' ? v.slice(0, max) : d);

/** Convierte lo que llegue (JSON del admin o del disco) en ajustes válidos y acotados. */
export function normalizeSettings(raw: unknown): SiteSettings {
	const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const d = DEFAULT_SETTINGS;
	const price = Math.round(num(r.price, 100, 1_000_000, d.price));
	const imagePrice = Math.round(num(r.imagePrice, 100, 1_000_000, d.imagePrice));
	const w = (r.watermark && typeof r.watermark === 'object' ? r.watermark : {}) as Record<string, unknown>;
	const wd = d.watermark;
	const imageSrc = text(w.imageSrc, 120, wd.imageSrc);
	const templates: SiteSettings['templates'] = {};
	const usedSlugs = new Set<string>();
	if (r.templates && typeof r.templates === 'object') {
		for (const [id, v] of Object.entries(r.templates as Record<string, unknown>).slice(0, 100)) {
			if (!/^[a-z0-9-]{2,40}$/.test(id) || !v || typeof v !== 'object') continue;
			const o = v as Record<string, unknown>;
			const ov: TemplateOverride = {enabled: bool(o.enabled, true), order: Math.round(num(o.order, 0, 999, 100))};
			const slug = text(o.slug, 60, '').trim().toLowerCase();
			// el slug debe ser válido y único entre todas las plantillas
			if (slug && SLUG_RE.test(slug) && !usedSlugs.has(slug)) {
				usedSlugs.add(slug);
				ov.slug = slug;
			}
			// el título se guarda sin el " | AltaParty" final: se agrega siempre al mostrarlo
			const st = stripSiteSuffix(text(o.seoTitle, 120, '').trim()).slice(0, 80 - SITE_NAME.length - 3).trim();
			const nm = text(o.name, 60, '').trim();
			const cat = text(o.category, 30, '').trim();
			if (nm) ov.name = nm;
			if (cat) ov.category = cat;
			const tags = normalizeTags(o.tags);
			if (tags.length) ov.tags = tags;
			const sd = text(o.seoDescription, 200, '').trim();
			if (st) ov.seoTitle = st;
			if (sd) ov.seoDescription = sd;
			templates[id] = ov;
		}
	}
	const an = (r.analytics && typeof r.analytics === 'object' ? r.analytics : {}) as Record<string, unknown>;
	const gaId = text(an.gaId, 20, '').trim();
	const clarityId = text(an.clarityId, 20, '').trim();
	return {
		price,
		imagePrice,
		bundlePrice: Math.round(num(r.bundlePrice, 100, 2_000_000, d.bundlePrice)),
		videoUpgrade: Math.min(price, Math.round(num(r.videoUpgrade, 0, 1_000_000, 0))),
		imageUpgrade: Math.min(imagePrice, Math.round(num(r.imageUpgrade, 0, 1_000_000, 0))),
		referencePrice: Math.round(num(r.referencePrice, price, 5_000_000, Math.max(price, d.referencePrice))),
		showReferencePrice: bool(r.showReferencePrice, d.showReferencePrice),
		maxFinalRenders: Math.round(num(r.maxFinalRenders, 1, 50, d.maxFinalRenders)),
		retentionDays: Math.round(num(r.retentionDays, 1, 365, d.retentionDays)),
		templates,
		watermark: {
			mode: w.mode === 'image' ? 'image' : 'text',
			text: text(w.text, 60, wd.text) || wd.text,
			// solo rutas propias: nunca una URL externa
			imageSrc: /^\/(api\/media\/[a-z0-9]{8,32}|watermark\/[\w.-]+)$/.test(imageSrc) ? imageSrc : wd.imageSrc,
			opacityPercent: Math.round(num(w.opacityPercent, 10, 100, wd.opacityPercent)),
			textSize: num(w.textSize, 14, 80, wd.textSize),
			imageWidth: num(w.imageWidth, 60, 600, wd.imageWidth),
			spacingX: num(w.spacingX, 200, 1200, wd.spacingX),
			spacingY: num(w.spacingY, 80, 600, wd.spacingY),
			angleDeg: num(w.angleDeg, -90, 90, wd.angleDeg),
			driftPerSecond: num(w.driftPerSecond, 0, 200, wd.driftPerSecond),
			centerStamp: bool(w.centerStamp, wd.centerStamp),
			centerStampTitle: text(w.centerStampTitle, 30, wd.centerStampTitle),
			centerStampSubtitle: text(w.centerStampSubtitle, 60, wd.centerStampSubtitle),
		},
		analytics: {
			gaId: /^G-[A-Z0-9]{4,14}$/.test(gaId) ? gaId : '',
			clarityId: /^[a-z0-9]{6,14}$/.test(clarityId) ? clarityId : '',
		},
	};
}

/** Lo que ve el público (sin datos internos). */
export type PublicConfig = {
	pricing: {price: number; imagePrice: number; bundlePrice: number; videoUpgrade: number; imageUpgrade: number; referencePrice: number; showReferencePrice: boolean; maxFinalRenders: number; retentionDays: number; currency: string};
	watermark: WatermarkConfig;
	templates: Record<string, TemplateOverride>;
	analytics: {gaId: string; clarityId: string};
	compiled: CompiledSpec[];
};
