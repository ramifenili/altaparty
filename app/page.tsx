import {SiteConfigProvider} from '../src/state/SiteConfig';
import {InvitationProvider} from '../src/state/InvitationProvider';
import {AppShell} from '../src/components/AppShell';

export default function Home() {
	return (
		<SiteConfigProvider>
			<InvitationProvider>
				<AppShell />
			</InvitationProvider>
		</SiteConfigProvider>
	);
}
