"use client";

import { useEffect, useMemo, useState } from "react";
import { useInvitation } from "../state/InvitationProvider";
import { useSiteConfig } from "../state/SiteConfig";
import { matchesSearch } from "../lib/seo";
import { galleryData, toTemplateContent } from "../domain/invitation";
import { TemplateCanvas } from "./TemplateCanvas";
import { track } from "../lib/analytics";
import { formatDuration } from "../audio/library";

/** Al pasar el mouse solo se reproduce un adelanto (la presentación), no el video completo. */
const HOVER_RANGE: [number, number] = [0.6, 3.0];

/** Galería para elegir plantilla. Se ve desde el inicio, con los datos que el usuario ya cargó (o de muestra). */
export function TemplateGallery() {
  const { state, setTemplate } = useInvitation();
  const { catalog, loaded } = useSiteConfig();
  const photo = state.photo?.canvas ?? null;
  const [category, setCategory] = useState<string>("");
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  // en pantallas táctiles no hay hover: la plantilla elegida muestra su adelanto animado
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    const sync = () => setTouch(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  // categorías visibles (las etiquetas ocultas solo sirven para el buscador)
  const categories = useMemo(
    () => [...new Set(catalog.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [catalog],
  );
  const list = catalog.filter(
    (t) => (!category || t.category === category) && matchesSearch(t, query),
  );
  const content = useMemo(
    () => toTemplateContent(galleryData(state.data), photo),
    [state.data, photo],
  );

  return (
    <section className="gallery-card" aria-labelledby="gal-title">
      <div className="section-head">
        <div>
          <h2 id="gal-title">Elegí tu diseño</h2>
        </div>
        {catalog.length > 1 && (
          <input
            type="search"
            className="input input-sm gallery-search"
            placeholder="Buscar diseño…"
            aria-label="Buscar diseño"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </div>
      {categories.length > 1 && (
        <div className="chips" role="group" aria-label="Filtrar por categoría" style={{ marginBottom: 12 }}>
          <button type="button" className="chip" aria-pressed={!category} onClick={() => setCategory("")}>
            Todas
          </button>
          {categories.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      )}
      {!loaded ? (
        <div className="empty panel" role="status">
          Cargando diseños…
        </div>
      ) : list.length === 0 ? (
        <div className="empty panel">
          No encontramos diseños con esa búsqueda.
        </div>
      ) : (
        <ul className="gallery" aria-label="Plantillas disponibles">
          {list.map((t) => {
            const selected = state.templateId === t.id;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className="card"
                  aria-pressed={selected}
                  onClick={() => {
                    setTemplate(t.id);
                    track("template_selected", { templateId: t.id });
                  }}
                  onMouseEnter={() => setHover(t.id)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(t.id)}
                  onBlur={() => setHover(null)}
                >
                  <span className="card-media">
                    <TemplateCanvas
                      template={t}
                      content={content}
                      animate={hover === t.id || (touch && selected)}
                      range={HOVER_RANGE}
                      watermark={hover === t.id || (touch && selected)}
                      label={`Vista de ${t.name}`}
                    />
                    <span className="card-dur">
                      {formatDuration(t.duration)}
                    </span>
                    {selected && (
                      <span className="card-badge">
                        <span aria-hidden="true">👑</span> Elegida
                      </span>
                    )}
                  </span>
                  <span className="card-body">
                    <span className="tag">{t.category}</span>
                    <span className="card-title" style={{ display: "block" }}>
                      {t.name}
                    </span>
                    {/* <span className="card-desc" style={{display: 'block'}}>{t.description}</span> */}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <ul className="benefit-strip" aria-label="Cómo funciona">
        <li>
          <span className="bi" aria-hidden="true">
            ▶
          </span>
          <span>
            <strong>Vista previa antes de pagar</strong>Revisá cómo queda tu
            invitación.
          </span>
        </li>
        <li>
          <span className="bi" aria-hidden="true">
            🔒
          </span>
          <span>
            <strong>Pago seguro</strong>Con Mercado Pago, solo si te gusta.
          </span>
        </li>
        <li>
          <span className="bi" aria-hidden="true">
            ⬇
          </span>
          <span>
            <strong>Descargá tu MP4</strong>Listo para compartir en WhatsApp.
          </span>
        </li>
      </ul>
    </section>
  );
}
