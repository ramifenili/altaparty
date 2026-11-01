import {PRICING} from './pricing.ts';
import {WATERMARK} from './watermark.ts';
import {DEFAULT_SETTINGS, type SiteSettings} from './site.ts';

/**
 * Ajustes con los que arranca una base de producción vacía (todavía no se guardó nada desde el admin).
 * Reflejan lo configurado en desarrollo: precios, nombres, slugs y etiquetas de las plantillas, cuáles están
 * habilitadas, y la marca de agua. Al guardar desde el panel, lo guardado pisa estos valores.
 * No tienen datos privados: los IDs de Analytics quedan vacíos para cargarlos en el admin.
 */
export const SEED_SETTINGS: SiteSettings = {
	...DEFAULT_SETTINGS,
	price: 8500,
	imagePrice: 6000,
	bundlePrice: 9850,
	videoUpgrade: 7500,
	imageUpgrade: 5500,
	referencePrice: 12000,
	showReferencePrice: PRICING.showReferencePrice,
	maxFinalRenders: PRICING.maxFinalRenders,
	retentionDays: 30,
	templates: {
		campeones: {enabled: true, order: 0, slug: 'mundial-2022-argentina', name: 'Mundial 2022 Argentina', tags: ['messi', 'dibu']},
		spidey: {enabled: true, order: 10, tags: ['spider', 'spiderman', 'gwen', 'miles']},
		toystory: {
			enabled: true,
			order: 20,
			slug: 'toy-story',
			name: 'Toy Story',
			category: 'Juguetes',
			tags: ['woody', 'buzz', 'lightyear', 'jessie', 'rex', 'forky', 'cara', 'papa', 'slinky', 'forkie', 'andy', 'disney'],
		},
		sonic: {enabled: true, order: 30, tags: ['tails', 'knuckles', 'shadow', 'sega']},
		boca: {enabled: false, order: 40},
		camino: {enabled: false, order: 50},
		kpop: {enabled: false, order: 60},
		huntrx: {
			enabled: true,
			order: 70,
			slug: 'huntrix-cazadoras-kpop',
			name: 'Huntrix Cazadoras KPop',
			tags: ['huntrix', 'mira', 'zoey', 'rumi', 'demon', 'hunter', 'golden', 'kpop', 'netflix'],
		},
		arana: {enabled: false, order: 80},
		dinos: {enabled: false, order: 90},
		unicornios: {enabled: false, order: 100},
		espacial: {enabled: false, order: 110},
		gamer: {enabled: false, order: 120},
		elegante: {enabled: false, order: 130},
		tropical: {enabled: false, order: 140},
	},
	watermark: {
		...WATERMARK,
		mode: 'text',
		text: 'VISTA PREVIA · SIN COMPRAR · ALTAPARTY.COM',
		opacityPercent: 21,
		textSize: 25,
		imageWidth: 190,
		spacingX: 740,
		spacingY: 160,
		angleDeg: -12,
		driftPerSecond: 44,
		centerStamp: true,
		centerStampTitle: 'ALTAPARTY.COM',
		centerStampSubtitle: 'Comprá el video final sin marca de agua',
	},
	analytics: {gaId: '', clarityId: ''},
};
