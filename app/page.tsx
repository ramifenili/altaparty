import type {Metadata} from 'next';
import {SiteConfigProvider} from '../src/state/SiteConfig';
import {InvitationProvider} from '../src/state/InvitationProvider';
import {AppShell} from '../src/components/AppShell';
import {siteUrl} from '../src/server/seo';
import {shareMetadata} from '../src/server/og';

const TITLE = 'AltaParty — invitaciones de cumpleaños animadas';
const DESCRIPTION = 'Creá una invitación de cumpleaños animada en video MP4: elegí una plantilla, cambiá la música, mirá la vista previa y descargá tu video.';

export function generateMetadata(): Metadata {
	return shareMetadata({title: TITLE, description: DESCRIPTION, url: `${siteUrl()}/`});
}

export default function Home() {
	return (
		<SiteConfigProvider>
			<InvitationProvider>
				<AppShell />
			</InvitationProvider>
		</SiteConfigProvider>
	);
}
