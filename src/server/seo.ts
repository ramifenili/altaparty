import {TEMPLATES} from '../templates/registry';
import {getStore} from './store';
import {resolveSlug, templateSeo, templateSlug} from '../lib/seo';

export const siteUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

type Item = {id: string; name: string; description: string; category: string};

/** Plantillas visibles (incluidas + videos compilados publicados) con su configuración de SEO. */
export async function seoCatalog() {
	const store = getStore();
	const [settings, compiled] = await Promise.all([store.getSettings(), store.listCompiled()]);
	const raw: Item[] = [
		...TEMPLATES.map((t) => ({id: t.id, name: t.name, description: t.description, category: t.category})),
		...compiled.filter((c) => c.enabled).map((c) => ({id: c.id, name: c.name, description: c.description || c.name, category: c.category})),
	];
	// nombre y etiqueta editados en el admin
	const all = raw.map((t) => {
		const o = settings.templates[t.id];
		return {...t, name: o?.name || t.name, category: o?.category || t.category};
	});
	const visible = all.filter((t) => settings.templates[t.id]?.enabled !== false);
	return {settings, visible};
}

export async function seoForSlug(slug: string) {
	const {settings, visible} = await seoCatalog();
	const id = resolveSlug(slug, visible, settings.templates);
	const tpl = visible.find((t) => t.id === id);
	if (!tpl) return null;
	const ov = settings.templates[tpl.id];
	const canonicalSlug = templateSlug(tpl, ov);
	return {tpl, slug: canonicalSlug, seo: templateSeo(tpl, ov), price: settings.price, url: `${siteUrl()}/invitacion/${canonicalSlug}`};
}
