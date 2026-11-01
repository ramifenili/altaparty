"use client";

import React, { useEffect, useState } from "react";
import { adminApi } from "../admin/api";
import { useInvitation } from "../state/InvitationProvider";
import { renderMercadoLibre, type MlVariant } from "../render/mercadolibre";

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
          const url = URL.createObjectURL(await renderMercadoLibre(template, v.id));
          made.push(url);
          out.push({ id: v.id, url });
        }
        if (alive) setImages(out);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "No pudimos generar las imágenes.");
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
          Generando las imágenes…
        </p>
      )}
      <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
        {images.map((img) => (
          <figure key={img.id} style={{ margin: 0, display: "grid", gap: 8, justifyItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={`Mercado Libre: ${VARIANTS.find((v) => v.id === img.id)?.label}`}
              style={{ width: "100%", maxWidth: 420, height: "auto", borderRadius: 8 }}
            />
            <a className="btn btn-primary btn-sm" href={img.url} download={`ml-${template.id}-${img.id}.png`}>
              ⬇ Descargar PNG (1200×1200)
            </a>
          </figure>
        ))}
      </div>
      {images.length > 0 && (
        <p className="fine" style={{ textAlign: "center" }}>
          🛒 Imágenes para la publicación en Mercado Libre (solo admin).
        </p>
      )}
    </div>
  );
}
