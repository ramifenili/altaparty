"use client";

import React, { useCallback, useEffect, useState } from "react";
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

const STEPS: { label: string; steps: Step[] }[] = [
  { label: "Diseño y datos", steps: ["form"] },
  { label: "Vista previa", steps: ["studio", "processing"] },
  { label: "Compra", steps: ["offer", "generator"] },
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
        Cargar mis datos →
      </button>
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

  // al elegir una plantilla: título de la pestaña y URL propios de esa plantilla (se puede compartir y se indexa)
  useEffect(() => {
    if (
      state.templateSeq === 0 ||
      (state.step !== "form" && state.step !== "studio")
    )
      return;
    const ov = config.templates[template.id];
    document.title = templateSeo(template, ov).title;
    window.history.replaceState(
      null,
      "",
      `${TEMPLATE_PATH}/${templateSlug(template, ov)}`,
    );
  }, [state.templateSeq, state.step, template, config.templates]);

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

  const generatePreview = async () => {
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
      goto("offer");
      job.reset();
    }
  };

  const cancelProcessing = () => {
    job.cancel();
    goto("studio");
  };

  const currentIdx = STEPS.findIndex((s) => s.steps.includes(state.step));

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
            🎉
          </span>
          AltaParty
        </button>
        {/* <a className="btn btn-secondary btn-sm" href="/gratis">
          🎁 <span className="hide-xs">Conseguilo&nbsp;</span>gratis
        </a> */}
        {state.step === "studio" && (
          <span className="hdr-note">ⓘ Podés cambiar los datos después</span>
        )}
        <nav aria-label="Progreso">
          <ol className="stepper">
            {STEPS.map((s, i) => (
              <li
                key={s.label}
                aria-current={i === currentIdx ? "step" : undefined}
                data-done={i < currentIdx ? "true" : undefined}
              >
                <span className="num">{i < currentIdx ? "✓" : i + 1}</span>
                <span className="label">{s.label}</span>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <main>
        {state.step === "form" && (
          <div className="home">
            <div className="home-intro">
              <p className="eyebrow">Invitaciones de cumpleaños en video</p>
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
                {intro ? `${intro.text} ` : ""}Elegí un diseño, personalizalo
                con tus datos y tu foto, cambiá la música y descargá un MP4
                listo para compartir por WhatsApp.
              </p>
              <ul className="checks" aria-label="Beneficios">
                <li>Sin instalar nada</li>
                <li>MP4 para WhatsApp</li>
                <li>Tu foto queda en tu dispositivo hasta que comprás</li>
              </ul>
            </div>
            <div className="home-grid">
              {intro ? <DirectPreview /> : <TemplateGallery />}
              <aside className="home-form" aria-labelledby="form-title">
                {/* <p aria-hidden="true">¡Completá los datos y creá tu invitación!</p> */}
                <div className="form-card" id="form-card">
                  <div className="steps-bar" aria-hidden="true">
                    <i data-on="true" />
                    <i data-on="true" />
                    <i />
                  </div>
                  <p className="eyebrow">Paso 2 de 3</p>
                  <h2 id="form-title">Personalizá tu invitación</h2>
                  <p className="hint">
                    Diseño elegido: <strong>{template.name}</strong>. Después
                    podés cambiarlo sin volver a cargar nada.
                  </p>
                  <InvitationForm
                    submitLabel="Ver mi invitación →"
                    onSubmit={() => goto("studio")}
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
            onGenerate={generatePreview}
            onGallery={() => goto("form")}
            generating={job.isRunning}
          />
        )}

        {state.step === "processing" && (
          <ProcessingScreen
            job={job.state}
            onRetry={generatePreview}
            onCancel={cancelProcessing}
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
