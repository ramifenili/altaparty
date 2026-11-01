import type {Metadata} from 'next';
import {SiteConfigProvider} from '../../src/state/SiteConfig';
import {GratisPage} from '../../src/components/GratisPage';

export const metadata: Metadata = {
	title: 'Invitación de cumpleaños en video gratis — AltaParty',
	description: 'Publicá la vista previa de tu invitación en Instagram, TikTok, Facebook, YouTube o X y, si llega a las vistas, descargá el video sin marca de agua gratis.',
	alternates: {canonical: '/gratis'},
};

export default function Gratis() {
	return (
		<SiteConfigProvider>
			<GratisPage />
		</SiteConfigProvider>
	);
}
