import {NextResponse} from 'next/server';
import {limited, RULES} from '../../../src/server';
import {getStore} from '../../../src/server/store';
import {PRICING} from '../../../src/config/pricing';
import type {PublicConfig} from '../../../src/config/site';

export const runtime = 'nodejs';

/** Configuración pública: precio, marca de agua, plantillas visibles, videos compilados e IDs de analítica. */
export async function GET(req: Request) {
	const blocked = await limited(req, RULES.config);
	if (blocked) return blocked;
	const store = getStore();
	const [s, compiled] = await Promise.all([store.getSettings(), store.listCompiled()]);
	const body: PublicConfig = {
		pricing: {
			price: s.price,
			imagePrice: s.imagePrice,
			bundlePrice: s.bundlePrice,
			videoUpgrade: s.videoUpgrade,
			imageUpgrade: s.imageUpgrade,
			referencePrice: s.referencePrice,
			showReferencePrice: s.showReferencePrice,
			maxFinalRenders: s.maxFinalRenders,
			retentionDays: s.retentionDays,
			currency: PRICING.currency,
		},
		watermark: s.watermark,
		templates: s.templates,
		analytics: s.analytics,
		compiled,
	};
	return NextResponse.json(body, {headers: {'Cache-Control': 'no-store'}});
}
