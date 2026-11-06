import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {SiteConfigProvider} from '../../../src/state/SiteConfig';
import {InvitationProvider} from '../../../src/state/InvitationProvider';
import {AppShell} from '../../../src/components/AppShell';
import {seoForSlug} from '../../../src/server/seo';
import {SITE_NAME} from '../../../src/lib/seo';
import {ogImageFor, shareMetadata} from '../../../src/server/og';

// Se calcula en cada pedido: el admin puede cambiar slug, título y descripción en cualquier momento.
export const dynamic = 'force-dynamic';

type Props = {params: Promise<{slug: string}>};

export async function generateMetadata({params}: Props): Promise<Metadata> {
	const {slug} = await params;
	const r = await seoForSlug(slug);
	if (!r) return {title: 'Plantilla no encontrada', robots: {index: false}};
	return {
		title: r.seo.title,
		description: r.seo.description,
		alternates: {canonical: r.url},
		...shareMetadata({title: r.seo.title, description: r.seo.description, url: r.url, image: await ogImageFor(r.tpl.id, `Invitación de cumpleaños «${r.tpl.name}»`)}),
	};
}

export default async function TemplatePage({params}: Props) {
	const {slug} = await params;
	const r = await seoForSlug(slug);
	if (!r) notFound();
	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'Product',
		name: `Invitación de cumpleaños en video: ${r.tpl.name}`,
		description: r.seo.description,
		url: r.url,
		brand: {'@type': 'Brand', name: SITE_NAME},
		offers: {'@type': 'Offer', price: r.price, priceCurrency: 'ARS', availability: 'https://schema.org/InStock', url: r.url},
	};
	return (
		<SiteConfigProvider>
			<InvitationProvider initialTemplateId={r.tpl.id}>
				<AppShell intro={{title: `Invitación de cumpleaños «${r.tpl.name}» en video`, text: r.seo.description}} />
			</InvitationProvider>
			<script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd).replace(/</g, '\u003c')}} />
		</SiteConfigProvider>
	);
}
