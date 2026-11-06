import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./processing.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  ),
  alternates: { canonical: "/" },
  openGraph: {
    siteName: "AltaParty",
    locale: "es_AR",
    type: "website",
    images: [
      {
        url: "/og-home.jpg",
        width: 750,
        height: 750,
        type: "image/jpeg",
        alt: "AltaParty: tu invitación de cumpleaños animada, lista en minutos",
      },
    ],
  },
  twitter: {
    card: "summary",
    images: [
      {
        url: "/og-home.jpg",
        alt: "AltaParty: tu invitación de cumpleaños animada, lista en minutos",
      },
    ],
  },
  title: "Invitaciones animadas en video para WhatsApp | AltaParty",
  description:
    "Creá tu invitación de cumpleaños en video: elegí un diseño, sumá tu foto y tu música y descargá el MP4 en minutos para compartir por WhatsApp.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#9fe870",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
