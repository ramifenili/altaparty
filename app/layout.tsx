import type {Metadata, Viewport} from 'next';
import './globals.css';

export const metadata: Metadata = {
	metadataBase: new URL((process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')),
	alternates: {canonical: '/'},
	openGraph: {siteName: 'AltaParty', locale: 'es_AR', type: 'website'},
	title: 'AltaParty — invitaciones de cumpleaños animadas',
	description:
		'Creá una invitación de cumpleaños animada en MP4: elegí una plantilla, cambiá la música, mirá la vista previa y descargá tu video.',
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	themeColor: '#5b2be0',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
	return (
		<html lang="es">
			<body>{children}</body>
		</html>
	);
}
