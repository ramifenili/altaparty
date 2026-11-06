"use client";

import React, { useEffect, useState } from "react";
import { adminApi } from "../admin/api";
import { useInvitation } from "../state/InvitationProvider";
import { renderMercadoLibre, type MlVariant } from "../render/mercadolibre";
import { ogFingerprint, renderOgImage, OG_SIZE } from "../render/og";
import { Download, RefreshCw, Share2, ShoppingCart } from "lucide-react";

const VARIANTS: { id: MlVariant; label: string }[] = [
  { id: "datos", label: "Información que necesitamos" },
  { id: "pasos", label: "Paso a paso" },
];

/** true si hay una sesión de admin (el panel y las imágenes de Mercado Libre son solo para el admin). */
export function useIsAdmin() {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    adminApi
      .me()
      .then(() => setAdmin(true))
      .catch(() => setAdmin(false));
  }, []);
  return admin;
}

/** Pestaña "Mercado Libre" (solo admin): genera al abrirse las dos imágenes PNG de 1200×1200 de la plantilla. */
export function MlImages() {
  const { template } = useInvitation();
  const [error, setError] = useState("");
  const [images, setImages] = useState<{ id: MlVariant; url: string }[]>([]);

  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    setImages([]);
    setError("");
    (async () => {
      try {
        const out: { id: MlVariant; url: string }[] = [];
        for (const v of VARIANTS) {
          const url = URL.createObjectURL(
            await renderMercadoLibre(template, v.id),
          );
          made.push(url);
          out.push({ id: v.id, url });
        }
        if (alive) setImages(out);
      } catch (e) {
        if (alive)
          setError(
            e instanceof Error ? e.message : "No pudimos crear las imágenes.",
          );
      }
    })();
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [template]);

  return (
    <div className="still-preview">
      {error && <p className="alert alert-error">{error}</p>}
      {!error && !images.length && (
        <p className="fine" style={{ textAlign: "center" }} role="status">
          Creando las imágenes…
        </p>
      )}
      <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
        {images.map((img) => (
          <figure
            key={img.id}
            style={{
              margin: 0,
              display: "grid",
              gap: 8,
              justifyItems: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={`Mercado Libre: ${VARIANTS.find((v) => v.id === img.id)?.label}`}
              style={{
                width: "100%",
                maxWidth: 420,
                height: "auto",
                borderRadius: 8,
              }}
            />
            <a
              className="btn btn-primary btn-sm"
              href={img.url}
              download={`ml-${template.id}-${img.id}.png`}
            >
              <Download size={14} aria-hidden="true" /> Descargar PNG
              (1200×1200)
            </a>
          </figure>
        ))}
      </div>
      {images.length > 0 && (
        <p className="fine" style={{ textAlign: "center" }}>
          <ShoppingCart size={14} aria-hidden="true" /> Imágenes para la
          publicación en Mercado Libre (solo admin).
        </p>
      )}
    </div>
  );
}

/**
 * Pestaña "Compartir" (solo admin): la imagen 750×750 que se ve al compartir el link (WhatsApp, X, Facebook…).
 * Se genera sola, una única vez: si el servidor ya la tiene y la plantilla no cambió, solo se muestra; no se vuelve a dibujar.
 */
export function OgImage() {
  const { template } = useInvitation();
  const [state, setState] = useState<{
    url: string;
    fresh: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setState(null);
    setError("");
    setBusy(true);
    (async () => {
      try {
        const version = ogFingerprint(template);
        const saved = await adminApi.ogStatus(template.id);
        if (saved.url && saved.version === version) {
          if (alive) setState({ url: saved.url, fresh: false });
          return;
        }
        const blob = await renderOgImage(template);
        const r = await adminApi.saveOg(template.id, blob, version);
        if (alive) setState({ url: r.url, fresh: true });
      } catch (e) {
        if (alive)
          setError(
            e instanceof Error ? e.message : "No pudimos crear la imagen.",
          );
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [template]);

  const regenerate = async () => {
    // vuelve a dibujar y reemplaza la guardada, aunque la plantilla no haya cambiado
    setBusy(true);
    setError("");
    try {
      const blob = await renderOgImage(template);
      const version = ogFingerprint(template);
      const r = await adminApi.saveOg(template.id, blob, version);
      setState({ url: r.url, fresh: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos crear la imagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="still-preview">
      {error && <p className="alert alert-error">{error}</p>}
      {busy && !state && (
        <p className="fine" style={{ textAlign: "center" }} role="status">
          Preparando la imagen…
        </p>
      )}
      {state && (
        <figure
          style={{ margin: 0, display: "grid", gap: 8, justifyItems: "center" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.url}
            alt={`Imagen para compartir: ${template.name}`}
            width={OG_SIZE}
            height={OG_SIZE}
            style={{ width: "100%", maxWidth: 360, height: "auto", borderRadius: 8 }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <a className="btn btn-primary btn-sm" href={state.url} download={`compartir-${template.id}.jpg`}>
              <Download size={14} aria-hidden="true" /> Descargar JPG ({OG_SIZE}×{OG_SIZE})
            </a>
            <button type="button" className="btn btn-secondary btn-sm" onClick={regenerate} disabled={busy}>
              <RefreshCw size={14} aria-hidden="true" /> Volver a generar
            </button>
          </div>
        </figure>
      )}
      <p className="fine" style={{ textAlign: "center" }}>
        <Share2 size={14} aria-hidden="true" />{" "}
        {state?.fresh ? "Imagen creada y guardada. " : "Imagen guardada. "}
        Es la que se ve al compartir el link en WhatsApp, X o Facebook; no se
        regenera sola hasta que la plantilla cambie (solo admin).
      </p>
    </div>
  );
}
