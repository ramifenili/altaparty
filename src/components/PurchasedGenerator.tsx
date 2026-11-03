"use client";

import React, { useEffect, useRef, useState } from "react";
import { useInvitation } from "../state/InvitationProvider";
import { useSiteConfig } from "../state/SiteConfig";
import { formatLongDate, validateInvitation } from "../domain/invitation";
import {
  ApiError,
  createPurchase,
  fetchSnapshot,
  markDelivered,
  requestFinalAuthorization,
  verifyAuthorizationWithServer,
  type PurchaseInfo,
} from "../client/purchases";
import { exportFinal } from "../render/exporter";
import { renderStill } from "../render/still";
import {
  formatArs,
  hasImage,
  hasVideo,
  imagePromoPrice,
  videoPromoPrice,
} from "../config/pricing";
import { PreviewTabs, StillPreview } from "./StillPreview";
import { useIsAdmin } from "./AdminMlImages";
import { PURCHASE_KEY } from "./OfferPanel";
import { checkSupport, isMobileDevice } from "../render/engine";
import { dataUrlToFile, validateAudioFile } from "../render/assets";
import { useExportJob } from "../hooks/useExportJob";
import { track } from "../lib/analytics";
import { slugify } from "../lib/seo";
import type { AudioSelection } from "../audio/library";
import { getSound } from "../audio/library";
import { LivePreview } from "./LivePreview";
import { InvitationForm } from "./InvitationForm";
import { AudioPicker } from "./AudioPicker";
import { ProgressView } from "./ProgressView";

const dateFmt = (ms: number) =>
  new Date(ms).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/**
 * Generador de una compra ya aprobada. Si el servidor guardó lo que se compró, los datos, la foto
 * y la música se muestran BLOQUEADOS (de solo lectura): solo se puede descargar el mismo video.
 * La plantilla es siempre la comprada. El video sale sin marca de agua solo con la autorización
 * que firma el servidor, con un máximo de generaciones por compra y hasta el vencimiento.
 */
export function PurchasedGenerator({
  info,
  onInfo,
  onExit,
  autoStart = false,
}: {
  info: PurchaseInfo;
  onInfo: (i: PurchaseInfo) => void;
  onExit: () => void;
  autoStart?: boolean;
}) {
  const {
    state,
    content,
    resolvedAudio,
    setTemplate,
    applyPurchased,
    setCustomAudio,
  } = useInvitation();
  const { getTemplate, config } = useSiteConfig();
  const PRICING = config.pricing;
  const template = getTemplate(info.templateId);
  const job = useExportJob();
  const admin = useIsAdmin();
  const [error, setError] = useState<string | null>(null);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [delivered, setDelivered] = useState(false);
  const [load, setLoad] = useState<"loading" | "ready" | "error">(
    info.hasSnapshot ? "loading" : "ready",
  );
  const [needAudio, setNeedAudio] = useState(false);
  const urlRef = useRef<string | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const autoRan = useRef(false);
  const autoDownload = useRef(false);
  const [dims, setDims] = useState<string | null>(null);
  // la imagen 1080×1920 (si la compra la incluye)
  const product = info.product ?? "video";
  // la imagen se entrega en PNG (sin pérdida) y también en JPG (más liviana)
  const [imageUrls, setImageUrls] = useState<{
    png: string;
    jpg: string;
  } | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const imageRef = useRef<{ png: string; jpg: string } | null>(null);
  const imageTried = useRef(false);
  const [upsellBusy, setUpsellBusy] = useState(false);
  const [view, setView] = useState<"video" | "image">(
    hasVideo(product) ? "video" : "image",
  );
  /** con datos guardados por el servidor, todo es de solo lectura */
  const locked = info.hasSnapshot;

  useEffect(() => {
    track("generator_opened", { templateId: info.templateId });
  }, [info.templateId]);

  // al empezar a generar, baja hasta el progreso; al terminar, hasta el video y el botón de descarga
  const jobStatus = job.state.status;
  useEffect(() => {
    if (jobStatus === "running" || jobStatus === "error")
      progressRef.current?.scrollIntoView({ block: "nearest" });
  }, [jobStatus]);
  useEffect(() => {
    if (finalUrl) resultRef.current?.scrollIntoView({ block: "nearest" });
  }, [finalUrl]);

  // la plantilla de la compra es la única que se puede usar
  useEffect(() => {
    if (state.templateId !== info.templateId) setTemplate(info.templateId);
  }, [state.templateId, info.templateId, setTemplate]);
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      if (imageRef.current) {
        URL.revokeObjectURL(imageRef.current.png);
        URL.revokeObjectURL(imageRef.current.jpg);
      }
    },
    [],
  );

  // trae lo que se compró y lo aplica (reemplaza lo que hubiera en el navegador)
  useEffect(() => {
    if (!info.hasSnapshot) return;
    let alive = true;
    (async () => {
      try {
        const s = await fetchSnapshot(info.purchaseId);
        if (!alive) return;
        if (!s.snapshot) {
          setLoad("ready");
          return;
        }
        const a = s.snapshot.audio;
        const audio: AudioSelection =
          a.kind === "mute"
            ? { kind: "mute" }
            : a.kind === "library" && a.id && getSound(a.id)
              ? { kind: "library", id: a.id }
              : { kind: "default" };
        setNeedAudio(a.kind === "custom");
        await applyPurchased(
          s.snapshot.data,
          audio,
          s.photo ? await dataUrlToFile(s.photo, "foto.jpg") : null,
        );
        if (alive) setLoad("ready");
      } catch (e) {
        if (alive) {
          setError(
            e instanceof ApiError
              ? e.message
              : "No pudimos cargar los datos de tu compra.",
          );
          setLoad("error");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [info.purchaseId, info.hasSnapshot, applyPurchased]);

  /** Genera la imagen (PNG y JPG) 1080×1920 sin marca de agua (con autorización del servidor, igual que el video). */
  const generateImage = async () => {
    if (Object.keys(validateInvitation(state.data, new Date(0))).length) {
      setError(
        "Completá todos los datos obligatorios antes de generar la imagen.",
      );
      return;
    }
    setError(null);
    setImgBusy(true);
    try {
      const authorization = await requestFinalAuthorization(
        info.purchaseId,
        "image",
      ).catch((e) => {
        throw new Error(
          e instanceof ApiError ? e.message : "No pudimos autorizar la imagen.",
        );
      });
      await verifyAuthorizationWithServer(authorization);
      const blobs = await renderStill(template, content, { watermark: false });
      if (imageRef.current) {
        URL.revokeObjectURL(imageRef.current.png);
        URL.revokeObjectURL(imageRef.current.jpg);
      }
      const url = URL.createObjectURL(blobs.png);
      imageRef.current = { png: url, jpg: URL.createObjectURL(blobs.jpg) };
      setImageUrls(imageRef.current);
      track("image_ready", { templateId: template.id });
      markDelivered(authorization)
        .then(() => setDelivered(true))
        .catch(() => setDelivered(true));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos generar la imagen.",
      );
    } finally {
      setImgBusy(false);
    }
  };

  /** Genera lo que incluye la compra. La imagen sale sola al abrir el generador; el botón genera el video. */
  const generate = async () => {
    if (!hasVideo(product)) return generateImage();
    await generateVideo();
    if (hasImage(product) && !imageRef.current) await generateImage();
  };

  // la imagen se genera apenas se cargan los datos de la compra (no hace falta apretar nada): queda lista para descargar
  useEffect(() => {
    if (!hasImage(product) || load !== "ready" || imageTried.current || !locked)
      return;
    imageTried.current = true;
    void generateImage();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  /** Una compra de solo imagen puede sumar el video con descuento (compra nueva con los mismos datos). */
  const addMissing = async () => {
    setUpsellBusy(true);
    setError(null);
    try {
      const { purchaseId: id, checkoutUrl } = await createPurchase(
        info.templateId,
        undefined,
        product === "image" ? "video" : "image",
        info.purchaseId,
      );
      try {
        localStorage.setItem(PURCHASE_KEY, JSON.stringify({ purchaseId: id }));
      } catch {
        /* sin almacenamiento */
      }
      window.location.assign(checkoutUrl);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "No pudimos iniciar el pago.",
      );
      setUpsellBusy(false);
    }
  };

  const generateVideo = async () => {
    if (Object.keys(validateInvitation(state.data, new Date(0))).length) {
      setError(
        "Completá todos los datos obligatorios antes de generar el video.",
      );
      return;
    }
    if (needAudio && resolvedAudio.kind !== "file") {
      setError(
        "Tu compra usó un audio propio que no guardamos. Volvé a subirlo para generar el video igual que el original.",
      );
      return;
    }
    const sup = checkSupport();
    if (!sup.ok) return setError(sup.reason);
    setError(null);
    setDelivered(false);
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      setFinalUrl(null);
    }
    track("final_started", { templateId: template.id });
    const blob = await job.start(
      async ({ signal, onProgress }) => {
        // el servidor vuelve a consultar el pago y descuenta una generación antes de firmar
        let authorization;
        try {
          authorization = await requestFinalAuthorization(info.purchaseId);
        } catch (e) {
          throw new Error(
            e instanceof ApiError
              ? e.message
              : "No pudimos autorizar la descarga.",
          );
        }
        if (authorization.remaining !== undefined)
          onInfo({ ...info, remaining: authorization.remaining });
        const out = await exportFinal({
          template,
          content,
          audio: resolvedAudio,
          authorization,
          signal,
          onProgress,
        });
        // "entregado" solo después de que el render terminó bien
        markDelivered(authorization)
          .then(() => setDelivered(true))
          .catch(() => setDelivered(true));
        return out;
      },
      0,
      sup.warning ?? null,
    );
    if (blob) {
      track("final_ready", { templateId: template.id });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setDims(null);
      setFinalUrl(url);
      // en computadora la descarga empieza sola, salvo que la compra incluya la imagen (ahí se descarga con el botón);
      // en celular queda el botón (muchos navegadores bloquean la automática)
      if (autoDownload.current && !hasImage(product) && !isMobileDevice()) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `invitacion-${slugify(content.name) || "cumple"}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        track("video_downloaded", { templateId: template.id });
      }
    }
  };

  // al volver del pago genera solo, una única vez; recuperar una compra con el código no consume generaciones
  useEffect(() => {
    if (
      !hasVideo(product) ||
      !autoStart ||
      autoRan.current ||
      load !== "ready" ||
      needAudio
    )
      return;
    if (info.remaining < PRICING.maxFinalRenders) return;
    autoRan.current = true;
    autoDownload.current = true;
    void generate();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // las generaciones limitadas son las del video; la imagen no las consume
  const noMore = hasVideo(product) && info.remaining <= 0;
  const busy = job.isRunning || imgBusy;
  const d = state.data;
  const fileBase = `invitacion-${slugify(content.name) || "cumple"}`;
  const showImage =
    product === "image" || (product === "both" && view === "image");
  const title =
    product === "image"
      ? imageUrls
        ? "Tu imagen está lista"
        : "Preparando tu imagen…"
      : product === "both"
        ? "Tu video y tu imagen"
        : finalUrl
          ? "Tu video está listo"
          : "Generá tu video final";
  const chip = showImage
    ? imageUrls
      ? { ok: true, text: "Tu imagen está lista." }
      : {
          ok: false,
          text: imgBusy ? "Generando tu imagen…" : "Tu compra está confirmada.",
        }
    : finalUrl
      ? {
          ok: true,
          text: delivered
            ? "Tu video está listo y la entrega quedó registrada."
            : "Tu video está listo.",
        }
      : job.isRunning
        ? { ok: false, text: "Generando tu video…" }
        : load === "loading"
          ? { ok: false, text: "Cargando los datos de tu compra…" }
          : { ok: false, text: "Tu compra está confirmada." };
  const showGenerate =
    hasVideo(product) || (!imageUrls && !imgBusy && imageTried.current);
  const generateLabel = noMore
    ? "Sin generaciones disponibles"
    : busy
      ? "Generando tu video…"
      : product === "image"
        ? "Reintentar la imagen"
        : finalUrl
          ? "Generar de nuevo"
          : "Generar mi video final";

  return (
    <div className="final">
      <section className="final-card final-media" aria-labelledby="final-title">
        <h1 id="final-title" className="sr-only">
          {title}
        </h1>
        <p
          className={`final-chip${chip.ok ? " ok" : ""}`}
          role="status"
          aria-live="polite"
        >
          {chip.ok ? (
            <span className="chip-ico" aria-hidden="true">
              ✓
            </span>
          ) : busy ? (
            <span className="spinner" aria-hidden="true" />
          ) : null}
          {chip.text}
        </p>
        {/* mientras se ve la vista en vivo, las pestañas Video | Imagen son las de esa vista */}
        {product === "both" && (showImage || finalUrl) && (
          <PreviewTabs mode={view} onChange={setView} />
        )}
        <div className="final-stage">
          {load !== "ready" ? (
            <p className="alert alert-info">Cargando los datos de tu compra…</p>
          ) : showImage ? (
            imageUrls ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="final-img"
                src={imageUrls.png}
                alt="Tu invitación en imagen, sin marca de agua"
              />
            ) : (
              <StillPreview
                template={template}
                content={content}
                watermark={false}
              />
            )
          ) : finalUrl ? (
            <video
              className="final-video"
              src={finalUrl}
              controls
              playsInline
              aria-label="Tu video final sin marca de agua"
              onLoadedMetadata={(e) =>
                setDims(
                  `${e.currentTarget.videoWidth}×${e.currentTarget.videoHeight}`,
                )
              }
            />
          ) : (
            <LivePreview clean />
          )}
        </div>
        <p className="final-cap">
          {showImage
            ? "Imagen vertical · 1080×1920"
            : finalUrl
              ? `Video MP4 vertical${dims ? ` · ${dims}` : ""}`
              : "Vista previa en vivo, sin marca de agua"}
        </p>
      </section>

      <div className="final-side">
        <div className="final-col">
        {locked ? (
          <section
            className="final-card final-summary"
            aria-labelledby="gen-title"
          >
            <h2 id="gen-title">
              <span aria-hidden="true">⏳</span> Tu invitación{" "}
              <span aria-hidden="true">🔒</span>
            </h2>
            <p className="final-sub">
              Plantilla: <strong>{template.name}</strong>
            </p>
            <dl className="final-dl">
              <dt>Cumpleañero/a</dt>
              <dd>
                {state.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="final-avatar"
                    src={state.photo.previewUrl}
                    alt="Foto de tu compra"
                  />
                )}
                {content.name}, {content.age} años
              </dd>
              <dt>Fecha</dt>
              <dd>{formatLongDate(d.date)}</dd>
              <dt>Horario</dt>
              <dd>{content.time}</dd>
              <dt>Lugar</dt>
              <dd>{content.venue}</dd>
              <dt>Dirección</dt>
              <dd>{content.address}</dd>
            </dl>
            {needAudio && (
              <AttachAudio
                onFile={setCustomAudio}
                attached={resolvedAudio.kind === "file"}
              />
            )}
          </section>
        ) : (
          <>
            <section className="final-card" aria-labelledby="gen-title">
              <h2 id="gen-title">Tus datos</h2>
              <InvitationForm
                submitLabel={
                  noMore
                    ? "Sin generaciones disponibles"
                    : busy
                      ? "Generando…"
                      : product === "image"
                        ? "🖼 Generar mi imagen"
                        : "🎬 Generar mi video final"
                }
                onSubmit={() => void generate()}
              />
            </section>
            <AudioPicker />
          </>
        )}

        </div>
        <div className="final-col">
        {(job.state.status === "running" || job.state.status === "error") && (
          <section
            className="final-card final-progress"
            aria-busy={busy}
            ref={progressRef}
          >
            {job.state.warning && (
              <p className="alert alert-info">{job.state.warning}</p>
            )}
            {job.state.status === "error" ? (
              <p className="alert alert-error" role="alert">
                {job.state.error}
              </p>
            ) : (
              <ProgressView
                job={job.state}
                finalLabel="Preparando tu descarga..."
                title={hasVideo(product) ? "Generando tu video…" : "Generando…"}
              />
            )}
            {admin && job.state.status === "running" && (
              <button type="button" className="admin-chip" onClick={job.cancel}>
                ⏭ Saltear generación (admin)
              </button>
            )}
          </section>
        )}

        <section
          className="final-card final-deliver"
          aria-label="Descargas"
          ref={resultRef}
        >
          {error && (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          )}
          {finalUrl && (
            <a
              className="btn btn-primary btn-block btn-download"
              href={finalUrl}
              download={`${fileBase}.mp4`}
              onClick={() =>
                track("video_downloaded", { templateId: template.id })
              }
            >
              <span aria-hidden="true">⬇</span> Descargar video MP4
              {dims ? ` · ${dims}` : ""}
            </a>
          )}
          {imageUrls && (
            <div className={finalUrl ? "dl-row" : "dl-stack"}>
              <a
                className={`btn btn-block ${finalUrl ? "btn-secondary" : "btn-primary btn-download"}`}
                href={imageUrls.png}
                download={`${fileBase}.png`}
                onClick={() =>
                  track("image_downloaded", { templateId: template.id })
                }
              >
                <span aria-hidden="true">⬇</span> Imagen PNG
                {finalUrl ? "" : " · 1080×1920"}
              </a>
              <a
                className="btn btn-secondary btn-block"
                href={imageUrls.jpg}
                download={`${fileBase}.jpg`}
                onClick={() =>
                  track("image_downloaded", { templateId: template.id })
                }
              >
                <span aria-hidden="true">⬇</span>{" "}
                {finalUrl ? "Imagen JPG" : "Descargar en JPG (más liviana)"}
              </a>
            </div>
          )}
          {showGenerate && (
            <button
              type="button"
              className={`btn btn-block ${finalUrl ? "btn-ghost" : "btn-primary btn-download"}`}
              disabled={busy || noMore || load !== "ready"}
              onClick={() => void generate()}
            >
              {busy ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <span aria-hidden="true">{finalUrl ? "↻" : "🎬"}</span>
              )}{" "}
              {generateLabel}
            </button>
          )}
          {!finalUrl && !imageUrls && !showGenerate && (
            <p className="final-wait">Estamos preparando tus archivos…</p>
          )}
        </section>

        {product !== "both" && (
          <section className="final-upsell" aria-label="Completar la compra">
            {product === "image" ? (
              info.videoPurchaseId ? (
                <>
                  <span>🎬 Ya sumaste el video a tu compra.</span>
                  <a
                    className="btn btn-secondary btn-sm"
                    href={`/?compra=${encodeURIComponent(info.videoPurchaseId)}`}
                  >
                    Ir a mi video
                  </a>
                </>
              ) : (
                <>
                  <span>
                    <strong>🎬 ¿Lo querés también en video?</strong> Sumalo por{" "}
                    <strong>{formatArs(videoPromoPrice(PRICING))}</strong>{" "}
                    <s>{formatArs(PRICING.price)}</s>
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={upsellBusy || !info.hasSnapshot}
                    onClick={() => void addMissing()}
                  >
                    {upsellBusy ? (
                      <span className="spinner" aria-hidden="true" />
                    ) : (
                      "Agregar"
                    )}
                  </button>
                </>
              )
            ) : info.imagePurchaseId ? (
              <>
                <span>🖼 Ya sumaste la imagen a tu compra.</span>
                <a
                  className="btn btn-secondary btn-sm"
                  href={`/?compra=${encodeURIComponent(info.imagePurchaseId)}`}
                >
                  Ir a mi imagen
                </a>
              </>
            ) : (
              <>
                <span>
                  <strong>🖼 ¿La querés también en imagen?</strong> PNG y JPG
                  1080×1920 por{" "}
                  <strong>{formatArs(imagePromoPrice(PRICING))}</strong>{" "}
                  <s>{formatArs(PRICING.imagePrice)}</s>
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={upsellBusy || !info.hasSnapshot}
                  onClick={() => void addMissing()}
                >
                  {upsellBusy ? (
                    <span className="spinner" aria-hidden="true" />
                  ) : (
                    "Agregar"
                  )}
                </button>
              </>
            )}
          </section>
        )}

        </div>
        <footer className="final-meta">
          <p>
            <span aria-hidden="true">✅</span> Compra confirmada · Código{" "}
            <code>{info.purchaseId}</code>
            {hasVideo(product) && (
              <>
                {" "}
                · Generaciones del video: {info.remaining} de{" "}
                {PRICING.maxFinalRenders}
              </>
            )}
            {info.expiresAt && (
              <>
                {" "}
                · Podés descargar hasta el{" "}
                <strong>{dateFmt(info.expiresAt)}</strong>
              </>
            )}
          </p>
          {info.testMode && <p>🧪 Modo prueba local: el pago es simulado.</p>}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onExit}
          >
            ← Salir del generador
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Cuando la compra usó un audio propio (que no se guarda), hay que volver a adjuntarlo. */
function AttachAudio({
  onFile,
  attached,
}: {
  onFile: (f: File) => Promise<void>;
  attached: boolean;
}) {
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="alert alert-info" style={{ marginTop: 12 }}>
      <p style={{ margin: 0 }}>
        🎵 Tu compra usó un audio propio. Por privacidad no lo guardamos:{" "}
        {attached
          ? "ya lo adjuntaste."
          : "volvé a subir el mismo archivo (MP3, WAV, M4A, AAC u OGG, máx. 5 MB)."}
      </p>
      <input
        type="file"
        accept="audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg"
        aria-label="Adjuntar de nuevo tu audio"
        style={{ marginTop: 8 }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const v = validateAudioFile(f);
          if (v) return setErr(v);
          try {
            setErr(null);
            await onFile(f);
          } catch (x) {
            setErr(
              x instanceof Error ? x.message : "No pudimos cargar el audio.",
            );
          }
        }}
      />
      {err && <p className="error-text">{err}</p>}
    </div>
  );
}
