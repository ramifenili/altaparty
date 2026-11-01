// Configuración compartida de precios. El SERVIDOR es la fuente de verdad:
// el importe que se cobra se toma siempre de acá (src/server/purchases.ts) y
// nunca de lo que envíe el navegador. El cliente solo lo usa para mostrarlo.

export const PRICING = {
	currency: 'ARS',
	/** precio actual, en pesos */
	price: 8000,
	/** precio anterior tachado; mostrar solo si corresponde a una promoción real */
	referencePrice: 15000,
	showReferencePrice: true,
	/** solo la imagen 1080×1920 (JPG) */
	imagePrice: 5000,
	/** video + imagen */
	bundlePrice: 9500,
	/** Cuántas veces se puede generar el video final con una misma compra (rehacer por errores de tipeo, etc.). */
	maxFinalRenders: 5,
} as const;

/** Qué se compra: el video MP4, la imagen 1080×1920 o las dos cosas. */
export type Product = 'video' | 'image' | 'both';
export const PRODUCTS: readonly Product[] = ['video', 'image', 'both'];
export const isProduct = (v: unknown): v is Product => typeof v === 'string' && (PRODUCTS as readonly string[]).includes(v);
export const hasVideo = (p: Product) => p !== 'image';
export const hasImage = (p: Product) => p !== 'video';

/** Precio de cada producto con los precios vigentes. */
export const priceOf = (p: Product, pr: {price: number; imagePrice: number; bundlePrice: number}) => (p === 'image' ? pr.imagePrice : p === 'both' ? pr.bundlePrice : pr.price);

/**
 * Precio del video para quien ya compró la imagen: 20% menos que el precio normal, redondeado al valor más cercano
 * que termine en 500 o 750 (por ejemplo, $8.000 → $6.500).
 */
export function videoUpgradePrice(price: number) {
	const target = price * 0.8;
	let best = Infinity;
	for (let k = Math.floor(target / 1000) - 1; k <= Math.floor(target / 1000) + 1; k++) {
		for (const end of [500, 750]) {
			const v = k * 1000 + end;
			if (v > 0 && Math.abs(v - target) < Math.abs(best - target)) best = v;
		}
	}
	return Math.min(best, price);
}

/** Precio de la imagen para quien ya compró el video: la diferencia con el combo, sin superar el precio normal de la imagen. */
export function imageUpgradePrice(pr: {price: number; imagePrice: number; bundlePrice: number}) {
	const diff = pr.bundlePrice - pr.price;
	return diff > 0 ? Math.min(diff, pr.imagePrice) : pr.imagePrice;
}

export function formatArs(amount: number) {
	return new Intl.NumberFormat('es-AR', {
		style: 'currency',
		currency: 'ARS',
		maximumFractionDigits: 0,
	}).format(amount);
}

type PromoPrices = {price: number; imagePrice: number; bundlePrice: number; videoUpgrade?: number; imageUpgrade?: number};

/** Precio del video para quien ya compró la imagen: el que cargó el admin o, si está en 0, el automático. Nunca supera el normal. */
export const videoPromoPrice = (pr: PromoPrices) => (pr.videoUpgrade ? Math.min(pr.videoUpgrade, pr.price) : videoUpgradePrice(pr.price));

/** Precio de la imagen para quien ya compró el video: el que cargó el admin o, si está en 0, el automático. Nunca supera el normal. */
export const imagePromoPrice = (pr: PromoPrices) => (pr.imageUpgrade ? Math.min(pr.imageUpgrade, pr.imagePrice) : imageUpgradePrice(pr));
