"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useInvitation } from "../state/InvitationProvider";
import {
  formatArs,
  hasImage,
  hasVideo,
  priceOf,
  videoPromoPrice,
  type Product,
} from "../config/pricing";
import { useSiteConfig } from "../state/SiteConfig";
import {
  ApiError,
  createPurchase,
  fetchPurchase,
  type PurchaseInfo,
  type SnapshotInput,
} from "../client/purchases";
import { validateInvitation } from "../domain/invitation";
import { photoToJpegDataUrl } from "../render/assets";
import { TemplateCanvas } from "./TemplateCanvas";
import { PreviewTabs, StillPreview } from "./StillPreview";
import { track } from "../lib/analytics";
import { slugify } from "../lib/seo";
import { InvitationForm } from "./InvitationForm";
import { RecoverPurchase } from "./RecoverPurchase";

export const PURCHASE_KEY = "invitacion:compra";

const STATUS_COPY: Record<
  PurchaseInfo["status"],
  { text: string; tone: "info" | "ok" | "error" }
> = {
  unpaid: { text: "Todavía no registramos el pago.", tone: "info" },
  pending: {
    text: "Tu pago está pendiente de acreditación. Esta pantalla se actualiza sola.",
    tone: "info",
  },
  approved: { text: "¡Pago aprobado! Te llevamos al generador.", tone: "ok" },
  rejected: {
    text: "El pago fue rechazado. Podés intentar de nuevo con otro medio de pago.",
    tone: "error",
  },
  cancelled: {
    text: "El pago fue cancelado. Podés intentar de nuevo cuando quieras.",
    tone: "error",
  },
  refunded: {
    text: "Este pago fue devuelto, por lo que el video final ya no está habilitado.",
    tone: "error",
  },
  expired: {
    text: "Esta compra venció: ya pasó el plazo para descargar y los datos se eliminaron.",
    tone: "error",
  },
  mismatch: {
    text: "El importe del pago no coincide con el precio del producto, por lo que no se habilitó la descarga. Escribinos para resolverlo.",
    tone: "error",
  },
};

/** Qué se puede comprar: el video, la imagen o las dos cosas (con ahorro). */
function ProductPicker({
  value,
  onChange,
  pricing,
}: {
  value: Product;
  onChange: (p: Product) => void;
  pricing: {
    price: number;
    imagePrice: number;
    bundlePrice: number;
    videoUpgrade: number;
    imageUpgrade: number;
  };
}) {
  const saving = pricing.price + pricing.imagePrice - pricing.bundlePrice;
  const options: { id: Product; title: string; text: string }[] = [
    {
      id: "video",
      title: "Solo video",
      text: "Video MP4 vertical en Full HD, listo para WhatsApp e Instagram",
    },
    {
      id: "both",
      title: "Video + imagen",
      text: "El video MP4 y la imagen 1080×1920 (PNG y JPG) con un solo pago",
    },
    {
      id: "image",
      title: "Solo imagen",
      text: "Imagen vertical 1080×1920 (PNG y JPG) para estados e Instagram",
    },
  ];
  return (
    <fieldset className="products">
      <legend>¿Qué querés llevarte?</legend>
      {options.map((o) => (
        <label key={o.id} className="product" data-on={value === o.id}>
          <input
            type="radio"
            name="product"
            checked={value === o.id}
            onChange={() => onChange(o.id)}
          />
          <span className="product-text">
            <strong>
              {o.title}
              {o.id === "both" && (
                <span className="product-pill">Más elegido</span>
              )}
            </strong>
            {value === o.id && <small>{o.text}</small>}
            {value === o.id && o.id === "both" && saving > 0 && (
              <em className="product-save">Ahorrás {formatArs(saving)}</em>
            )}
          </span>
          <span className="product-price">
            {o.id === "both" && saving > 0 && (
              <s className="product-price-old">
                <span className="sr-only">Precio por separado </span>
                {formatArs(pricing.price + pricing.imagePrice)}
              </s>
            )}
            {formatArs(priceOf(o.id, pricing))}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Oferta de compra. Cuando el servidor confirma el pago, avisa con `onApproved` y la app pasa al generador. */
export function OfferPanel({
  purchaseId,
  onPurchaseId,
  onApproved,
  onBack,
}: {
  purchaseId: string | null;
  onPurchaseId: (id: string | null) => void;
  onApproved: (info: PurchaseInfo) => void;
  onBack: () => void;
}) {
  const { state, content, template, setTemplate } = useInvitation();
  const PRICING = useSiteConfig().config.pricing;
  const [info, setInfo] = useState<PurchaseInfo | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [product, setProduct] = useState<Product>("both");
  const [previewMode, setPreviewMode] = useState<"video" | "image">("video");
  const amount = priceOf(product, PRICING);

  const refresh = useCallback(async () => {
    if (!purchaseId) return;
    setLoadingStatus(true);
    try {
      const p = await fetchPurchase(purchaseId);
      setInfo(p);
      setError(null);
      if (p.status === "approved") onApproved(p);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "No pudimos verificar el pago.",
      );
    } finally {
      setLoadingStatus(false);
    }
  }, [purchaseId, onApproved]);

  useEffect(() => {
    void refresh();
  }, [purchaseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // mientras el pago esté pendiente, vuelve a consultar al servidor
  useEffect(() => {
    if (!purchaseId || !info || !["pending", "unpaid"].includes(info.status))
      return;
    const id = setInterval(() => void refresh(), 6000);
    return () => clearInterval(id);
  }, [purchaseId, info, refresh]);

  const buy = async () => {
    track("buy_click", { templateId: state.templateId });
    setBuying(true);
    setError(null);
    try {
      if (Object.keys(validateInvitation(state.data)).length) {
        setError("Completá todos los datos de tu invitación antes de comprar.");
        setEditing(true);
        setBuying(false);
        return;
      }
      // se guarda una copia de lo que se compra (datos + foto reducida) para poder volver a descargar y se borra al vencer
      const a = state.audio;
      const snapshot: SnapshotInput = {
        data: state.data,
        audio:
          a.kind === "library"
            ? { kind: "library", id: a.id }
            : a.kind === "custom"
              ? { kind: "custom" }
              : a.kind === "mute"
                ? { kind: "mute" }
                : { kind: "default" },
        photo: state.photo ? photoToJpegDataUrl(state.photo.canvas) : null,
      };
      const { purchaseId: id, checkoutUrl } = await createPurchase(
        state.templateId,
        snapshot,
        product,
      );
      try {
        localStorage.setItem(PURCHASE_KEY, JSON.stringify({ purchaseId: id }));
      } catch {
        /* sin almacenamiento */
      }
      onPurchaseId(id);
      window.location.assign(checkoutUrl);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "No pudimos iniciar el pago.",
      );
      setBuying(false);
    }
  };

  // la plantilla queda atada a la compra
  useEffect(() => {
    if (info && info.templateId !== state.templateId)
      setTemplate(info.templateId);
  }, [info, state.templateId, setTemplate]);

  const status = info?.status;
  const copy = status ? STATUS_COPY[status] : null;
  const canBuy =
    status !== "approved" &&
    status !== "pending" &&
    status !== "refunded" &&
    status !== "mismatch";

  return (
    <div className="offer">
      <div className="offer-preview">
        <PreviewTabs mode={previewMode} onChange={setPreviewMode} />
        {previewMode === "image" ? (
          <StillPreview template={template} content={content} />
        ) : state.preview ? (
          <video
            src={state.preview.url}
            controls
            playsInline
            loop
            autoPlay
            muted
            aria-label="Vista previa de tu invitación con marca de agua"
          />
        ) : (
          <div className="player" style={{ maxWidth: 380 }}>
            <TemplateCanvas
              template={template}
              content={content}
              animate
              watermark
              scale={0.5}
              label="Tu invitación"
            />
          </div>
        )}
        <p className="fine" style={{ textAlign: "center" }}>
          Vista previa con marca de agua.{" "}
          {previewMode === "image" ? "La imagen" : "El video"} final no la
          lleva.
        </p>
      </div>

      <div className="offer-info">
        <div className="offer-main">
          <p className="eyebrow">Paso 3 de 3</p>
          <h1>¡Tu invitación está lista!</h1>
          <p className="lead">
            Elegí si querés el video, la imagen o las dos cosas. Sin marca de
            agua.
          </p>
          <p className="offer-tag">
            <span className="tag">
              <span aria-hidden="true">⭐</span> {template.name}
            </span>
          </p>

          <ProductPicker
            value={product}
            onChange={setProduct}
            pricing={PRICING}
          />
          <div className="price-row">
            <span className="price" aria-label={`Precio ${formatArs(amount)}`}>
              {formatArs(amount)}
            </span>
            {product === "video" && PRICING.showReferencePrice && (
              <span className="price-old">
                <span className="sr-only">Precio anterior </span>
                {formatArs(PRICING.referencePrice)}
              </span>
            )}
            {product === "both" &&
              PRICING.price + PRICING.imagePrice > PRICING.bundlePrice && (
                <span className="price-old">
                  <span className="sr-only">Precio por separado </span>
                  {formatArs(PRICING.price + PRICING.imagePrice)}
                </span>
              )}
            {product === "video" &&
              PRICING.showReferencePrice &&
              PRICING.referencePrice > PRICING.price && (
                <span className="off-badge">
                  {Math.round(
                    (1 - PRICING.price / PRICING.referencePrice) * 100,
                  )}
                  % OFF
                </span>
              )}
          </div>
          {copy && (
            <p
              className={`alert alert-${copy.tone}`}
              role="status"
              aria-live="polite"
            >
              {loadingStatus && status === "pending" ? "⏳ " : ""}
              {copy.text}
            </p>
          )}
          {error && (
            <p
              className="alert alert-error"
              role="alert"
              style={{ marginTop: 10 }}
            >
              {error}
            </p>
          )}

          <div className="actions-bar" style={{ marginTop: 16 }}>
            {canBuy && (
              <button
                type="button"
                className="btn btn-primary btn-buy"
                onClick={buy}
                disabled={buying}
              >
                {buying ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <span className="btn-ico" aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/logo-mercadopago.svg"
                      alt=""
                      width={32}
                      height={32}
                    />
                  </span>
                )}
                <span className="btn-two">
                  <strong>Comprar con Mercado Pago</strong>
                  <small>Pago seguro · {formatArs(amount)}</small>
                </span>
                <span className="btn-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            )}
            {state.preview && (
              <a
                className="btn btn-secondary"
                href={state.preview.url}
                download={`vista-previa-${slugify(content.name) || "invitacion"}.mp4`}
              >
                <span aria-hidden="true">⬇</span> Descargar con marca de agua
              </a>
            )}
            {/* 
					<button type="button" className="btn btn-secondary" onClick={() => setEditing((e) => !e)}><span aria-hidden="true">✏️</span> {editing ? 'Cerrar edición' : 'Editar datos'}</button>
					<button type="button" className="btn btn-ghost" onClick={onBack}>← Volver al editor</button>
					<button type="button" className="btn btn-ghost" aria-expanded={showCode} onClick={() => { setShowCode((v) => !v); if (purchaseId) void refresh(); }}>
						Ya compré: descargar sin marca de agua
					</button>
					 */}
            <button type="button" className="btn btn-ghost" onClick={onBack}>
              <span aria-hidden="true">←</span> Volver y editar mi invitación
            </button>
            {purchaseId && status !== "refunded" && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void refresh()}
                disabled={loadingStatus}
              >
                {loadingStatus ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  "🔄"
                )}{" "}
                Verificar mi pago
              </button>
            )}
          </div>
        </div>

        <div className="offer-aside">
          <ul className="includes">
            {hasVideo(product) && (
              <li>
                Video MP4 vertical en Full HD 1080×1920 (720×1280 si lo generás
                desde un celular), ideal para WhatsApp e Instagram
              </li>
            )}
            {hasImage(product) && (
              <li>
                Imagen vertical 1080×1920 (PNG y JPG) con el estilo de tu video,
                para estados e Instagram
              </li>
            )}
            <li>
              Sin marca de agua, con tus datos
              {hasVideo(product) ? " y tu música" : ""}
            </li>
            {hasVideo(product) && (
              <li>
                Un solo pago por esta plantilla: hasta {PRICING.maxFinalRenders}{" "}
                generaciones del video por si te equivocás en un dato
              </li>
            )}
            {/* <li>
            El video se genera en tu navegador. Al comprar guardamos una copia
            de tus datos y tu foto para que puedas volver a descargarlo durante{" "}
            {PRICING.retentionDays} días; después se eliminan automáticamente
          </li> */}
          </ul>

          <div
            className="alert alert-info offer-steps"
            style={{ marginTop: 14 }}
          >
            <strong>¿Cómo descargo el video sin marca de agua?</strong>
            <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
              <li>
                Tocá <em>Comprar con Mercado Pago</em> y pagá.
              </li>
              <li>Al volver te llevamos solos al generador de tu compra.</li>
              <li>
                Tocá <em>Generar</em> y descargá tu{" "}
                {product === "image"
                  ? "imagen"
                  : product === "both"
                    ? "video e imagen"
                    : "video en MP4"}
                .
              </li>
            </ol>
            {/* 
          <span className="fine">
            ¿Ya pagaste o cerraste la página? Tocá <em>Ya compré</em> y pegá tu
            código de compra.
          </span>
           */}
          </div>

          <div className="secure-strip">
            <span className="secure-ico" aria-hidden="true">
              🛡
            </span>
            <span>
              <strong>Pago seguro y protegido por Mercado Pago</strong>Tu
              información está encriptada y no la compartimos.
            </span>
            <span className="secure-ssl">
              <strong>SSL</strong>Cifrado seguro
            </span>
          </div>

          {showCode && <RecoverPurchase open onFound={onApproved} />}
          {purchaseId && (
            <p className="fine">
              Código de compra: <code>{purchaseId}</code>
            </p>
          )}
          {/* 
        <p className="fine">
          ¿Preferís no pagar?{" "}
          <a href="/gratis">Publicá la vista previa y conseguilo gratis</a>.
        </p>
        <p className="fine">
          Pagás de forma segura en Mercado Pago. Habilitamos el video final solo
          cuando Mercado Pago confirma el pago; volver a esta página no alcanza.
        </p>
				 */}

          {editing && (
            <div className="panel" style={{ marginTop: 16 }}>
              <h3>Tus datos</h3>
              <InvitationForm
                submitLabel="Guardar cambios"
                onSubmit={() => setEditing(false)}
                onCancel={() => setEditing(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
