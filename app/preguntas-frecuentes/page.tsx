import type {Metadata} from 'next';
import {SiteConfigProvider} from '../../src/state/SiteConfig';
import {FaqPage} from '../../src/components/FaqPage';

export const metadata: Metadata = {
	title: 'Preguntas frecuentes — AltaParty',
	description: 'Precios, medios de pago, cómo descargar tu invitación en video, cuántas veces podés corregirla y qué pasa con tus fotos. Respondemos tus dudas.',
	alternates: {canonical: '/preguntas-frecuentes'},
};

export default function Faq() {
	return (
		<SiteConfigProvider>
			<FaqPage />
		</SiteConfigProvider>
	);
}
