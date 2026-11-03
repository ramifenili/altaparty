"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useInvitation } from "../state/InvitationProvider";
import { useSiteConfig } from "../state/SiteConfig";
import { galleryData, toTemplateContent } from "../domain/invitation";
import { TemplateCanvas } from "./TemplateCanvas";
import { track } from "../lib/analytics";
import { formatDuration } from "../audio/library";

/** Al pasar el mouse solo se reproduce un adelanto (la presentación), no el video completo. */
const HOVER_RANGE: [number, number] = [0.6, 3.0];
/** píxeles que hay que mover el mouse para que cuente como arrastre y no como clic */
const DRAG_THRESHOLD = 6;

/**
 * Galería para elegir plantilla. Se ve desde el inicio, con los datos que el usuario ya cargó (o de muestra).
 * La fila es infinita (se repite en círculo cuando no entra entera), se mueve con las flechas, el scroll
 * o arrastrando con el mouse, y al elegir una tarjeta se centra con una animación suave.
 */
export function TemplateGallery() {
  const { state, setTemplate } = useInvitation();
  const { catalog, loaded } = useSiteConfig();
  const photo = state.photo?.canvas ?? null;
  const [category, setCategory] = useState<string>("");
  const [hover, setHover] = useState<string | null>(null);
  const [loop, setLoop] = useState(false);
  const [dragging, setDragging] = useState(false);
  const rail = useRef<HTMLUListElement>(null);
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });
  const settleTimer = useRef<number | undefined>(undefined);
  const firstPlacement = useRef(true);

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
  const list = useMemo(
    () => catalog.filter((t) => !category || t.category === category),
    [catalog, category],
  );
  const content = useMemo(
    () => toTemplateContent(galleryData(state.data), photo),
    [state.data, photo],
  );
  const copies = loop ? [0, 1, 2] : [0];

  /** ancho de una vuelta completa de la fila (distancia entre la tarjeta 0 de dos copias) */
  const lapWidth = useCallback(() => {
    const el = rail.current;
    const a = el?.querySelector<HTMLElement>('li[data-copy="0"]');
    const b = el?.querySelector<HTMLElement>('li[data-copy="1"]');
    return a && b ? b.offsetLeft - a.offsetLeft : 0;
  }, []);

  const centerOn = useCallback((li: HTMLElement | null, smooth: boolean) => {
    const el = rail.current;
    if (!el || !li) return;
    const left = li.offsetLeft - el.offsetLeft - (el.clientWidth - li.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: smooth ? "smooth" : "auto" });
  }, []);

  /** decide si la fila necesita repetirse en círculo (solo si una vuelta no entra en el ancho visible) */
  useLayoutEffect(() => {
    const el = rail.current;
    if (!el || !loaded) return;
    const measure = () => {
      const oneLap = loop ? lapWidth() : el.scrollWidth;
      const overflow = oneLap > el.clientWidth + 8;
      if (overflow !== loop) setLoop(overflow);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [loop, list, loaded, lapWidth]);

  /** al cambiar de categoría o de modo: posiciona la fila (centrada en la elegida, o al principio) sin salto visible */
  useLayoutEffect(() => {
    const el = rail.current;
    if (!el || !loaded) return;
    const copy = loop ? 1 : 0;
    const selected = el.querySelector<HTMLElement>(`li[data-copy="${copy}"][data-selected="true"]`);
    const first = el.querySelector<HTMLElement>(`li[data-copy="${copy}"]`);
    centerOn(selected ?? first, false);
    if (!selected && first) el.scrollLeft = Math.max(0, first.offsetLeft - el.offsetLeft - 2);
    firstPlacement.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop, category, loaded, list.length]);

  /** vuelve a la copia del medio cuando se llega a una orilla, sin que se note */
  const wrap = useCallback(() => {
    const el = rail.current;
    if (!el || !loop) return;
    const lap = lapWidth();
    if (!lap) return;
    const base = (el.querySelector<HTMLElement>('li[data-copy="0"]')?.offsetLeft ?? 0) - el.offsetLeft;
    const x = el.scrollLeft - base;
    if (x < lap * 0.5) el.scrollLeft += lap;
    else if (x > lap * 1.5) el.scrollLeft -= lap;
  }, [loop, lapWidth]);

  const onScroll = () => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(wrap, 120);
  };
  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const scrollBy = (dir: 1 | -1) => {
    const el = rail.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  // arrastrar con el mouse (en pantallas táctiles el scroll nativo ya funciona)
  const onPointerDown = (e: React.PointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = rail.current;
    if (!el) return;
    drag.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    const el = rail.current;
    if (!d.down || !el) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      d.moved = true;
      setDragging(true);
      el.setPointerCapture(e.pointerId);
    }
    if (d.moved) el.scrollLeft = d.startLeft - dx;
  };
  const endDrag = (e: React.PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    if (!d.down) return;
    d.down = false;
    if (d.moved) {
      setDragging(false);
      rail.current?.releasePointerCapture?.(e.pointerId);
      // el clic que sigue al arrastre se ignora; después se acomoda la fila
      window.setTimeout(() => (drag.current.moved = false), 0);
      onScroll();
    }
  };

  return (
    <section className="gallery-card" aria-labelledby="gal-title">
      <h2 id="gal-title" className="sr-only">
        Elegí tu diseño
      </h2>
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
        <div className="empty panel">No hay diseños en esta categoría todavía.</div>
      ) : (
        <div className="carousel">
          <button type="button" className="carousel-arrow carousel-prev" aria-label="Ver diseños anteriores" onClick={() => scrollBy(-1)}>
            ‹
          </button>
          <ul
            key={category}
            className={`gallery gallery-enter${dragging ? " is-dragging" : ""}`}
            aria-label="Plantillas disponibles"
            ref={rail}
            onScroll={onScroll}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDragStart={(e) => e.preventDefault()}
            onClickCapture={(e) => {
              if (drag.current.moved) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
          >
            {copies.flatMap((copy) =>
              list.map((t) => {
                const selected = state.templateId === t.id;
                const key = `${copy}:${t.id}`;
                const extra = copy !== (loop ? 1 : 0);
                return (
                  <li key={key} data-copy={copy} data-selected={selected}>
                    <button
                      type="button"
                      className="card"
                      aria-pressed={selected}
                      aria-label={`${t.name} · ${t.category}`}
                      // las copias de los costados son solo decorativas para el teclado y los lectores de pantalla
                      tabIndex={extra ? -1 : undefined}
                      aria-hidden={extra ? true : undefined}
                      onClick={(e) => {
                        setTemplate(t.id);
                        track("template_selected", { templateId: t.id });
                        centerOn(e.currentTarget.parentElement, true);
                      }}
                      onMouseEnter={() => setHover(key)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(key)}
                      onBlur={() => setHover(null)}
                    >
                      <span className="card-media">
                        <TemplateCanvas
                          template={t}
                          content={content}
                          animate={hover === key || (touch && selected)}
                          range={HOVER_RANGE}
                          watermark={hover === key || (touch && selected)}
                          label={`Vista de ${t.name}`}
                        />
                        <span className="card-dur">{formatDuration(t.duration)}</span>
                        {selected && (
                          <span className="card-check" aria-hidden="true">
                            ✓
                          </span>
                        )}
                        {selected && (
                          <span className="card-badge">
                            <span aria-hidden="true">👑</span> Elegida
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              }),
            )}
          </ul>
          <button type="button" className="carousel-arrow carousel-next" aria-label="Ver más diseños" onClick={() => scrollBy(1)}>
            ›
          </button>
        </div>
      )}
    </section>
  );
}
