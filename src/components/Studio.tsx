"use client";

import React, { useEffect, useRef, useState } from "react";
// import { isMobileDevice, MOBILE_NOTICE } from "../render/engine";
import { useInvitation } from "../state/InvitationProvider";
import { useSiteConfig } from "../state/SiteConfig";
import { formatLongDate } from "../domain/invitation";
import { formatDuration } from "../audio/library";
import { LivePreview } from "./LivePreview";
import { TemplateCanvas } from "./TemplateCanvas";
import { AudioPicker } from "./AudioPicker";
import { InvitationForm } from "./InvitationForm";
import {
  CalendarDays,
  Check,
  Clapperboard,
  Clock,
  MapPin,
  Pencil,
  User,
} from "lucide-react";

const IDLE_EXTRA_MS = 10000;

/** Pregunta si ya está todo listo: sin cierre por Esc ni por fuera; hay que elegir una opción. */
function ReadyPrompt({
  onYes,
  onNo,
}: {
  onYes: () => void;
  onNo: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  const second = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  const trap = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") e.preventDefault();
    if (e.key !== "Tab") return;
    const to = e.shiftKey ? second : first;
    const from = e.shiftKey ? first : second;
    if (document.activeElement === from.current) {
      e.preventDefault();
      to.current?.focus();
    }
  };
  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ready-title"
        onKeyDown={trap}
      >
        <h2 id="ready-title">¿Todo listo?</h2>
        <p>Si ya revisaste la invitación, podemos crear tu video.</p>
        <button
          ref={first}
          type="button"
          className="btn btn-primary btn-block"
          onClick={onYes}
        >
          <Clapperboard size={18} aria-hidden="true" /> Sí, crear mi video
          invitación
        </button>
        <button
          ref={second}
          type="button"
          className="btn btn-secondary btn-block"
          onClick={onNo}
        >
          No, seguir revisando
        </button>
      </div>
    </div>
  );
}

export function Studio({
  onGenerate,
  onGallery,
  generating,
  initialSound,
  hold,
}: {
  onGenerate: () => void;
  onGallery: () => void;
  generating: boolean;
  initialSound?: boolean;
  hold?: boolean;
}) {
  const { state, template, content, setTemplate } = useInvitation();
  const { catalog } = useSiteConfig();
  const [editing, setEditing] = useState(false);
  // const [mobile, setMobile] = useState(false);
  // useEffect(() => setMobile(isMobileDevice()), []);
  // flechas de la vista previa: recorren los diseños de a uno (y vuelven al principio)
  const step = (dir: 1 | -1) => {
    if (catalog.length < 2) return;
    const i = Math.max(
      0,
      catalog.findIndex((t) => t.id === state.templateId),
    );
    setTemplate(catalog[(i + dir + catalog.length) % catalog.length].id);
  };

  // Inactividad: si pasa un rato mirando la vista previa sin tocar controles ni editar,
  // preguntamos si ya está todo listo. "No, seguir revisando" duplica la espera.
  // Al salir de esta pantalla el componente se desmonta y la espera vuelve a la inicial.
  // espera = lo que dura el video de la plantilla + un margen; siempre la misma
  const idleMs = template.duration * 1000 + IDLE_EXTRA_MS;
  const [askReady, setAskReady] = useState(false);
  const [activity, setActivity] = useState(0);
  const bump = () => setActivity((n) => n + 1);
  const paused = editing || generating || !!hold || askReady;
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setAskReady(true), idleMs);
    return () => clearTimeout(t);
  }, [paused, idleMs, activity]);

  return (
    <div className={`studio${editing ? " is-editing" : ""}`}>
      {askReady && (
        <ReadyPrompt
          onYes={() => {
            setAskReady(false);
            onGenerate();
          }}
          onNo={() => setAskReady(false)}
        />
      )}
      <h1 className="sr-only">Vista previa de tu invitación</h1>
      <div className="studio-preview">
        <LivePreview
          initialSound={initialSound}
          hold={hold}
          pause={askReady}
          arrows={{
            onPrev: () => {
              bump();
              step(-1);
            },
            onNext: () => {
              bump();
              step(1);
            },
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
      <div
        className="stack"
        onPointerDownCapture={bump}
        onKeyDownCapture={bump}
        onChangeCapture={bump}
      >
        <section className="panel data-card" aria-labelledby="data-title">
          <div className="data-head">
            <h3 id="data-title">Datos de la fiesta</h3>
            {!editing && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditing(true)}
              >
                <Pencil size={14} aria-hidden="true" /> Editar
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
                <User size={14} aria-hidden="true" /> Cumpleañero/a
              </dt>
              <dd>
                {content.name}, {content.age} años
                {state.photo ? " · con foto" : ""}
              </dd>
              <dt>
                <CalendarDays size={14} aria-hidden="true" /> Fecha
              </dt>
              <dd>{formatLongDate(state.data.date)}</dd>
              <dt>
                <Clock size={14} aria-hidden="true" /> Horario
              </dt>
              <dd>{content.time}</dd>
              <dt>
                <MapPin size={14} aria-hidden="true" /> Lugar
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
            <Pencil size={14} aria-hidden="true" /> Editar
          </button>
        </div>

        <p className="note-ok">
          <Check size={14} strokeWidth={3} aria-hidden="true" /> Vas a poder revisar todo antes de
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
            {generating ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <Clapperboard size={24} aria-hidden="true" />
            )}{" "}
            Crear mi video invitación
          </button>
          <p className="cta-free">Gratis · No se realiza ningún cobro</p>
        </div>
        <div className="cta-notes">
          {/* {mobile && (
            <p className="alert alert-info" style={{ marginTop: 10 }}>
              {MOBILE_NOTICE}
            </p>
          )} */}
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
