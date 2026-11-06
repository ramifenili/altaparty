import { createHash } from "node:crypto";
import { isBuiltinTemplate } from "../templates/ids.ts";
import type { Metadata } from "next";
import { getStore } from "./store.ts";
import { SITE_NAME } from "../lib/seo.ts";

// Imagen para compartir (og:image) de cada plantilla. La dibuja el panel de admin en el navegador (con los datos de ejemplo,
// no con los de un cliente) y se guarda como un medio más. Una vez guardada no se vuelve a generar mientras la plantilla no cambie:
// el "nombre" del medio lleva la versión (huella) de la plantilla con la que se dibujó.

export const OG_SIZE = 750;
export const OG_MAX_BYTES = 1_000_000;
export const OG_ID_RE = /^[a-z0-9-]{2,40}$/;
const PREFIX = "og:";

/** Id del medio donde se guarda la imagen (determinista, cumple el formato de los medios). */
export const ogMediaId = (templateId: string) =>
  "og" + createHash("sha256").update(templateId).digest("hex").slice(0, 20);

/** Versión con la que se generó la imagen guardada, o null si todavía no hay. */
export async function ogVersion(templateId: string): Promise<string | null> {
  if (!OG_ID_RE.test(templateId)) return null;
  const meta = await getStore().getMediaMeta(ogMediaId(templateId));
  return meta?.name.startsWith(PREFIX) ? meta.name.slice(PREFIX.length) : null;
}

export const ogName = (version: string) => PREFIX + version;
export const ogPath = (templateId: string, version: string) =>
  `/api/og/${templateId}?v=${encodeURIComponent(version)}`;

/** ¿Existe la plantilla (incluida o video compilado)? */
export async function templateExists(id: string) {
  return isBuiltinTemplate(id) || !!(await getStore().getCompiled(id));
}

/** Metadatos de imagen para Open Graph y Twitter; undefined si la plantilla aún no tiene imagen. */
export async function ogImageFor(templateId: string, alt: string) {
  const v = await ogVersion(templateId);
  if (!v) return undefined;
  return {
    url: ogPath(templateId, v),
    width: OG_SIZE,
    height: OG_SIZE,
    type: "image/jpeg",
    alt,
  };
}

type Img = NonNullable<Awaited<ReturnType<typeof ogImageFor>>>;

/** Imagen para compartir del sitio (portada y páginas sin imagen propia): archivo estático en public/. */
export const HOME_OG_IMAGE: Img = {
  url: "/og-home.jpg",
  width: OG_SIZE,
  height: OG_SIZE,
  type: "image/jpeg",
  alt: `${SITE_NAME}.com: tu invitación de cumpleaños animada, lista en minutos`,
};

/** Etiquetas para compartir el link (Open Graph + Twitter/X): título, descripción, URL, idioma, nombre del sitio e imagen. */
export function shareMetadata(m: {
  title: string;
  description: string;
  url: string;
  image?: Img;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const image = m.image ?? HOME_OG_IMAGE;
  const handle = process.env.TWITTER_HANDLE?.replace(/^@/, "").trim();
  return {
    openGraph: {
      type: "website",
      title: m.title,
      description: m.description,
      url: m.url,
      siteName: SITE_NAME,
      locale: "es_AR",
      images: [image],
    },
    twitter: {
      // la imagen es cuadrada: la tarjeta "summary" es la que la muestra completa
      card: "summary",
      title: m.title,
      description: m.description,
      ...(handle ? { site: `@${handle}` } : {}),
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}
