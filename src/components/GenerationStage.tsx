"use client";

import React, { useEffect, useRef } from "react";
import { Clapperboard, Music } from "lucide-react";
import type { TemplateContent, TemplateDefinition } from "../templates/types";
import { TemplateCanvas } from "./TemplateCanvas";

/** posiciones (en %) de los destellos y colores/ángulos del confeti: fijos para no depender de Math.random en el render */
const SPARKLES = [
  { x: -6, y: 8, d: 0 },
  { x: 104, y: 20, d: 0.7 },
  { x: -10, y: 62, d: 1.3 },
  { x: 106, y: 76, d: 0.4 },
  { x: 14, y: -4, d: 1.8 },
  { x: 88, y: 104, d: 1.1 },
];
const CONFETTI = Array.from({ length: 16 }, (_, i) => ({
  a: (i / 16) * 360,
  dist: 90 + (i % 4) * 22,
  c: ["#9fe870", "#8b5cf6", "#ec4899", "#fbbf24"][i % 4],
  d: (i % 5) * 0.04,
}));

/**
 * Reparto de la animación según el progreso real de la creación:
 * mosaico (0–35 %) → degradés y desenfoque que se aclaran (35–60 %) → animación real nítida (60–100 %).
 * Los píxeles y los desenfoques también salen un poco de la caja del video y se integran al llegar al 60 %.
 */
const PIX_END = 0.35;
const BLUR_END = 0.6;
const MARGIN = 4; // celdas finas que el mosaico se sale de la caja, por lado
const smooth = (v: number) => {
  const k = Math.min(1, Math.max(0, v));
  return k * k * (3 - 2 * k);
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const FC = 24; // columnas finas del mosaico; cada celda base agrupa 4×4 finas

const hash = (x: number, y: number) => {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Mosaico irregular al comienzo: la invitación aparece en bloques de tamaños distintos que van
 * apareciendo desde el centro (no una grilla uniforme en escalera) y se disuelve en los degradés
 * y el desenfoque de la materialización. Es solo un efecto visual en el navegador: lee el canvas ya
 * dibujado y no toca el render del video.
 */
function PixelRefine({ glow, progress }: { glow: string; progress: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef(progress);
  target.current = progress;
  useEffect(() => {
    const cv = ref.current;
    const src = cv?.parentElement?.querySelector<HTMLCanvasElement>(
      ".pv-thumb canvas",
    );
    if (!cv || !src) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = cv.getContext("2d");
    const small = document.createElement("canvas");
    const sctx = small.getContext("2d", { willReadFrequently: true });
    if (!ctx || !sctx) return;
    const FR = Math.ceil((FC * src.height) / src.width / 4) * 4;
    const BC = FC / 4;
    const BR = FR / 4;
    small.width = FC;
    small.height = FR;
    // el lienzo es más grande que la caja del video: deja salir bloques por los costados
    const TW = FC + MARGIN * 2;
    const TH = FR + MARGIN * 2;
    cv.width = Math.round((src.width * TW) / FC);
    cv.height = Math.round((src.height * TH) / FR);
    cv.style.left = `${(-MARGIN / FC) * 100}%`;
    cv.style.top = `${(-MARGIN / FR) * 100}%`;
    cv.style.width = `${(TW / FC) * 100}%`;
    cv.style.height = `${(TH / FR) * 100}%`;
    cv.hidden = false;
    const fw = cv.width / TW;
    const fh = cv.height / TH;
    let shown = target.current;
    let raf = 0;
    const stop = () => {
      cv.hidden = true;
    };
    const tick = (now: number) => {
      // el avance real llega a saltos: se suaviza para que el mosaico fluya
      shown += (target.current - shown) * 0.06;
      if (target.current >= 1) shown = Math.max(shown, 0.99);
      if (shown >= PIX_END + 0.22) return stop();
      const t = clamp01(shown / PIX_END);
      // adentro de la caja el mosaico se disuelve en los degradés; afuera se integra al llegar al final del desenfoque
      const inScale = 1 - smooth((shown - (PIX_END - 0.05)) / 0.13);
      const outPull = smooth((shown - PIX_END) / 0.2);
      cv.style.filter = outPull > 0 ? `blur(${(outPull * 10).toFixed(1)}px)` : "";
      const outScale = 1 - outPull;
      let px: Uint8ClampedArray;
      try {
        sctx.drawImage(src, 0, 0, FC, FR);
        px = sctx.getImageData(0, 0, FC, FR).data;
      } catch {
        return stop();
      }
      ctx.clearRect(0, 0, cv.width, cv.height);
      const at = (x: number, y: number, i: number) =>
        px[
          (Math.min(FR - 1, Math.max(0, y)) * FC +
            Math.min(FC - 1, Math.max(0, x))) *
            4 +
            i
        ];
      for (let by = -1; by <= BR; by++) {
        for (let bx = -1; bx <= BC; bx++) {
          const outside = bx < 0 || by < 0 || bx >= BC || by >= BR;
          // cada zona aparece en su momento, desde el centro hacia afuera
          const dist = Math.hypot(
            (bx + 0.5) / BC - 0.5,
            ((by + 0.5) / BR - 0.5) * 0.6,
          );
          const appear = clamp01((t * 1.4 - dist * 1.1) * 3);
          const scale = outside ? outScale : inScale;
          if (appear <= 0 || scale <= 0) continue;
          // tamaño de bloque variable por zona y en el tiempo: grande, mediano o fino
          const nz =
            0.5 +
            0.5 *
              Math.sin(bx * 1.3 + by * 0.9 + t * 2.4) *
              Math.cos(by * 1.1 - bx * 0.7 + t * 1.7);
          const v = 0.55 * nz + 0.45 * hash(bx, by) + t * 0.2;
          const lvl = v < 0.4 ? 0 : v < 0.75 ? 1 : 2;
          const size = 4 >> lvl; // celdas finas por lado
          const n = 4 / size;
          for (let sy = 0; sy < n; sy++) {
            for (let sx = 0; sx < n; sx++) {
              const x0 = bx * 4 + sx * size;
              const y0 = by * 4 + sy * size;
              let falloff = 1;
              let ox = 0;
              let oy = 0;
              if (outside) {
                // afuera solo algunos bloques, que se apagan con la distancia a la caja
                const dx = Math.max(0, -x0, x0 + size - FC);
                const dy = Math.max(0, -y0, y0 + size - FR);
                falloff = 1 - Math.max(dx, dy) / (MARGIN + 1);
                if (hash(x0 + 7, y0 + 3) < 0.45 || falloff <= 0) continue;
                // al integrarse, los bloques se deslizan hacia la caja
                ox = (Math.min(Math.max(x0, 0), FC - size) - x0) * outPull;
                oy = (Math.min(Math.max(y0, 0), FR - size) - y0) * outPull;
              }
              let r = 0,
                g = 0,
                b = 0,
                c = 0;
              for (let yy = y0; yy < y0 + size; yy++) {
                for (let xx = x0; xx < x0 + size; xx++) {
                  r += at(xx, yy, 0);
                  g += at(xx, yy, 1);
                  b += at(xx, yy, 2);
                  c++;
                }
              }
              // un destello por bloque que titila, sin un patrón regular
              const tw = 0.82 + 0.18 * Math.sin(now / 160 + hash(x0, y0) * 40);
              ctx.globalAlpha =
                appear * tw * scale * falloff * (outside ? 0.85 : 1);
              ctx.fillStyle = `rgb(${(r / c) | 0},${(g / c) | 0},${(b / c) | 0})`;
              ctx.fillRect(
                (x0 + ox + MARGIN) * fw + 0.5,
                (y0 + oy + MARGIN) * fh + 0.5,
                size * fw - 1,
                size * fh - 1,
              );
            }
          }
          // anillo de brillo en el frente de aparición
          const edge = 1 - Math.abs(appear - 0.5) * 2;
          if (edge > 0.2 && !outside) {
            ctx.globalCompositeOperation = "screen";
            ctx.globalAlpha = edge * 0.35 * scale;
            ctx.fillStyle = glow;
            ctx.fillRect(
              (bx * 4 + MARGIN) * fw,
              (by * 4 + MARGIN) * fh,
              4 * fw,
              4 * fh,
            );
            ctx.globalCompositeOperation = "source-over";
          }
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      stop();
    };
  }, [glow]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className="pv-pix" aria-hidden="true" hidden />;
}

/** progreso (0..1) de la creación para la animación: el real del render, o 1 al terminar */
export function revealFor(job: { overall: number; status: string }) {
  return job.status === "done" ? 1 : clamp01(job.overall);
}

/**
 * Escena animada de la generación: la invitación se materializa con los colores de la plantilla
 * y reacciona a la etapa real. Todo es visual y corre en el navegador (CSS); no toca el render.
 * `reveal` (0..1) es el progreso de la creación (ver el reparto arriba).
 */
export function GenerationStage({
  template,
  content,
  phase,
  state,
  hasAudio,
  reveal: progress,
  clean = false,
  percent,
}: {
  /** porcentaje a mostrar en la píldora con aro (solo en la creación final) */
  percent?: number;
  /** sin marca de agua (compra confirmada) */
  clean?: boolean;
  template: TemplateDefinition;
  content: TemplateContent;
  /** etapa actual del render, o "done" cuando terminó */
  phase: string;
  state: "running" | "done" | "error";
  hasAudio: boolean;
  reveal: number;
}) {
  const done = state === "done";
  // el desenfoque se aclara entre el 35 % y el 60 % del progreso
  const reveal = clamp01((progress - PIX_END) / (BLUR_END - PIX_END));
  const pal = template.palette.length ? template.palette : ["#8b5cf6", "#ec4899"];
  // aura de color que sale de la caja: crece con el desenfoque y se integra al llegar a la parte final
  const aura = clamp01((progress - 0.3) / 0.15) * (1 - smooth((progress - (BLUR_END - 0.1)) / 0.1));
  const matStyle = {
    ...Object.fromEntries(
      [0, 1, 2, 3].map((i) => [`--m${i}`, pal[i % pal.length]]),
    ),
    "--pv-p": reveal,
    // borde difuso: los bordes de la invitación se funden con lo de afuera hasta que llega la parte nítida
    "--pv-f": 1 - smooth((progress - (PIX_END + 0.03)) / (BLUR_END - PIX_END - 0.03)),
  } as React.CSSProperties;

  return (
    <div
      className="pv-stage"
      data-phase={phase}
      data-audio={hasAudio ? "on" : "off"}
      data-state={state}
      data-sharp={progress >= BLUR_END ? "on" : "off"}
    >
      <div className="pv-float" style={{ "--pv-a": aura } as React.CSSProperties}>
        <span className="pv-aura" aria-hidden="true" style={matStyle} />
        <span className="pv-halo" aria-hidden="true" />
        <span className="pv-waves" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="pv-frame" aria-hidden="true" />
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className="pv-spark"
            aria-hidden="true"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              animationDelay: `${s.d}s`,
            }}
          />
        ))}
        <div className="processing-thumb pv-thumb" style={matStyle}>
          <div className="pv-inner">
            <TemplateCanvas
              template={template}
              content={content}
              animate
              watermark={!clean}
              scale={0.25}
              label="Tu invitación en proceso"
            />
            <span className="pv-mat" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span className="pv-sweep" aria-hidden="true" />
            <span className="pv-scan" aria-hidden="true" />
          </div>
        </div>
        <PixelRefine progress={progress} glow={pal[1] ?? pal[0] ?? "#4fd1ff"} />
        <span className="pv-badge pv-badge-music" aria-hidden="true">
          <Music size={18} />
        </span>
        {done && (
          <span className="pv-confetti" aria-hidden="true">
            {CONFETTI.map((c, i) => (
              <i
                key={i}
                style={
                  {
                    "--a": `${c.a}deg`,
                    "--dist": `${c.dist}px`,
                    background: c.c,
                    animationDelay: `${c.d}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </span>
        )}
      </div>
      <span className="pv-badges">
        {percent !== undefined && (
          <span
            className="pv-pill"
            role="status"
            aria-label={`Creando tu video: ${percent}%`}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle className="pv-ring-bg" cx="12" cy="12" r="9" />
              <circle
                className="pv-ring"
                cx="12"
                cy="12"
                r="9"
                pathLength={100}
                strokeDasharray="100"
                strokeDashoffset={100 - percent}
              />
            </svg>
            <b>{percent}%</b>
          </span>
        )}
        <span className="pv-badge pv-badge-mp4" aria-hidden="true">
          <Clapperboard size={16} /> MP4
        </span>
      </span>
    </div>
  );
}
