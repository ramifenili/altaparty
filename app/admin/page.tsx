import type {Metadata} from 'next';
import {SiteConfigProvider} from '../../src/state/SiteConfig';
import {AdminApp} from '../../src/admin/AdminApp';

export const metadata: Metadata = {title: 'Panel interno', robots: {index: false, follow: false}};

export default function AdminPage() {
	return (
		<SiteConfigProvider>
			<AdminApp />
		</SiteConfigProvider>
	);
}
