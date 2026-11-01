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
import { formatArs, hasImage, hasVideo, imagePromoPrice, videoPromoPrice } from "../config/pricing";
import { StillPreview } from "./StillPreview";
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
  const [imageUrls, setImageUrls] = useState<{ png: string; jpg: string } | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const imageRef = useRef<{ png: string; jpg: string } | null>(null);
  const imageTried = useRef(false);
  const [upsellBusy, setUpsellBusy] = useState(false);
  /** con datos guardados por el servidor, todo es de solo lectura */
  const locked = info.hasSnapshot;

  useEffect(() => {
    track("generator_opened", { templateId: info.templateId });
  }, [info.templateId]);

  // al empezar a generar, baja hasta el progreso; al terminar, hasta el video y el botón de descarga
  const jobStatus = job.state.status;
  useEffect(() => {
    if (jobStatus === "running" || jobStatus === "error")
      progressRef.current?.scrollIntoView({ block: "center" });
  }, [jobStatus]);
  useEffect(() => {
    if (finalUrl) resultRef.current?.scrollIntoView({ block: "center" });
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
      setError("Completá todos los datos obligatorios antes de generar la imagen.");
      return;
    }
    setError(null);
    setImgBusy(true);
    try {
      const authorization = await requestFinalAuthorization(info.purchaseId, "image").catch((e) => {
        throw new Error(e instanceof ApiError ? e.message : "No pudimos autorizar la imagen.");
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
      markDelivered(authorization).then(() => setDelivered(true)).catch(() => setDelivered(true));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos generar la imagen.");
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
    if (!hasImage(product) || load !== "ready" || imageTried.current || !locked) return;
    imageTried.current = true;
    void generateImage();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  /** Una compra de solo imagen puede sumar el video con descuento (compra nueva con los mismos datos). */
  const addMissing = async () => {
    setUpsellBusy(true);
    setError(null);
    try {
      const { purchaseId: id, checkoutUrl } = await createPurchase(info.templateId, undefined, product === "image" ? "video" : "image", info.purchaseId);
      try {
        localStorage.setItem(PURCHASE_KEY, JSON.stringify({ purchaseId: id }));
      } catch {
        /* sin almacenamiento */
      }
      window.location.assign(checkoutUrl);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos iniciar el pago.");
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
    if (!hasVideo(product) || !autoStart || autoRan.current || load !== "ready" || needAudio) return;
    if (info.remaining < PRICING.maxFinalRenders) return;
    autoRan.current = true;
    autoDownload.current = true;
    void generate();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // las generaciones limitadas son las del video; la imagen no las consume
  const noMore = hasVideo(product) && info.remaining <= 0;
  const busy = job.isRunning || imgBusy;
  const d = state.data;

  return (
    <div className="studio">
      <div className="studio-preview">
        {load === "ready" && product === "image" ? (
          imageUrls ? (
            <div className="still-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrls.png} alt="Tu invitación en imagen, sin marca de agua" style={{ width: "100%", maxWidth: 380, borderRadius: 16, display: "block", margin: "0 auto" }} />
            </div>
          ) : (
            <StillPreview template={template} content={content} watermark={false} />
          )
        ) : load === "ready" ? (
          <LivePreview clean />
        ) : (
          <p className="alert alert-info">Cargando los datos de tu compra…</p>
        )}
        {/* 
        <p className="fine" style={{ textAlign: "center" }}>
          Esta vista no lleva marca de agua porque tu compra está confirmada.
        </p>
				 */}
      </div>
      <div className="stack">
        <div>
          <p className="eyebrow">Compra confirmada ✅</p>
          <h2 style={{ fontSize: "clamp(26px, 4.5vw, 36px)" }}>
            {product === "image" ? (imageUrls ? "Tu imagen está lista" : "Preparando tu imagen…") : product === "both" ? "Tu video y tu imagen" : "Generá tu video final"}
          </h2>
          <p className="lead" style={{ fontSize: 15 }}>
            Plantilla de tu compra: <strong>{template.name}</strong> 🔒.{" "}
            {/* 
            {locked
              ? "Los datos de tu invitación están bloqueados: se genera exactamente la que compraste."
              : "Podés completar los datos y la música; la plantilla no se puede cambiar."}
							 */}
          </p>
          {info.testMode && (
            <p className="alert alert-info" style={{ marginTop: 10 }}>
              🧪 Modo prueba local: el pago es simulado. Esto no existe en el
              sitio real.
            </p>
          )}
          <p className="status-box" aria-live="polite">
            {hasVideo(product) &&
              `Generaciones del video disponibles: ${info.remaining} de ${PRICING.maxFinalRenders}. `}{" "}
            <span className="fine" style={{ margin: 0 }}>
              Código: <code>{info.purchaseId}</code>
            </span>
          </p>
          {info.expiresAt && (
            <p className="alert alert-info">
              ⏳ Podés descargar tu video hasta el{" "}
              <strong>{dateFmt(info.expiresAt)}</strong>.
              {/* 
							Después esta compra
              vence y tus datos y tu foto se eliminan automáticamente de nuestro
              servidor.
							 */}
            </p>
          )}
        </div>

        {locked ? (
          <section className="panel" aria-labelledby="gen-title">
            <h3 id="gen-title">Tu invitación 🔒</h3>
            <dl className="summary">
              <dt>Cumpleañero/a</dt>
              <dd>
                {state.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.photo.previewUrl}
                    alt="Foto de tu compra"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      objectFit: "cover",
                      verticalAlign: "middle",
                      marginRight: 8,
                    }}
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
              {/* <dt>Música</dt>
							<dd>{resolvedAudio.kind === 'none' ? 'Sin sonido' : resolvedAudio.label}</dd> */}
            </dl>
            <p className="hint">
              Para cambiar algo hay que hacer una compra nueva.
            </p>
            {needAudio && (
              <AttachAudio
                onFile={setCustomAudio}
                attached={resolvedAudio.kind === "file"}
              />
            )}
            {(hasVideo(product) || (!imageUrls && !imgBusy && imageTried.current)) && (
            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ marginTop: 14 }}
              disabled={busy || noMore || load !== "ready"}
              onClick={() => void generate()}
            >
              {busy ? <span className="spinner" aria-hidden="true" /> : "🎬"}{" "}
              {noMore
                ? "Sin generaciones disponibles"
                : busy
                  ? "Generando…"
                  : product === "image"
                    ? "Reintentar la imagen"
                    : "Generar mi video final"}
            </button>
            )}
          </section>
        ) : (
          <>
            <section className="panel" aria-labelledby="gen-title">
              <h3 id="gen-title">Tus datos</h3>
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

        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}

        {(job.state.status === "running" || job.state.status === "error") && (
          <div className="panel" aria-busy={busy} ref={progressRef}>
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
              />
            )}
          </div>
        )}

        {imageUrls && (
          <div className="panel">
            <p className="alert alert-ok">✅ Tu imagen está lista.</p>
            {product === "both" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrls.png}
                alt="Tu invitación en imagen, sin marca de agua"
                style={{ marginTop: 12, maxWidth: 240, width: "100%", borderRadius: 12 }}
              />
            )}
            <a
              className="btn btn-primary btn-block btn-download"
              style={{ marginTop: 12 }}
              href={imageUrls.png}
              download={`invitacion-${slugify(content.name) || "cumple"}.png`}
              onClick={() => track("image_downloaded", { templateId: template.id })}
            >
              <span aria-hidden="true">⬇</span> Descargar imagen PNG · 1080×1920
            </a>
            <a
              className="btn btn-secondary btn-block"
              style={{ marginTop: 8 }}
              href={imageUrls.jpg}
              download={`invitacion-${slugify(content.name) || "cumple"}.jpg`}
              onClick={() => track("image_downloaded", { templateId: template.id })}
            >
              <span aria-hidden="true">⬇</span> Descargar en JPG (más liviana)
            </a>
          </div>
        )}

        {product === "image" && (
          <div className="panel">
            {info.videoPurchaseId ? (
              <>
                <p className="alert alert-ok">🎬 Ya sumaste el video a tu compra.</p>
                <a className="btn btn-primary btn-block" style={{ marginTop: 10 }} href={`/?compra=${encodeURIComponent(info.videoPurchaseId)}`}>
                  Ir a mi video
                </a>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>🎬 ¿Lo querés también en video?</h3>
                <p className="fine" style={{ margin: "4px 0 10px" }}>
                  Sumá el video MP4 de esta misma invitación a precio especial por haber comprado la imagen:{" "}
                  <strong>{formatArs(videoPromoPrice(PRICING))}</strong>{" "}
                  <span style={{ textDecoration: "line-through", opacity: 0.7 }}>{formatArs(PRICING.price)}</span>.
                </p>
                <button type="button" className="btn btn-secondary btn-block" disabled={upsellBusy || !info.hasSnapshot} onClick={() => void addMissing()}>
                  {upsellBusy ? <span className="spinner" aria-hidden="true" /> : "🎬"} Agregar el video por {formatArs(videoPromoPrice(PRICING))}
                </button>
              </>
            )}
          </div>
        )}

        {product === "video" && (
          <div className="panel">
            {info.imagePurchaseId ? (
              <>
                <p className="alert alert-ok">🖼 Ya sumaste la imagen a tu compra.</p>
                <a className="btn btn-primary btn-block" style={{ marginTop: 10 }} href={`/?compra=${encodeURIComponent(info.imagePurchaseId)}`}>
                  Ir a mi imagen
                </a>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>🖼 ¿La querés también en imagen?</h3>
                <p className="fine" style={{ margin: "4px 0 10px" }}>
                  Sumá la imagen 1080×1920 (PNG y JPG) de esta misma invitación a precio especial por haber comprado el video:{" "}
                  <strong>{formatArs(imagePromoPrice(PRICING))}</strong>{" "}
                  <span style={{ textDecoration: "line-through", opacity: 0.7 }}>{formatArs(PRICING.imagePrice)}</span>.
                </p>
                <button type="button" className="btn btn-secondary btn-block" disabled={upsellBusy || !info.hasSnapshot} onClick={() => void addMissing()}>
                  {upsellBusy ? <span className="spinner" aria-hidden="true" /> : "🖼"} Agregar la imagen por {formatArs(imagePromoPrice(PRICING))}
                </button>
              </>
            )}
          </div>
        )}

        {finalUrl && (
          <div className="panel" ref={resultRef}>
            <p className="alert alert-ok">
              ✅ Tu video está listo
              {delivered ? " y la entrega quedó registrada" : ""}.
            </p>
            <video
              src={finalUrl}
              controls
              playsInline
              style={{ marginTop: 12, maxWidth: 320 }}
              aria-label="Tu video final sin marca de agua"
              onLoadedMetadata={(e) =>
                setDims(
                  `${e.currentTarget.videoWidth}×${e.currentTarget.videoHeight}`,
                )
              }
            />
            <a
              className="btn btn-primary btn-block btn-download"
              style={{ marginTop: 12 }}
              href={finalUrl}
              download={`invitacion-${slugify(content.name) || "cumple"}.mp4`}
              onClick={() => track("video_downloaded", { templateId: template.id })}
            >
              <span aria-hidden="true">⬇</span> Descargar MP4
              {dims ? ` · ${dims}` : ""}
            </a>
            {/* 
            <p className="fine">
              Si la descarga no empezó sola, tocá el botón. En celular, si no se
              descarga, mantené apretado el video y guardalo. Guardá tu código
              de compra: te sirve para volver a este generador hasta el
              vencimiento.
            </p>
						 */}
          </div>
        )}

        <button type="button" className="btn btn-ghost" onClick={onExit}>
          ← Salir del generador
        </button>
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
