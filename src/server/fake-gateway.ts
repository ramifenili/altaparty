import {randomUUID} from 'node:crypto';
import type {PaymentGateway, PreferenceInput} from './gateway.ts';
import type {GatewayPayment} from './payment-evaluation.ts';
import {PRICING} from '../config/pricing.ts';

const TEST_ID = '00000000-0000-4000-8000-000000000000';

/**
 * ¿Se permiten pagos simulados? Solo con MP_FAKE_PAYMENTS=1 y SIN dominio público:
 * fuera de producción, o en producción pero con APP_URL apuntando a localhost.
 * En un sitio real (https://tudominio) se ignora la variable aunque esté definida.
 */
export function fakePaymentsAllowed(env: {NODE_ENV?: string; MP_FAKE_PAYMENTS?: string; APP_URL?: string}) {
	if (env.MP_FAKE_PAYMENTS !== '1') return false;
	if (env.NODE_ENV !== 'production') return true;
	return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(env.APP_URL ?? '');
}

/** Pasarela de prueba: cobra "al instante" y aprueba. Solo vive en memoria. */
export class FakeGateway implements PaymentGateway {
	private payments: GatewayPayment[] = [];

	async createPreference(i: PreferenceInput) {
		this.payments.unshift({
			id: randomUUID(),
			status: 'approved',
			// se "cobra" el importe de la preferencia (el que fijó el servidor según el producto elegido)
			transaction_amount: i.amount,
			currency_id: PRICING.currency,
			external_reference: i.purchaseId,
		});
		return {id: 'fake-preference', initPoint: `${i.appUrl}/?compra=${encodeURIComponent(i.purchaseId)}`};
	}

	async searchPaymentsByReference(ref: string) {
		if (ref.startsWith(TEST_ID)) {
			return [{id: 'test-payment', status: 'approved', transaction_amount: PRICING.price, currency_id: PRICING.currency, external_reference: ref}];
		}
		return this.payments.filter((p) => p.external_reference === ref);
	}

	async getPayment(id: string) {
		return this.payments.find((p) => p.id === id) ?? null;
	}
}
