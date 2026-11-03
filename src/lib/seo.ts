// SEO de cada plantilla: URL (slug), título y descripción. Los valores
// predeterminados salen del nombre y la descripción de la plantilla; el admin
// puede pisarlos. Código puro: lo usan el servidor (metadatos, sitemap) y el cliente.

export const SITE_NAME = "AltaParty";
export const TEMPLATE_PATH = "/invitacion";

/** Quita "| AltaParty" (o "— AltaParty", etc.) del final de un título. */
export function stripSiteSuffix(title: string): string {
  // SITE_NAME no lleva caracteres especiales de expresiones regulares
  const t = title.trimEnd();
  if (!t.toLowerCase().endsWith(SITE_NAME.toLowerCase())) return title;
  return t
    .slice(0, t.length - SITE_NAME.length)
    .replace(/[\s|\-–—:·]+$/, "")
    .trim();
}

/** Todo título lleva siempre " | AltaParty" al final, lo haya escrito o no el admin. */
export const withSiteSuffix = (title: string) =>
  `${stripSiteSuffix(title).trim()} | ${SITE_NAME}`;

export type SeoFields = {
  slug?: string;
  seoTitle?: string;
  seoDescription?: string;
};
type T = { id: string; name: string; description: string; category?: string };

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "Fiesta Tropical" → "fiesta-tropical" (sin tildes ni símbolos). */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const templateSlug = (t: T, ov?: SeoFields) =>
  ov?.slug && SLUG_RE.test(ov.slug) ? ov.slug : slugify(t.name) || t.id;

export function templateSeo(t: T, ov?: SeoFields) {
  const custom = stripSiteSuffix(ov?.seoTitle?.trim() ?? "");
  const title = withSiteSuffix(
    fillTitle(custom, t.name) ||
      `${t.name}: invitación de cumpleaños animada en video`,
  );
  const base = `${t.description.replace(/\s+/g, " ").trim()} Personalizala con tu foto, nombre y datos de la fiesta y descargá el video MP4 listo para WhatsApp.`;
  const description =
    fillTitle(ov?.seoDescription?.trim() ?? "", t.name) ||
    (base.length > 160 ? `${base.slice(0, 157).trimEnd()}…` : base);
  return { title, description };
}

/** Encuentra la plantilla de un slug (primero los slugs editados, después los predeterminados). */
export function resolveSlug(
  slug: string,
  templates: T[],
  overrides: Record<string, SeoFields | undefined>,
): string | null {
  const s = slug.toLowerCase();
  return (
    templates.find((t) => templateSlug(t, overrides[t.id]) === s)?.id ?? null
  );
}

export const templateUrl = (slug: string, base = "") =>
  `${base}${TEMPLATE_PATH}/${slug}`;

/** Etiquetas ocultas de búsqueda: minúsculas, sin repetir, hasta 20 de 30 letras. */
export function normalizeTags(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  const out: string[] = [];
  for (const v of list) {
    if (typeof v !== "string") continue;
    const t = v.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 30);
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 20);
}

/** Reemplaza {title} por el nombre de la plantilla. */
export const fillTitle = (s: string, name: string) =>
  s.replace(/\{title\}/gi, name);

const plain = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** ¿La plantilla coincide con lo que se escribió en el buscador? (nombre, categoría y etiquetas ocultas; sin tildes) */
export function matchesSearch(
  t: { name: string; category: string; tags?: string[] },
  query: string,
): boolean {
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = plain([t.name, t.category, ...(t.tags ?? [])].join(" "));
  return words.every((w) => hay.includes(w));
}
