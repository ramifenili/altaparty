// Lógica pura que decide el estado de una compra a partir de los pagos que
// informa Mercado Pago. No hace red ni lee el entorno: es fácil de testear.

export type GatewayPayment = {
	id: string;
	status: string;
	transaction_amount: number;
	currency_id: string;
	external_reference?: string | null;
};

export type PurchaseStatus =
	| 'unpaid' // todavía no hay ningún pago
	| 'pending' // pago en proceso o pendiente de acreditación
	| 'approved' // pago aprobado y verificado (importe, moneda, referencia)
	| 'rejected'
	| 'cancelled'
	| 'refunded' // devuelto o contracargo
	| 'mismatch'; // aprobado pero con importe/moneda que no corresponden

export type Evaluation = {status: PurchaseStatus; paymentId?: string};

export function evaluatePayments(
	purchaseId: string,
	payments: GatewayPayment[],
	expected: {amount: number; currency: string}
): Evaluation {
	const mine = payments.filter((p) => p.external_reference === purchaseId);
	const amountOk = (p: GatewayPayment) =>
		p.currency_id === expected.currency && Math.abs(Number(p.transaction_amount) - expected.amount) < 0.005;

	const approved = mine.find((p) => p.status === 'approved' && amountOk(p));
	if (approved) return {status: 'approved', paymentId: approved.id};

	const pending = mine.find((p) => ['pending', 'in_process', 'authorized', 'in_mediation'].includes(p.status));
	if (pending) return {status: 'pending', paymentId: pending.id};

	if (mine.some((p) => p.status === 'approved' && !amountOk(p))) return {status: 'mismatch'};

	const refunded = mine.find((p) => ['refunded', 'charged_back'].includes(p.status));
	if (refunded) return {status: 'refunded', paymentId: refunded.id};

	const last = mine[0]; // la búsqueda devuelve primero los más recientes
	if (last?.status === 'cancelled') return {status: 'cancelled', paymentId: last.id};
	if (last?.status === 'rejected') return {status: 'rejected', paymentId: last.id};
	return {status: 'unpaid'};
}
