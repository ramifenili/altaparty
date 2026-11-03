"use client";

import React, { useEffect, useState } from "react";
import { isMobileDevice, MOBILE_NOTICE } from "../render/engine";
import { useInvitation } from "../state/InvitationProvider";
import { useSiteConfig } from "../state/SiteConfig";
import { formatLongDate } from "../domain/invitation";
import { formatDuration } from "../audio/library";
import { LivePreview } from "./LivePreview";
import { TemplateCanvas } from "./TemplateCanvas";
import { AudioPicker } from "./AudioPicker";
import { InvitationForm } from "./InvitationForm";

export function Studio({
  onGenerate,
  onGallery,
  generating,
}: {
  onGenerate: () => void;
  onGallery: () => void;
  generating: boolean;
}) {
  const { state, template, content, setTemplate } = useInvitation();
  const { catalog } = useSiteConfig();
  const [editing, setEditing] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(isMobileDevice()), []);
  // flechas de la vista previa: recorren los diseños de a uno (y vuelven al principio)
  const step = (dir: 1 | -1) => {
    if (catalog.length < 2) return;
    const i = Math.max(
      0,
      catalog.findIndex((t) => t.id === state.templateId),
    );
    setTemplate(catalog[(i + dir + catalog.length) % catalog.length].id);
  };

  return (
    <div className={`studio${editing ? " is-editing" : ""}`}>
      <h1 className="sr-only">Vista previa de tu invitación</h1>
      <div className="studio-preview">
        <LivePreview
          arrows={{
            onPrev: () => step(-1),
            onNext: () => step(1),
          }}
        />
        {/* 
        <section className="studio-strip" aria-labelledby="tpl-title">
          <h3 id="tpl-title" className="sr-only">
            Cambiar de diseño
          </h3>
          <ul className="strip" aria-label="Plantillas">
            {catalog.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="strip-item"
                  aria-pressed={state.templateId === t.id}
                  onClick={() => setTemplate(t.id)}
                >
                  <TemplateCanvas
                    template={t}
                    content={content}
                    scale={0.15}
                    label={`Plantilla ${t.name}`}
                  />
                  <span>{t.name}</span>
                  <small>{formatDuration(t.duration)}</small>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onGallery}
          >
            Volver al inicio y ver todas
          </button>
        </section>
				*/}
      </div>
      <div className="stack">
        <section className="panel data-card" aria-labelledby="data-title">
          <div className="data-head">
            <h3 id="data-title">Datos de la fiesta</h3>
            {!editing && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditing(true)}
              >
                ✏️ Editar
              </button>
            )}
          </div>
          {editing ? (
            <InvitationForm
              submitLabel="Guardar cambios"
              onSubmit={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <dl className="summary">
              <dt>
                <span aria-hidden="true">👤</span> Cumpleañero/a
              </dt>
              <dd>
                {content.name}, {content.age} años
                {state.photo ? " · con foto" : ""}
              </dd>
              <dt>
                <span aria-hidden="true">📅</span> Fecha
              </dt>
              <dd>{formatLongDate(state.data.date)}</dd>
              <dt>
                <span aria-hidden="true">🕒</span> Horario
              </dt>
              <dd>{content.time}</dd>
              <dt>
                <span aria-hidden="true">📍</span> Lugar
              </dt>
              <dd>
                {content.venue} — {content.address}
              </dd>
            </dl>
          )}
        </section>

        <AudioPicker />

        {/* 
        <div className="row-card">
          <span className="ri" aria-hidden="true">
            🖼
          </span>
          <div className="row-main">
            <h3>Foto del cumpleañero/a</h3>
            <p>
              {state.photo
                ? "Foto cargada"
                : "Sin foto: la invitación se adapta igual"}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setEditing(true)}
            disabled={editing}
          >
            ✏️ Editar
          </button>
        </div>

        <p className="note-ok">
          <span aria-hidden="true">✓</span> Vas a poder revisar todo antes de
          pagar
        </p>
				 */}

        <div className="cta-card">
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={onGenerate}
            disabled={generating || editing}
          >
            {generating && <span className="spinner" aria-hidden="true" />}{" "}
            Generar video
          </button>
          <p className="cta-free">Gratis · No se realiza ningún cobro</p>
        </div>
        <div className="cta-notes">
          {mobile && (
            <p className="alert alert-info" style={{ marginTop: 10 }}>
              {MOBILE_NOTICE}
            </p>
          )}
          <p className="fine" style={{ textAlign: "center" }}>
            {editing ? "Guardá los cambios de tus datos para continuar. " : ""}
            El video se crea en tu navegador: la vista previa no sube tu foto a
            ningún servidor. Recién al comprar guardamos una copia de tus datos
            y tu foto por unos días para que puedas volver a descargarlo. La
            vista previa tarda unos segundos.
          </p>
        </div>
      </div>
    </div>
  );
}
