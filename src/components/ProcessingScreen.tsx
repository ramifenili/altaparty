"use client";

import React from "react";
import type { JobState } from "../hooks/useExportJob";
import { useInvitation } from "../state/InvitationProvider";
import { TemplateCanvas } from "./TemplateCanvas";
import { ProgressView } from "./ProgressView";
import { useIsAdmin } from "./AdminMlImages";

const CHECKS = [
  {
    icon: "⭐",
    title: "Diseño personalizado",
    text: "Se adapta a tu estilo y a la temática de la fiesta.",
  },
  {
    icon: "🖼",
    title: "Animaciones y efectos",
    text: "Damos vida a tu invitación con movimiento y creatividad.",
  },
  {
    icon: "🎵",
    title: "Música elegida",
    text: "La banda sonora perfecta para hacerla única.",
  },
  {
    icon: "🎬",
    title: "Generando tu video",
    text: "Unimos todo para crear un video increíble.",
  },
  { icon: "👁", title: "Vista previa", text: "Te mostramos cómo quedará." },
];
const ORDER = ["prepare", "frames", "audio", "encode", "finish"];

export function ProcessingScreen({
  job,
  onRetry,
  onCancel,
  onSkip,
}: {
  job: JobState;
  onRetry: () => void;
  onCancel: () => void;
  /** atajo de administrador: salta la espera de la vista previa */
  onSkip?: () => void;
}) {
  const { template, content } = useInvitation();
  const admin = useIsAdmin();
  const idx = Math.max(0, ORDER.indexOf(job.phase));
  return (
    <section
      className="processing"
      aria-labelledby="proc-title"
      aria-busy={job.status === "running"}
    >
      <div className="processing-card">
        <div className="processing-thumb">
          <TemplateCanvas
            template={template}
            content={content}
            animate
            watermark
            scale={0.25}
            label="Tu invitación en proceso"
          />
        </div>
        <h1 id="proc-title" className="sr-only">
          Generando tu vista previa
        </h1>
        {job.warning && <p className="alert alert-info">{job.warning}</p>}
        {job.status === "error" ? (
          <>
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
          <>
            <ProgressView job={job} title="Estamos creando tu video…" />
            {admin && onSkip && (
              <button type="button" className="admin-chip" onClick={onSkip}>
                ⏭ Saltear (admin)
              </button>
            )}
            {/* 
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancelar
            </button>
						 */}
          </>
        )}
      </div>
      <aside className="processing-side" aria-label="Qué estamos haciendo">
        <h2>¡Todo esto se hace por vos!</h2>
        <p className="hint">
          Cada invitación es única y se personaliza con tu foto, música y
          diseño. Por eso puede tardar unos segundos.
        </p>
        <ul className="check-list">
          {CHECKS.map((c, i) => {
            const state =
              i < idx || job.status === "done"
                ? "done"
                : i === idx
                  ? "active"
                  : "todo";
            return (
              <li key={c.title} data-state={state}>
                <span className="ci" aria-hidden="true">
                  {c.icon}
                </span>
                <span>
                  <strong>{c.title}</strong>
                  {c.text}
                </span>
                <span className="cs" aria-hidden="true">
                  {state === "done" ? "✓" : ""}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="eta">
          <span aria-hidden="true">⏱</span>{" "}
          <span>
            <strong>Puede demorar según tu dispositivo</strong>Por favor, no cierres
            esta ventana.
          </span>
        </p>
      </aside>
      {/* 
			<p className="did-you-know">
				<span className="dyk-ico" aria-hidden="true">💡</span>
				<span><strong>¿Sabías que…?</strong>Cada invitación incluye una vista previa gratuita para que la revises antes de comprar.</span>
				<span className="script" aria-hidden="true">¡Qué empiece la fiesta!</span>
			</p>
			*/}
    </section>
  );
}
