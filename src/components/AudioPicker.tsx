"use client";

import React, { useEffect, useRef, useState } from "react";
import { useInvitation } from "../state/InvitationProvider";
import { SOUNDS, formatDuration, getSound } from "../audio/library";
import { Folder, Music, Undo2, Upload, Volume2, VolumeX, X } from "lucide-react";
import { Icon } from "./Icon";

function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      aria-hidden="true"
      fill="currentColor"
    >
      {playing ? (
        <path d="M6 4h3v12H6zM11 4h3v12h-3z" />
      ) : (
        <path d="M6.5 4.2v11.6a.6.6 0 00.9.5l9-5.8a.6.6 0 000-1L7.4 3.7a.6.6 0 00-.9.5z" />
      )}
    </svg>
  );
}

export function AudioPicker() {
  const { state, template, setAudio, setCustomAudio } = useInvitation();
  const fileRef = useRef<HTMLInputElement>(null);
  const sampleRef = useRef<HTMLAudioElement | null>(null);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const sel = state.audio;
  const defaultSound = getSound(template.defaultAudioId);

  const stopSample = () => {
    sampleRef.current?.pause();
    sampleRef.current = null;
    setSampleId(null);
  };
  useEffect(() => stopSample, []);
  // si la vista previa activa su sonido, la muestra se detiene
  useEffect(() => {
    window.addEventListener("preview-sound:on", stopSample);
    return () => window.removeEventListener("preview-sound:on", stopSample);
  }, []);

  const toggleSample = (id: string, url: string) => {
    if (sampleId === id) return stopSample();
    stopSample();
    window.dispatchEvent(new Event("audio-sample:play")); // apaga el sonido de la vista previa
    const a = new Audio(url);
    a.onended = () => setSampleId((cur) => (cur === id ? null : cur));
    a.onerror = () => {
      setError("No pudimos reproducir la muestra.");
      setSampleId(null);
    };
    sampleRef.current = a;
    setSampleId(id);
    a.play().catch(() => setSampleId(null));
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    stopSample();
    try {
      await setCustomAudio(file);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No pudimos cargar el audio.",
      );
    } finally {
      setBusy(false);
    }
  };

  const activeName =
    sel.kind === "mute"
      ? "Sin sonido"
      : sel.kind === "custom"
        ? sel.name
        : (getSound(sel.kind === "library" ? sel.id : template.defaultAudioId)
            ?.name ?? "Sin sonido");
  const isDefault = sel.kind === "default";
  const activeUrl =
    sel.kind === "custom"
      ? sel.url
      : sel.kind === "mute"
        ? null
        : (getSound(sel.kind === "library" ? sel.id : template.defaultAudioId)
            ?.file ?? null);
  const activeId =
    sel.kind === "library"
      ? sel.id
      : sel.kind === "default"
        ? template.defaultAudioId
        : null;

  // la lista se cierra con Esc o con un clic fuera de la tarjeta
  useEffect(() => {
    if (!open) return;
    const close = () => {
      stopSample();
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      // el fondo oscuro es parte de la tarjeta: solo cuentan la lista y la fila de abrir/cerrar
      const t = e.target as Element;
      if (!t.closest(".row-body") && !t.closest(".row-card")) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section
      className="row-card-wrap"
      aria-labelledby="audio-title"
    >
      <div className="row-card">
        <span className="ri" aria-hidden="true">
          <Music size={20} />
        </span>
        <div className="row-main">
          <h3 id="audio-title">Música</h3>
          <p>
            Seleccionada: <strong>{activeName}</strong>
          </p>
        </div>
        {activeUrl && (
          <button
            type="button"
            className="chev play"
            aria-label={
              sampleId === "head" ? "Detener muestra" : `Escuchar ${activeName}`
            }
            onClick={() => toggleSample("head", activeUrl)}
          >
            <PlayIcon playing={sampleId === "head"} />
          </button>
        )}
        <button
          type="button"
          className="chev"
          aria-expanded={open}
          aria-controls="audio-body"
          aria-label={open ? "Ocultar opciones de música" : "Cambiar la música"}
          onClick={() => {
            if (open) stopSample();
            setOpen((o) => !o);
          }}
        >
          <svg
            className="chev-ico"
            data-open={open}
            viewBox="0 0 20 20"
            width="20"
            height="20"
            aria-hidden="true"
          >
            <path
              d="M5 7.5l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {open && (
        <div id="audio-body" className="row-body">
          <button
            type="button"
            className="row-body-close"
            aria-label="Cerrar la lista de música"
            onClick={() => {
              stopSample();
              setOpen(false);
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
          <p className="hint" style={{ marginTop: 0 }}>
            Cada diseño trae su propia música. Podés cambiarla o subir la tuya.
          </p>

          <div className="active-audio" aria-live="polite">
            <span>
              <Music size={16} aria-hidden="true" /> Sonido activo: <strong>{activeName}</strong>
            </span>
            {isDefault && (
              <span className="badge badge-ok">Predeterminado</span>
            )}
            {sel.kind === "custom" && <span className="badge">Tu audio</span>}
            {sel.kind === "mute" && <span className="badge">Silenciado</span>}
          </div>
          <div className="actions-bar" style={{ marginTop: 10 }}>
            {!isDefault && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAudio({ kind: "default" })}
              >
                <Undo2 size={14} aria-hidden="true" /> Volver al predeterminado
                {defaultSound ? ` (${defaultSound.name})` : ""}
              </button>
            )}
            {sel.kind === "mute" ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAudio(sel.previous ?? { kind: "default" })}
              >
                <Volume2 size={16} aria-hidden="true" /> Activar sonido
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAudio({ kind: "mute", previous: sel })}
              >
                <VolumeX size={16} aria-hidden="true" /> Quitar sonido
              </button>
            )}
          </div>

          <ul className="sound-list" aria-label="Biblioteca de sonidos">
            {sel.kind === "custom" && (
              <li className="sound" data-active="true">
                <span className="sound-icon" aria-hidden="true">
                  <Folder size="1.1em" />
                </span>
                <span className="sound-main" style={{ cursor: "default" }}>
                  <span className="sound-name">{sel.name}</span>
                  <span className="sound-meta">
                    Tu audio
                    {sel.duration ? ` · ${formatDuration(sel.duration)}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={
                    sampleId === "custom"
                      ? "Detener muestra de tu audio"
                      : "Escuchar tu audio"
                  }
                  onClick={() => toggleSample("custom", sel.url)}
                >
                  <PlayIcon playing={sampleId === "custom"} />
                </button>
              </li>
            )}
            {SOUNDS.map((s) => {
              const active = activeId === s.id;
              return (
                <li key={s.id} className="sound" data-active={active}>
                  <span className="sound-icon" aria-hidden="true">
                    <Icon name={s.icon} />
                  </span>
                  <button
                    type="button"
                    className="sound-main"
                    aria-pressed={active}
                    onClick={() =>
                      setAudio(
                        s.id === template.defaultAudioId
                          ? { kind: "default" }
                          : { kind: "library", id: s.id },
                      )
                    }
                  >
                    <span className="sound-name">
                      {s.name}
                      {s.id === template.defaultAudioId && (
                        <span className="badge badge-ok">
                          De esta plantilla
                        </span>
                      )}
                      {active && <span className="badge">Elegido</span>}
                    </span>
                    <span className="sound-meta">{s.description}</span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={
                      sampleId === s.id
                        ? `Detener muestra de ${s.name}`
                        : `Escuchar muestra de ${s.name}`
                    }
                    onClick={() => toggleSample(s.id, s.file)}
                  >
                    <PlayIcon playing={sampleId === s.id} />
                  </button>
                </li>
              );
            })}
          </ul>

          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              {busy ? <span className="spinner" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}{" "}
              Subir mi propio audio
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept="audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg"
              onChange={onUpload}
              aria-label="Elegir archivo de audio"
            />
            <p className="hint">
              MP3, WAV, M4A, AAC u OGG de hasta 5 MB. Se queda solo en tu
              navegador (no se sube a ningún servidor): si cerrás la pestaña
              antes de descargar, vas a tener que volver a cargarlo. Usá solo
              música que tengas derecho a usar.
            </p>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
