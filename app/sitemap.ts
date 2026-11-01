import type {MetadataRoute} from 'next';
import {seoCatalog, siteUrl} from '../src/server/seo';
import {templateSlug} from '../src/lib/seo';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const base = siteUrl();
	const {settings, visible} = await seoCatalog();
	return [
		{url: `${base}/`, changeFrequency: 'weekly', priority: 1},
		{url: `${base}/preguntas-frecuentes`, changeFrequency: 'monthly' as const, priority: 0.5},
		{url: `${base}/gratis`, changeFrequency: 'monthly' as const, priority: 0.6},
		...visible.map((t) => ({url: `${base}/invitacion/${templateSlug(t, settings.templates[t.id])}`, changeFrequency: 'weekly' as const, priority: 0.8})),
	];
}
