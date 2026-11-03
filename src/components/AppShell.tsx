"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useInvitation, type Step } from "../state/InvitationProvider";
import { InvitationForm } from "./InvitationForm";
import { TemplateGallery } from "./TemplateGallery";
import { LivePreview } from "./LivePreview";
import { Studio } from "./Studio";
import { ProcessingScreen } from "./ProcessingScreen";
import { OfferPanel } from "./OfferPanel";
import { RecoverPurchase } from "./RecoverPurchase";
import { PurchasedGenerator } from "./PurchasedGenerator";
import type { PurchaseInfo } from "../client/purchases";
import { useExportJob } from "../hooks/useExportJob";
import { exportPreview } from "../render/exporter";
import { checkSupport, isMobileDevice } from "../render/engine";
import { track } from "../lib/analytics";
import { ConsentBanner } from "./ConsentBanner";
import { useSiteConfig } from "../state/SiteConfig";
import { TEMPLATE_PATH, templateSeo, templateSlug } from "../lib/seo";
import {
  Check,
  Info,
  Music,
  PartyPopper,
  VolumeX,
  WandSparkles,
} from "lucide-react";

const STEPS: { label: string; steps: Step[] }[] = [
  { label: "Personalizar", steps: ["form"] },
  { label: "Revisar", steps: ["studio", "processing"] },
  { label: "Pagar", steps: ["offer", "generator"] },
];

const MIN_PROCESSING_MS = 5000;

/** Entrada directa a una plantilla (/invitacion/...): se ve solo su vista previa, sin galería. */
function DirectPreview() {
  const { template } = useInvitation();
  return (
    <section
      className="direct-preview"
      aria-label={`Vista previa de ${template.name}`}
    >
      <LivePreview sample />
      <p className="fine direct-note">
        Vista de ejemplo con datos de muestra: cargá los tuyos y se actualiza.{" "}
        <a href="/">Ver otros diseños</a>
      </p>
    </section>
  );
}

/**
 * Solo en pantallas angostas: tras elegir un diseño, la ficha de datos queda varias pantallas más abajo.
 * Esta barra confirma la elección y lleva al formulario; se oculta cuando el formulario ya está a la vista.
 */
function ContinueBar({ name }: { name: string }) {
  const [formVisible, setFormVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById("form-card");
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setFormVisible(e.isIntersecting),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const go = () => {
    const el = document.getElementById("form-card");
    if (!el) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    window.setTimeout(
      () =>
        el
          .querySelector<HTMLInputElement>("input[type=text]")
          ?.focus({ preventScroll: true }),
      reduce ? 0 : 450,
    );
  };
  return (
    <div
      className="continue-bar"
      data-hidden={formVisible ? "true" : undefined}
    >
      <span className="continue-name">
        <small>Diseño elegido</small>
        <strong>{name}</strong>
      </span>
      <button type="button" className="btn btn-primary" onClick={go}>
        Cargar mis datos
      </button>
    </div>
  );
}

/** Pregunta por el sonido antes de entrar a la vista previa: sin cierre por fuera, sin cruz ni Esc; hay que elegir una opción. */
function SoundPrompt({ onChoose }: { onChoose: (sound: boolean) => void }) {
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
        aria-labelledby="sound-title"
        aria-describedby="sound-text"
        onKeyDown={trap}
      >
        <h2 id="sound-title">¿Ponemos música?</h2>
        <p id="sound-text">
          Tenemos una canción preparada para esta invitación.
        </p>
        <button
          ref={first}
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => onChoose(true)}
        >
          <Music size={18} aria-hidden="true" /> Sí, con música
        </button>
        <button
          ref={second}
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => onChoose(false)}
        >
          <VolumeX size={18} aria-hidden="true" /> Prefiero en silencio
        </button>
      </div>
    </div>
  );
}

export function AppShell({
  intro,
}: {
  intro?: { title: string; text: string };
}) {
  const { state, template, content, resolvedAudio, goto, setPreview } =
    useInvitation();
  const job = useExportJob();
  const { config } = useSiteConfig();
  const [askSound, setAskSound] = useState(false);
  const [studioSound, setStudioSound] = useState(false);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<PurchaseInfo | null>(null);
  /** true solo al volver del pago de Mercado Pago: el generador arranca solo, una única vez */
  const [autoStart, setAutoStart] = useState(false);
  const onApproved = useCallback(
    (info: PurchaseInfo) => {
      setPurchase(info);
      goto("generator");
    },
    [goto],
  );

  // título de la pestaña y URL propios de la plantilla, pero recién al apretar "Ver mi invitación"
  // (elegir una tarjeta en la galería no cambia la dirección)
  const baseTitle = useRef<string | null>(null);
  useEffect(() => {
    baseTitle.current = document.title;
  }, []);
  useEffect(() => {
    if (state.step === "studio") {
      const ov = config.templates[template.id];
      document.title = templateSeo(template, ov).title;
      window.history.replaceState(
        null,
        "",
        `${TEMPLATE_PATH}/${templateSlug(template, ov)}`,
      );
    } else if (
      state.step === "form" &&
      !intro &&
      window.location.pathname.startsWith(TEMPLATE_PATH)
    ) {
      // al volver del estudio a la galería, la dirección vuelve al inicio
      window.history.replaceState(null, "", "/");
      if (baseTitle.current) document.title = baseTitle.current;
    }
  }, [state.templateSeq, state.step, template, config.templates, intro]);

  useEffect(() => {
    if (state.hydrated) track("page_view");
  }, [state.hydrated]);

  // Al volver de Mercado Pago (?compra=...) o con una compra guardada
  useEffect(() => {
    if (!state.hydrated) return;
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("compra");
    if (fromUrl) {
      // el parámetro solo indica QUÉ compra consultar; el estado real lo confirma el servidor
      setPurchaseId(fromUrl);
      setAutoStart(true);
      goto("offer");
      url.searchParams.delete("compra");
      [
        "collection_id",
        "collection_status",
        "payment_id",
        "status",
        "external_reference",
        "payment_type",
        "merchant_order_id",
        "preference_id",
        "site_id",
        "processing_mode",
        "merchant_account_id",
      ].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState(null, "", url.pathname + (url.search || ""));
    }
  }, [state.hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [state.step]);

  const previewLock = useRef(false);
  const generatePreview = async () => {
    if (previewLock.current) return;
    previewLock.current = true;
    try {
      await runPreview();
    } finally {
      previewLock.current = false;
    }
  };
  const runPreview = async () => {
    const sup = checkSupport();
    track("preview_started", { templateId: template.id });
    // una compra nueva nunca hereda el código de una anterior (otra plantilla = otra compra)
    setPurchaseId(null);
    setPurchase(null);
    goto("processing");
    // tiempo real del render (sin la espera mínima de la pantalla), para Analytics/Clarity
    let renderMs = 0;
    const blob = await job.start(
      async ({ signal, onProgress }) => {
        const t0 = performance.now();
        const out = await exportPreview({
          template,
          content,
          audio: resolvedAudio,
          signal,
          onProgress,
        });
        renderMs = performance.now() - t0;
        return out;
      },
      MIN_PROCESSING_MS,
      sup.ok ? (sup.warning ?? null) : null,
    );
    if (blob) {
      track("preview_ready", {
        templateId: template.id,
        renderMs,
        device: isMobileDevice() ? "mobile" : "desktop",
      });
      setPreview({
        url: URL.createObjectURL(blob),
        blob,
        templateId: template.id,
      });
      // la pantalla de proceso muestra "¡Tu video está listo!" y pasa a la oferta con su botón
    }
  };

  const cancelProcessing = () => {
    job.cancel();
    goto("studio");
  };

  const currentIdx = STEPS.findIndex((s) => s.steps.includes(state.step));
  const progressPct = Math.round(((currentIdx + 1) / STEPS.length) * 100);

  return (
    <>
      <header className="app-header">
        <button
          type="button"
          className="brand"
          onClick={() => window.location.assign("/")}
          aria-label="Ir al inicio"
        >
          <span className="brand-mark" aria-hidden="true">
            <PartyPopper size={22} />
          </span>
          AltaParty
        </button>
        {state.step === "studio" && (
          <span className="hdr-note">
            <Info size={14} aria-hidden="true" /> Podés cambiar los datos
            después
          </span>
        )}
        <nav aria-label="Progreso" className="wizard-nav">
          <p className="step-caption" aria-hidden="true">
            <span>
              Paso {currentIdx + 1} de {STEPS.length}
            </span>
            <strong>{STEPS[currentIdx]?.label}</strong>
          </p>
          <ol className="stepper">
            {STEPS.map((s, i) => (
              <li
                key={s.label}
                aria-current={i === currentIdx ? "step" : undefined}
                data-done={i < currentIdx ? "true" : undefined}
              >
                <span className="num">{i < currentIdx ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : i + 1}</span>
                <span className="label">{s.label}</span>
              </li>
            ))}
          </ol>
        </nav>
        <div className="wizard-progress" aria-hidden="true">
          <span style={{ width: `${progressPct}%` }} />
        </div>
      </header>

      <main data-step={state.step}>
        {state.step === "form" && (
          <div className="home">
            <div className="home-intro">
              {intro ? (
                <h1>
                  {state.templateSeq === 0
                    ? intro.title
                    : `Invitación de cumpleaños «${template.name}» en video`}
                </h1>
              ) : (
                <h1>
                  Tu invitación animada, <em>lista en minutos</em>
                </h1>
              )}
              <p className="lead">
                {intro ? `${intro.text} ` : ""}
                <span className="lead-long">
                  Elegí un diseño, personalizalo con tus datos y tu foto, cambiá
                  la música y descargá un video MP4 listo para compartir por
                  WhatsApp.
                </span>
                <span className="lead-short">
                  Elegí un diseño y personalizalo con tus datos.
                </span>
              </p>
            </div>
            <div className="home-grid">
              {intro ? <DirectPreview /> : <TemplateGallery />}
              <aside className="home-form" aria-labelledby="form-title">
                {/* <p aria-hidden="true">¡Completá los datos y creá tu invitación!</p> */}
                <div className="form-card" id="form-card">
                  <h2 id="form-title" className="sr-only">
                    Personalizá tu invitación
                  </h2>
                  <p className="hint swap-in" key={template.id}>
                    Diseño elegido: <strong>{template.name}</strong>. Tu foto no
                    sale de tu dispositivo hasta que comprás.
                  </p>
                  <InvitationForm
                    submitLabel="Personalizar mi invitación"
                    submitIcon={<WandSparkles size={22} aria-hidden="true" />}
                    onSubmit={() => {
                      setAskSound(true);
                      goto("studio");
                    }}
                  />
                </div>
              </aside>
            </div>
            <RecoverPurchase
              onFound={(info) => {
                setPurchaseId(info.purchaseId);
                onApproved(info);
              }}
            />
            {(state.templateSeq > 0 || intro) && (
              <ContinueBar name={template.name} />
            )}
          </div>
        )}

        {state.step === "studio" && (
          <Studio
            initialSound={studioSound}
            hold={askSound}
            onGenerate={generatePreview}
            onGallery={() => goto("form")}
            generating={job.isRunning}
          />
        )}

        {state.step === "processing" && (
          <ProcessingScreen
            job={job.state}
            hasAudio={resolvedAudio.kind !== "none"}
            onView={() => {
              goto("offer");
              job.reset();
            }}
            onRetry={generatePreview}
            onCancel={cancelProcessing}
            onSkip={() => {
              job.cancel();
              goto("offer");
            }}
          />
        )}

        {state.step === "offer" && (
          <OfferPanel
            purchaseId={purchaseId}
            onPurchaseId={setPurchaseId}
            onApproved={onApproved}
            onBack={() => goto("studio")}
          />
        )}
        {state.step === "generator" && purchase && (
          <PurchasedGenerator
            info={purchase}
            onInfo={setPurchase}
            autoStart={autoStart}
            onExit={() => {
              setAutoStart(false);
              setPurchaseId(null);
              setPurchase(null);
              goto("form");
            }}
          />
        )}
      </main>

      {askSound && (
        <SoundPrompt
          onChoose={(on) => {
            setStudioSound(on);
            setAskSound(false);
          }}
        />
      )}
      <ConsentBanner />
      <footer className="site-footer">
        <p>
          Las plantillas son diseños originales inspirados en temáticas
          populares; no son productos oficiales ni están afiliadas a ninguna
          marca.
        </p>
        <p>
          <a href="/preguntas-frecuentes">Preguntas frecuentes</a>
        </p>
      </footer>
    </>
  );
}
