import {MercadoPagoConfig, Preference, Payment} from 'mercadopago';
import type {GatewayPayment} from './payment-evaluation.ts';

export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigError';
	}
}

export type PreferenceInput = {
	purchaseId: string;
	templateId: string;
	title: string;
	amount: number;
	currency: string;
	appUrl: string;
};

export interface PaymentGateway {
	createPreference(input: PreferenceInput): Promise<{id: string; initPoint: string}>;
	/** pagos de esa referencia externa, el más reciente primero */
	searchPaymentsByReference(ref: string): Promise<GatewayPayment[]>;
	getPayment(id: string): Promise<GatewayPayment | null>;
}

type RawPayment = {
	id?: number | string;
	status?: string;
	transaction_amount?: number;
	currency_id?: string;
	external_reference?: string | null;
};

const toPayment = (p: RawPayment): GatewayPayment => ({
	id: String(p.id),
	status: String(p.status),
	transaction_amount: Number(p.transaction_amount),
	currency_id: String(p.currency_id),
	external_reference: p.external_reference ?? null,
});

/**
 * Implementación con el SDK oficial `mercadopago`. El token vive solo en el
 * servidor. El cliente se crea recién al usarlo, así que las rutas que no
 * hablan con Mercado Pago (p. ej. verificar una autorización) funcionan sin él.
 */
export class MercadoPagoGateway implements PaymentGateway {
	private accessToken: string | undefined;
	private cached: MercadoPagoConfig | null = null;

	constructor(accessToken: string | undefined) {
		this.accessToken = accessToken;
	}

	private get client(): MercadoPagoConfig {
		if (!this.accessToken) {
			throw new ConfigError('Falta configurar MP_ACCESS_TOKEN: los pagos con Mercado Pago no están disponibles todavía.');
		}
		this.cached ??= new MercadoPagoConfig({accessToken: this.accessToken, options: {timeout: 10000}});
		return this.cached;
	}

	async createPreference(i: PreferenceInput) {
		const isHttps = i.appUrl.startsWith('https://');
		const res = await new Preference(this.client).create({
			body: {
				items: [
					{
						id: i.templateId,
						title: i.title,
						quantity: 1,
						unit_price: i.amount,
						currency_id: i.currency,
					},
				],
				external_reference: i.purchaseId,
				metadata: {purchase_id: i.purchaseId, template_id: i.templateId},
				back_urls: {
					success: `${i.appUrl}/?compra=${encodeURIComponent(i.purchaseId)}`,
					pending: `${i.appUrl}/?compra=${encodeURIComponent(i.purchaseId)}`,
					failure: `${i.appUrl}/?compra=${encodeURIComponent(i.purchaseId)}`,
				},
				// Mercado Pago exige URLs públicas https para el retorno automático y el webhook
				...(isHttps
					? {auto_return: 'approved' as const, notification_url: `${i.appUrl}/api/webhooks/mercadopago`}
					: {}),
				statement_descriptor: 'INVITACION VIDEO',
			},
		});
		if (!res.id || !res.init_point) throw new Error('Mercado Pago no devolvió la URL de pago.');
		return {id: res.id, initPoint: res.init_point};
	}

	async searchPaymentsByReference(ref: string) {
		const res = await new Payment(this.client).search({
			options: {external_reference: ref, sort: 'date_created', criteria: 'desc'},
		});
		return (res.results ?? []).map((p) => toPayment(p as RawPayment));
	}

	async getPayment(id: string) {
		try {
			const p = await new Payment(this.client).get({id});
			return toPayment(p as RawPayment);
		} catch {
			return null;
		}
	}
}
