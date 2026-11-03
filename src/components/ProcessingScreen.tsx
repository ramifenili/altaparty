"use client";

import React from "react";
import type { JobState } from "../hooks/useExportJob";
import { useInvitation } from "../state/InvitationProvider";
import { GenerationStage, revealFor } from "./GenerationStage";
import { useIsAdmin } from "./AdminMlImages";
import { Check, SkipForward, Timer } from "lucide-react";
import { Icon } from "./Icon";

const CHECKS = [
  {
    icon: "star",
    title: "Diseño personalizado",
    text: "Se adapta a tu estilo y a la temática de la fiesta.",
  },
  {
    icon: "image",
    title: "Animaciones y efectos",
    text: "Damos vida a tu invitación con movimiento y creatividad.",
  },
  {
    icon: "music",
    title: "Música elegida",
    text: "La banda sonora perfecta para hacerla única.",
  },
  {
    icon: "clapperboard",
    title: "Creando tu video",
    text: "Unimos todo para crear un video increíble.",
  },
  { icon: "eye", title: "Vista previa", text: "Te mostramos cómo quedará." },
];
/** si se eligió quitar la música, el paso de música se muestra acorde */
const NO_MUSIC = {
  icon: "volume-x",
  title: "Sin música",
  text: "Tu video se crea en silencio, tal como lo elegiste.",
};
const ORDER = ["prepare", "frames", "audio", "encode", "finish"];
/** cuánto se ve "¡Tu video está listo!" antes de pasar solo a la vista previa */
const DONE_HOLD_MS = 2800;

const COPY: Record<string, { title: string; text: string }> = {
  prepare: {
    title: "Estamos preparando tu video...",
    text: "Tu invitación está a punto de convertirse en algo increíble.",
  },
  frames: {
    title: "Organizando las animaciones...",
    text: "Cada movimiento y cada efecto va tomando su lugar.",
  },
  audio: {
    title: "Dándole ritmo a tu invitación...",
    text: "Sumamos la música para que se sienta como una fiesta.",
  },
  encode: {
    title: "Estamos convirtiendo tu invitación a video...",
    text: "Falta poco para tener tu video MP4 listo.",
  },
  finish: {
    title: "Preparando la vista previa...",
    text: "Últimos detalles antes de mostrártela.",
  },
  done: {
    title: "¡Tu video está listo!",
    text: "Tu invitación quedó increíble. Ya podés verla y compartirla.",
  },
};

export function ProcessingScreen({
  job,
  hasAudio = true,
  onRetry,
  onCancel,
  onSkip,
  onView,
}: {
  job: JobState;
  /** la exportación realmente mezcla música (si no, no se muestra la animación de ritmo) */
  hasAudio?: boolean;
  onRetry: () => void;
  onCancel: () => void;
  /** atajo de administrador: salta la espera de la vista previa */
  onSkip?: () => void;
  /** pasa a la vista previa cuando el video ya está listo */
  onView?: () => void;
}) {
  const { template, content } = useInvitation();
  const admin = useIsAdmin();
  const idx = Math.max(0, ORDER.indexOf(job.phase));
  const done = job.status === "done";
  const error = job.status === "error";
  const phase = done ? "done" : job.phase;
  const copy = COPY[phase] ?? COPY.prepare;
  // el porcentaje es el real del render; la espera final no inventa avances
  const pct = Math.floor(Math.min(done ? 100 : 99, job.overall * 100));
  const indeterminate = job.finishing && !done;
  const reveal = revealFor(job);

  // tras la celebración pasa solo a la vista previa (el botón permite adelantarlo)
  const viewRef = React.useRef(onView);
  viewRef.current = onView;
  React.useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => viewRef.current?.(), DONE_HOLD_MS);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <section
      className="processing"
      aria-labelledby="proc-title"
      aria-busy={job.status === "running"}
    >
      <div className="processing-card">
        <GenerationStage
          template={template}
          content={content}
          phase={phase}
          state={error ? "error" : done ? "done" : "running"}
          hasAudio={hasAudio}
          reveal={reveal}
        />

        {job.warning && !done && (
          <p className="alert alert-info">{job.warning}</p>
        )}
        {error ? (
          <>
            <h1 id="proc-title" className="sr-only">
              Creando tu vista previa
            </h1>
            <p className="alert alert-error" role="alert">
              {job.error}
            </p>
            <div className="actions-bar">
              <button
                type="button"
                className="btn btn-primary"
                onClick={onRetry}
              >
                Reintentar
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onCancel}
              >
                Volver al editor
              </button>
            </div>
          </>
        ) : (
          <div className="pv-info">
            <h1 id="proc-title" className="pv-title" aria-live="polite">
              <span key={phase} className="pv-swap">
                {copy.title}
              </span>
            </h1>
            <p key={`t-${phase}`} className="pv-sub pv-swap">
              {copy.text}
            </p>
            <div
              className={`progress${indeterminate ? " indeterminate" : ""}`}
              role="progressbar"
              aria-label="Progreso de la creación"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={indeterminate ? undefined : pct}
            >
              <div style={{ width: `${pct}%` }} />
            </div>
            <p className="fine pv-pct">
              {done
                ? "100% · Tu video MP4 se creó correctamente"
                : indeterminate
                  ? "Ya casi: terminando los últimos detalles"
                  : `${pct}%`}
            </p>
            {done && onView && (
              <button
                type="button"
                className="btn btn-primary btn-lg pv-cta"
                onClick={onView}
              >
                Ver mi video
              </button>
            )}
            {!done && admin && onSkip && (
              <button type="button" className="admin-chip" onClick={onSkip}>
                <SkipForward size={14} aria-hidden="true" /> Saltear (admin)
              </button>
            )}
          </div>
        )}
      </div>
      <aside className="processing-side" aria-label="Qué estamos haciendo">
        <h2>¡Todo esto se hace por vos!</h2>
        <p className="hint">
          Cada invitación es única y se personaliza con tu foto, música y
          diseño. Por eso puede tardar unos segundos.
        </p>
        <ul className="check-list">
          {CHECKS.map((c0, i) => {
            const c = !hasAudio && c0.icon === "music" ? NO_MUSIC : c0;
            const state =
              done || i < idx ? "done" : i === idx ? "active" : "todo";
            return (
              <li key={c.title} data-state={state}>
                <span className="ci" aria-hidden="true">
                  <Icon name={c.icon} />
                </span>
                <span>
                  <strong>{c.title}</strong>
                  {c.text}
                </span>
                <span className="cs" aria-hidden="true">
                  {state === "done" ? <Check size={14} strokeWidth={3} /> : ""}
                </span>
              </li>
            );
          })}
        </ul>
        {!done && (
          <p className="eta">
            <Timer size={20} aria-hidden="true" />{" "}
            <span>
              <strong>Puede demorar según tu dispositivo</strong>Por favor, no
              cierres esta ventana.
            </span>
          </p>
        )}
      </aside>
    </section>
  );
}
