"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { galleryData, toTemplateContent } from "../domain/invitation";
import { useInvitation } from "../state/InvitationProvider";
import { renderFrame } from "../render/frame";
import { loadFonts } from "../render/assets";
import { loadTemplateAssets } from "../templates/assets";
import { loadWatermarkImage } from "../render/watermark";
import { CompiledMedia } from "../render/mediaAccess";
import { formatDuration } from "../audio/library";
import { PreviewTabs, StillPreview } from "./StillPreview";
import { MlImages, useIsAdmin } from "./AdminMlImages";
import { Volume2, VolumeX } from "lucide-react";

/** Mismos tiempos que el exportador (afade en render/engine.ts): entrada corta y salida de 1,2 s al final. */
const FADE_IN = 0.15;
const FADE_OUT = 1.2;
const SKIP = 5;
const clock_ = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const SCALE = 0.75;

/**
 * Vista previa en vivo: dibuja la plantilla en el navegador (no exporta MP4),
 * siempre con la marca de agua incrustada. El audio solo suena si el usuario
 * lo activa, respetando las políticas de reproducción automática.
 */
/** `clean` solo se usa en el generador de una compra ya confirmada por el servidor. */
export function LivePreview({
  clean = false,
  sample = false,
  arrows,
  hold = false,
  pause = false,
  initialSound = false,
}: {
  /** al pasar a true el video se pausa (no se reanuda solo) */
  pause?: boolean;
  /** flechas para pasar al diseño anterior / siguiente (solo en el estudio) */
  arrows?: { onPrev: () => void; onNext: () => void };
  clean?: boolean;
  /** muestra datos de ejemplo donde todavía no se cargó nada (entrada directa a una plantilla) */
  sample?: boolean;
  /** mientras sea true el video queda en pausa (se está eligiendo si suena); al soltarse arranca solo */
  hold?: boolean;
  /** si al soltarse el video arranca con sonido */
  initialSound?: boolean;
}) {
  const { state, template, content: realContent, resolvedAudio } = useInvitation();
  const photo = state.photo?.canvas ?? null;
  const content = useMemo(
    () =>
      sample ? toTemplateContent(galleryData(state.data), photo) : realContent,
    [sample, state.data, photo, realContent],
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clock = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRef = useRef<CompiledMedia | null>(null);
  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0);
  const shown = useRef(0);
  const [playing, setPlaying] = useState(!hold);
  const [sound, setSound] = useState(false);
  const wasHeld = useRef(hold);
  useEffect(() => {
    if (hold) {
      wasHeld.current = true;
      return;
    }
    if (!wasHeld.current) return;
    wasHeld.current = false;
    setPlaying(true);
    setSound(initialSound);
  }, [hold, initialSound]);
  // al activarse `pause` (un aviso encima) el video queda en pausa; no se reanuda solo
  useEffect(() => {
    if (pause) setPlaying(false);
  }, [pause]);
  const [audioError, setAudioError] = useState(false);
  // además del video, se puede ver la imagen 1080×1920 que sale de la misma plantilla
  const [mode, setMode] = useState<"video" | "image" | "ml">("video");
  const admin = useIsAdmin();
  const hasAudio = resolvedAudio.kind !== "none";
  const url = resolvedAudio.kind === "none" ? null : resolvedAudio.url;

  useEffect(() => {
    let alive = true;
    setReady(false);
    mediaRef.current?.dispose();
    mediaRef.current = null;
    Promise.all([
      loadFonts([...template.fonts, "Montserrat"]),
      loadTemplateAssets(template),
      loadWatermarkImage(),
      template.spec ? CompiledMedia.load(template.spec, "play") : null,
    ]).then(([, , , media]) => {
      if (!alive) return media?.dispose();
      mediaRef.current = media;
      setReady(true);
    });
    clock.current = 0;
    shown.current = 0;
    setTime(0);
    return () => {
      alive = false;
      mediaRef.current?.dispose();
      mediaRef.current = null;
    };
  }, [template]);

  // al escuchar una muestra de música en el selector, el sonido de la vista previa se apaga
  useEffect(() => {
    const off = () => setSound(false);
    window.addEventListener("audio-sample:play", off);
    return () => window.removeEventListener("audio-sample:play", off);
  }, []);

  // elemento de audio de la pista activa
  useEffect(() => {
    setAudioError(false);
    if (!url) {
      audioRef.current = null;
      return;
    }
    const a = new Audio(url);
    a.preload = "auto";
    a.onerror = () => setAudioError(true);
    audioRef.current = a;
    return () => {
      a.pause();
      a.removeAttribute("src");
      a.load();
      audioRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (sound && playing) {
      a.currentTime = Math.min(
        clock.current,
        Math.max(0, (a.duration || template.duration) - 0.05),
      );
      a.play().catch((e) => {
        // una interrupción (cambio de pista, pausa) no es un rechazo del navegador: el sonido sigue elegido
        if (e?.name !== "AbortError") setSound(false);
      });
    } else {
      a.pause();
    }
  }, [sound, playing, url, template.duration]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ready || !ctx) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      mediaRef.current?.setPlaying(playing);
      if (playing) {
        clock.current += (now - last) / 1000;
        if (clock.current >= template.duration) {
          clock.current %= template.duration;
          const a = audioRef.current;
          if (a && !a.paused) a.currentTime = 0;
        }
      }
      last = now;
      // la canción entra y sale con fundido, igual que en el video exportado
      const a = audioRef.current;
      if (a)
        a.volume = Math.max(
          0,
          Math.min(
            1,
            clock.current / FADE_IN,
            ((template.audioEnd ?? template.duration) - clock.current) / FADE_OUT,
          ),
        );
      if (Math.abs(clock.current - shown.current) >= 0.1) {
        shown.current = clock.current;
        setTime(clock.current);
      }
      renderFrame(ctx, template, content, clock.current, {
        watermark: !clean,
        scale: SCALE,
        media: mediaRef.current ?? undefined,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, playing, template, content, clean]);

  const seek = (to: number) => {
    const t = Math.max(0, Math.min(template.duration - 0.01, to));
    clock.current = t;
    shown.current = t;
    setTime(t);
    const a = audioRef.current;
    if (a)
      a.currentTime = Math.min(
        t,
        Math.max(0, (a.duration || template.duration) - 0.05),
      );
  };

  const restart = () => {
    seek(0);
    setPlaying(true);
  };

  return (
    <div className="lp">
      <PreviewTabs
        ml={admin && !clean}
        mode={mode}
        onChange={(m) => {
          setMode(m);
          // al mirar la imagen, el video queda en pausa (y sin sonido)
          if (m !== "video") setPlaying(false);
        }}
      />
      <div className="lp-card">
        <div className="player-wrap">
          {arrows && (
            <button
              type="button"
              className="lp-arrow lp-prev"
              aria-label="Ver el diseño anterior"
              onClick={arrows.onPrev}
            >
              ‹
            </button>
          )}
          {mode === "image" && (
            <StillPreview template={template} content={content} watermark={!clean} />
          )}
          {mode === "ml" && admin && <MlImages />}
          <div className="player" hidden={mode !== "video"}>
            <button
              type="button"
              className="player-stage"
              onClick={() => setPlaying((p) => !p)}
              aria-pressed={!playing}
              aria-label={`${playing ? "Pausar" : "Reproducir"} la vista previa de ${content.name || "tu cumpleañero"} con la plantilla ${template.name}`}
            >
              <canvas
                ref={canvasRef}
                width={Math.round(720 * SCALE)}
                height={Math.round(1280 * SCALE)}
                aria-hidden="true"
              />
              {!ready && (
                <span
                  className="player-loading"
                  role="status"
                  style={{
                    background: `linear-gradient(160deg, ${template.palette[0] ?? "#222"}, ${template.palette[1] ?? template.palette[0] ?? "#111"})`,
                  }}
                >
                  <span className="player-loading-card">
                    <span className="spinner" aria-hidden="true" />
                    <strong>Preparando «{template.name}»</strong>
                    <small>Cargando diseño, tipografías y animaciones…</small>
                  </span>
                </span>
              )}
              {ready && !playing && (
                <span className="player-pause" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="36" height="36">
                    <path d="M8 5v14l11-7z" fill="currentColor" />
                  </svg>
                </span>
              )}
            </button>
            <div className="player-seek">
              <button
                type="button"
                className="seek-btn"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pausar" : "Reproducir"}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  {playing ? (
                    <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
                  ) : (
                    <path d="M8 5v14l11-7z" fill="currentColor" />
                  )}
                </svg>
              </button>
              <span className="player-time" aria-hidden="true">
                {clock_(time)}
              </span>
              <input
                type="range"
                className="seek"
                min={0}
                max={template.duration}
                step={0.05}
                value={Math.min(time, template.duration)}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="Posición del video"
                aria-valuetext={`${clock_(time)} de ${formatDuration(template.duration)}`}
                style={
                  {
                    "--p": `${(Math.min(time, template.duration) / template.duration) * 100}%`,
                  } as React.CSSProperties
                }
              />
              <span className="player-time" aria-hidden="true">
                {formatDuration(template.duration)}
              </span>
            </div>
          </div>
          {arrows && (
            <button
              type="button"
              className="lp-arrow lp-next"
              aria-label="Ver el diseño siguiente"
              onClick={arrows.onNext}
            >
              ›
            </button>
          )}
        </div>
      </div>
      <div className="player-controls" hidden={mode !== "video"}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            if (!sound) window.dispatchEvent(new Event("preview-sound:on"));
            setSound((s) => !s);
          }}
          disabled={!hasAudio}
          aria-pressed={sound}
        >
          {!hasAudio
            ? <><VolumeX size={16} aria-hidden="true" /> Video silenciado</>
            : sound
              ? <><VolumeX size={16} aria-hidden="true" /> Desactivar sonido</>
              : <><Volume2 size={16} aria-hidden="true" /> Activar sonido</>}
        </button>
      </div>
      {audioError && (
        <p className="error-text" role="alert">
          No pudimos reproducir este audio en el navegador.
        </p>
      )}
    </div>
  );
}
