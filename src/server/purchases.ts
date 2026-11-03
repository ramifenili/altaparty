import { randomUUID } from "node:crypto";
import { DEFAULT_SETTINGS, type SiteSettings } from "../config/site.ts";
import {
  PRICING,
  hasImage,
  hasVideo,
  imagePromoPrice,
  isProduct,
  priceOf,
  videoPromoPrice,
  type Product,
} from "../config/pricing.ts";
import {
  EMPTY_INVITATION,
  validateInvitation,
  type InvitationData,
} from "../domain/invitation.ts";
import { getSound } from "../audio/library.ts";
import { isBuiltinTemplate } from "../templates/ids.ts";
import type { PaymentGateway } from "./gateway.ts";
import { evaluatePayments, type PurchaseStatus } from "./payment-evaluation.ts";
import type { PurchaseStore } from "./store.ts";
import type { PurchaseRecord, Snapshot, SnapshotAudio } from "./db.ts";
import { signToken, verifyToken } from "./token.ts";

export class PurchaseError extends Error {
  readonly code:
    | "invalid"
    | "not_paid"
    | "bad_token"
    | "unavailable"
    | "limit_reached"
    | "expired";
  readonly http: number;
  constructor(message: string, code: PurchaseError["code"], http = 400) {
    super(message);
    this.name = "PurchaseError";
    this.code = code;
    this.http = http;
  }
}

/** `<uuid>.<plantilla>` (la plantilla puede ser una de las incluidas o un video compilado `c-...`). */
const ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9-]{2,40}$/;
const AUTH_TTL_MS = 30 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
/** una compra que nunca se pagó se descarta a los 3 días */
export const UNPAID_TTL_MS = 3 * DAY;
const MAX_PHOTO_BYTES = 700 * 1024;
const PRODUCT_TITLE: Record<Product, string> = {
  video: "Invitación de cumpleaños en video (MP4 sin marca de agua)",
  image: "Invitación de cumpleaños en imagen 1080×1920 (sin marca de agua)",
  both: "Invitación de cumpleaños: video MP4 + imagen 1080×1920 (sin marca de agua)",
};

export type SnapshotInput = {
  data?: unknown;
  audio?: unknown;
  photo?: unknown;
};

export type PurchaseService = ReturnType<typeof createPurchaseService>;

export function createPurchaseService(deps: {
  gateway: PaymentGateway;
  store: PurchaseStore;
  appUrl: string;
  tokenSecret: string;
  /** modo de prueba local con pagos simulados (nunca en producción) */
  testMode?: boolean;
  /** ajustes del sitio (precio, vencimiento, límites) */
  getSettings?: () => Promise<SiteSettings>;
  /** ¿existe y está disponible esta plantilla? (incluye videos compilados) */
  isTemplateAvailable?: (id: string) => Promise<boolean>;
  now?: () => number;
}) {
  const now = deps.now ?? (() => Date.now());
  const testMode = deps.testMode === true;
  const TEST_ID = "00000000-0000-4000-8000-000000000000";
  const getSettings = deps.getSettings ?? (async () => DEFAULT_SETTINGS);
  const available =
    deps.isTemplateAvailable ?? (async (id: string) => isBuiltinTemplate(id));

  const templateOf = (purchaseId: string) => purchaseId.split(".")[1];

  const assertId = (raw: unknown): string => {
    let purchaseId = raw;
    // en modo prueba, "PRUEBA-boca" equivale a una compra aprobada de esa plantilla
    if (testMode && typeof raw === "string") {
      const m = /^prueba-([a-z0-9-]+)$/i.exec(raw.trim());
      if (m) purchaseId = `${TEST_ID}.${m[1].toLowerCase()}`;
    }
    if (typeof purchaseId !== "string" || !ID_RE.test(purchaseId)) {
      throw new PurchaseError("El código de compra no es válido.", "invalid");
    }
    return purchaseId;
  };

  /** Valida el snapshot que manda el cliente al comprar (nunca se confía en él). */
  function parseSnapshot(
    input: SnapshotInput | undefined,
  ): { snapshot: Snapshot; photo?: Buffer } | null {
    if (!input || typeof input.data !== "object" || input.data === null)
      return null;
    const raw = input.data as Record<string, unknown>;
    const data = { ...EMPTY_INVITATION } as InvitationData;
    for (const k of Object.keys(EMPTY_INVITATION) as (keyof InvitationData)[]) {
      const v = k === "timeEnd" && raw[k] === undefined ? "" : raw[k];
      if (typeof v !== "string" || v.length > 200)
        throw new PurchaseError(
          "Los datos de la invitación no son válidos.",
          "invalid",
        );
      data[k] = v;
    }
    const errs = validateInvitation(data, new Date(now()));
    if (Object.keys(errs).length)
      throw new PurchaseError(
        "Completá todos los datos de la invitación antes de comprar.",
        "invalid",
      );

    const a = (input.audio ?? { kind: "default" }) as {
      kind?: unknown;
      id?: unknown;
    };
    let audio: SnapshotAudio = { kind: "default" };
    if (a.kind === "mute") audio = { kind: "mute" };
    else if (a.kind === "custom") audio = { kind: "custom" };
    else if (a.kind === "library" && typeof a.id === "string" && getSound(a.id))
      audio = { kind: "library", id: a.id };

    let photo: Buffer | undefined;
    if (typeof input.photo === "string" && input.photo) {
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(input.photo);
      if (!m) throw new PurchaseError("La foto no es válida.", "invalid");
      const buf = Buffer.from(m[1], "base64");
      if (buf.length > MAX_PHOTO_BYTES || buf[0] !== 0xff || buf[1] !== 0xd8)
        throw new PurchaseError(
          "La foto es demasiado pesada o no es JPEG.",
          "invalid",
        );
      photo = buf;
    }
    return { snapshot: { data, audio }, photo };
  }

  async function status(purchaseIdRaw: unknown) {
    const purchaseId = assertId(purchaseIdRaw);
    const settings = await getSettings();
    const nowMs = now();
    let rec = await deps.store.getPurchase(purchaseId);

    // vencida: se borran los datos personales y ya no se puede descargar
    if (rec?.paidAt && rec.expiresAt <= nowMs) {
      await deps.store.purgeExpired(nowMs, UNPAID_TTL_MS);
      return view(purchaseId, "expired", rec, settings);
    }

    // canje gratis: lo aprobó una persona, no hay pago que consultar
    if (rec?.free && rec.paidAt)
      return view(purchaseId, "approved", rec, settings);

    const payments = await deps.gateway.searchPaymentsByReference(purchaseId);
    // el importe esperado es el que se cobró al crear la compra (o el precio actual si no hay registro)
    const expected = rec?.amount ?? settings.price;
    const ev = evaluatePayments(purchaseId, payments, {
      amount: expected,
      currency: PRICING.currency,
    });

    if (ev.status === "approved") {
      if (!rec) {
        const created: PurchaseRecord = {
          id: purchaseId,
          templateId: templateOf(purchaseId),
          createdAt: nowMs,
          amount: expected,
          currency: PRICING.currency,
          paidAt: nowMs,
          expiresAt: nowMs + settings.retentionDays * DAY,
          authorizations: 0,
          maxRenders: settings.maxFinalRenders,
          testMode,
        };
        await deps.store.createPurchase(created);
        rec = created;
      } else if (!rec.paidAt) {
        rec =
          (await deps.store.updatePurchase(purchaseId, (r) => {
            r.paidAt = nowMs;
            r.expiresAt = nowMs + settings.retentionDays * DAY;
          })) ?? rec;
      }
    } else if (ev.status === "refunded" && rec && !rec.refundedAt) {
      rec =
        (await deps.store.updatePurchase(
          purchaseId,
          (r) => void (r.refundedAt = nowMs),
        )) ?? rec;
    }
    return view(
      purchaseId,
      ev.status as PurchaseStatus | "expired",
      rec,
      settings,
    );
  }

  async function view(
    purchaseId: string,
    st: PurchaseStatus | "expired",
    rec: PurchaseRecord | null,
    settings: SiteSettings,
  ) {
    // compra de imagen a la que ya se le sumó (y se pagó) el video con descuento
    const up = rec?.upgradedTo
      ? await deps.store.getPurchase(rec.upgradedTo)
      : null;
    return {
      videoPurchaseId: up?.paidAt && up.product === "video" ? up.id : null,
      imagePurchaseId: up?.paidAt && up.product === "image" ? up.id : null,
      purchaseId,
      templateId: templateOf(purchaseId),
      status: st,
      delivered: !!rec?.deliveredAt,
      /** generaciones finales que quedan con esta compra */
      remaining: rec
        ? Math.max(0, rec.maxRenders - rec.authorizations)
        : settings.maxFinalRenders,
      testMode,
      /** qué incluye la compra */
      // (en modo prueba, sin registro, se habilita todo para poder probar el video y la imagen)
      product: (rec?.product ??
        (testMode && !rec ? "both" : "video")) as Product,
      /** fin del período de descarga (null si todavía no se pagó) */
      expiresAt: rec?.paidAt ? rec.expiresAt : null,
      /** el servidor guarda los datos comprados: el generador los muestra bloqueados */
      hasSnapshot: !!rec?.snapshot,
    };
  }

  return {
    /**
     * Crea la preferencia de pago. El cliente solo elige la plantilla y envía los datos que se
     * van a entregar; el importe lo fija el servidor.
     */
    async create(
      templateId: unknown,
      snapshotInput?: SnapshotInput,
      productRaw?: unknown,
      upgradeFromRaw?: unknown,
    ) {
      if (typeof templateId !== "string" || !(await available(templateId))) {
        throw new PurchaseError("La plantilla elegida no existe.", "invalid");
      }
      const settings = await getSettings();
      // "agregar el video" a una compra de imagen ya paga: mismo contenido y 20% menos (el servidor copia los datos)
      let base: PurchaseRecord | null = null;
      let parsed = upgradeFromRaw ? null : parseSnapshot(snapshotInput);
      let basePhoto: Buffer | null = null;
      if (upgradeFromRaw) {
        const baseId = assertId(upgradeFromRaw);
        const bs = await status(baseId);
        if (bs.status !== "approved")
          throw new PurchaseError(
            "La compra de la imagen todavía no está aprobada.",
            "not_paid",
            402,
          );
        base = await deps.store.getPurchase(baseId);
        if (
          (bs.product !== "image" && bs.product !== "video") ||
          !base?.snapshot ||
          base.templateId !== templateId
        ) {
          throw new PurchaseError(
            "Solo se puede completar una compra de video o de imagen de la misma plantilla.",
            "invalid",
            403,
          );
        }
        const prev = base.upgradedTo
          ? await deps.store.getPurchase(base.upgradedTo)
          : null;
        if (prev?.paidAt)
          throw new PurchaseError(
            "Ya completaste esta compra.",
            "invalid",
            403,
          );
        basePhoto = base.hasPhoto ? await deps.store.readPhoto(base.id) : null;
        parsed = { snapshot: base.snapshot, photo: basePhoto ?? undefined };
      }
      // el importe depende del producto elegido, pero lo fija siempre el servidor
      const product: Product = base
        ? base.product === "image"
          ? "video"
          : "image"
        : isProduct(productRaw)
          ? productRaw
          : "video";
      const amount = base
        ? product === "video"
          ? videoPromoPrice(settings)
          : imagePromoPrice(settings)
        : priceOf(product, settings);
      const purchaseId = `${randomUUID()}.${templateId}`;
      const t = now();
      await deps.store.createPurchase(
        {
          id: purchaseId,
          templateId,
          createdAt: t,
          amount,
          product,
          upgradeOf: base?.id,
          currency: PRICING.currency,
          expiresAt: t + UNPAID_TTL_MS,
          authorizations: 0,
          maxRenders: settings.maxFinalRenders,
          testMode,
          snapshot: parsed?.snapshot,
        },
        parsed?.photo,
      );
      if (base)
        await deps.store.updatePurchase(
          base.id,
          (r) => void (r.upgradedTo = purchaseId),
        );
      const pref = await deps.gateway.createPreference({
        purchaseId,
        templateId,
        title: PRODUCT_TITLE[product],
        amount,
        currency: PRICING.currency,
        appUrl: deps.appUrl,
      });
      return { purchaseId, preferenceId: pref.id, checkoutUrl: pref.initPoint };
    },

    status,

    /**
     * Habilita un video sin cobrar (canje aprobado del programa de difusión). Devuelve el mismo
     * código de compra que se usa en "Ya compré"; vence y se limita igual que una compra paga.
     */
    async grantFree(templateId: unknown, claimId: string) {
      if (typeof templateId !== "string" || !(await available(templateId))) {
        throw new PurchaseError(
          "La plantilla elegida ya no está disponible.",
          "invalid",
        );
      }
      const settings = await getSettings();
      const t = now();
      const purchaseId = `${randomUUID()}.${templateId}`;
      await deps.store.createPurchase({
        id: purchaseId,
        templateId,
        createdAt: t,
        amount: 0,
        currency: PRICING.currency,
        paidAt: t,
        expiresAt: t + settings.retentionDays * DAY,
        authorizations: 0,
        maxRenders: settings.maxFinalRenders,
        testMode,
        free: true,
        claimId,
      });
      return purchaseId;
    },

    /** Datos comprados (de solo lectura). Solo con pago aprobado y sin vencer. */
    async snapshot(purchaseIdRaw: unknown) {
      const s = await status(purchaseIdRaw);
      if (s.status === "expired")
        throw new PurchaseError(
          "Esta compra venció y los datos ya se eliminaron.",
          "expired",
          410,
        );
      if (s.status !== "approved")
        throw new PurchaseError(
          "El pago todavía no está aprobado.",
          "not_paid",
          402,
        );
      const rec = await deps.store.getPurchase(s.purchaseId);
      if (!rec?.snapshot)
        return {
          purchaseId: s.purchaseId,
          snapshot: null,
          photo: null,
          expiresAt: s.expiresAt,
        };
      const photoBuf = rec.hasPhoto ? await deps.store.readPhoto(rec.id) : null;
      return {
        purchaseId: s.purchaseId,
        snapshot: rec.snapshot,
        photo: photoBuf
          ? `data:image/jpeg;base64,${photoBuf.toString("base64")}`
          : null,
        expiresAt: s.expiresAt,
      };
    },

    /** Emite la autorización de render final únicamente si hay un pago aprobado y correcto, sin vencer. */
    async authorize(purchaseIdRaw: unknown, kindRaw?: unknown) {
      // 'video' (MP4) o 'image' (JPG 1080×1920): cada uno solo si la compra lo incluye
      const kind: "video" | "image" = kindRaw === "image" ? "image" : "video";
      const s = await status(purchaseIdRaw);
      if (s.status === "expired")
        throw new PurchaseError(
          "Esta compra venció: ya pasó el plazo para descargar.",
          "expired",
          410,
        );
      if (s.status !== "approved") {
        throw new PurchaseError(
          "El pago todavía no está aprobado.",
          "not_paid",
          402,
        );
      }
      if (!(kind === "image" ? hasImage(s.product) : hasVideo(s.product))) {
        throw new PurchaseError(
          kind === "image"
            ? "Tu compra no incluye la imagen."
            : "Tu compra no incluye el video.",
          "invalid",
          403,
        );
      }
      // la imagen se genera en el momento y no consume las generaciones del video
      if (kind === "video") {
        if (s.remaining <= 0) {
          throw new PurchaseError(
            "Ya usaste todas las creaciones incluidas en esta compra.",
            "limit_reached",
            403,
          );
        }
        await deps.store.updatePurchase(
          s.purchaseId,
          (r) => void (r.authorizations += 1),
        );
      }
      const expiresAt = now() + AUTH_TTL_MS;
      const token = signToken(
        { pid: s.purchaseId, tpl: s.templateId, exp: expiresAt, kind },
        deps.tokenSecret,
      );
      return {
        purchaseId: s.purchaseId,
        templateId: s.templateId,
        kind,
        token,
        expiresAt,
        remaining: kind === "video" ? s.remaining - 1 : s.remaining,
      };
    },

    /** Comprueba firma y vencimiento de una autorización ya emitida. */
    checkAuthorization(token: unknown) {
      if (typeof token !== "string")
        throw new PurchaseError("Autorización inválida.", "bad_token", 401);
      const p = verifyToken(token, deps.tokenSecret, now());
      if (!p)
        throw new PurchaseError(
          "La autorización venció o no es válida.",
          "bad_token",
          401,
        );
      return {
        purchaseId: p.pid,
        templateId: p.tpl,
        kind: p.kind ?? ("video" as const),
      };
    },

    /** Se llama cuando el cliente terminó de exportar el MP4 final. Idempotente. */
    async markDelivered(token: unknown) {
      const auth = this.checkAuthorization(token);
      await deps.store.updatePurchase(
        auth.purchaseId,
        (r) => void (r.deliveredAt ??= now()),
      );
      return { purchaseId: auth.purchaseId, delivered: true as const };
    },

    /**
     * Notificación de Mercado Pago. Nunca se confía en el contenido: se consulta el pago a la API
     * y se registra la venta. Es idempotente ante duplicados.
     */
    async handlePaymentNotification(paymentId: string) {
      const payment = await deps.gateway.getPayment(paymentId);
      if (
        !payment?.external_reference ||
        !ID_RE.test(payment.external_reference)
      ) {
        return { handled: false as const, reason: "unknown_reference" };
      }
      const firstTime = await deps.store.recordEvent(
        `payment:${payment.id}:${payment.status}`,
      );
      // recalcula el estado real y registra la venta (idempotente)
      await status(payment.external_reference).catch(() => undefined);
      return {
        handled: true as const,
        duplicate: !firstTime,
        purchaseId: payment.external_reference,
        status: payment.status,
      };
    },

    /** Tarea periódica: borra datos personales vencidos. */
    purge() {
      return deps.store.purgeExpired(now(), UNPAID_TTL_MS);
    },
  };
}
