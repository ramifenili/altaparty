import type {PurchaseRecord} from './db.ts';
import {EVENTS} from '../lib/events.ts';

// Estadísticas del panel. Función pura: recibe los contadores y las compras.

export type DayPoint = {day: string; visits: number; sales: number; revenue: number};

export type Stats = {
	days: number;
	funnel: Record<string, number>;
	byTemplate: {templateId: string; selected: number; previews: number; buyClicks: number; sales: number; revenue: number}[];
	sales: number;
	revenue: number;
	refunded: number;
	/** compras iniciadas (checkout) que nunca se pagaron, dentro de la ventana */
	abandoned: number;
	series: DayPoint[];
	recent: {
		id: string;
		templateId: string;
		createdAt: number;
		paidAt: number | null;
		amount: number;
		state: 'pagada' | 'sin pagar' | 'vencida' | 'devuelta';
		used: number;
		max: number;
		delivered: boolean;
		expiresAt: number | null;
		testMode: boolean;
	}[];
	activeWithData: number;
};

export const dayKey = (ms: number) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10); // hora de Argentina

export function buildStats(events: Record<string, Record<string, number>>, purchases: PurchaseRecord[], days: number, now: number): Stats {
	const from = dayKey(now - (days - 1) * 86400e3);
	const funnel: Record<string, number> = Object.fromEntries(EVENTS.map((e) => [e, 0]));
	const perTpl = new Map<string, {selected: number; previews: number; buyClicks: number; sales: number; revenue: number}>();
	const tpl = (id: string) => {
		let t = perTpl.get(id);
		if (!t) perTpl.set(id, (t = {selected: 0, previews: 0, buyClicks: 0, sales: 0, revenue: 0}));
		return t;
	};
	const series = new Map<string, DayPoint>();
	for (let i = days - 1; i >= 0; i--) {
		const d = dayKey(now - i * 86400e3);
		series.set(d, {day: d, visits: 0, sales: 0, revenue: 0});
	}
	for (const [day, m] of Object.entries(events)) {
		if (day < from) continue;
		for (const [k, n] of Object.entries(m)) {
			const [name, templateId] = k.split('|');
			if (!templateId) {
				if (name in funnel) funnel[name] += n;
				if (name === 'page_view' && series.has(day)) series.get(day)!.visits += n;
			} else if (name === 'template_selected') tpl(templateId).selected += n;
			else if (name === 'preview_ready') tpl(templateId).previews += n;
			else if (name === 'buy_click') tpl(templateId).buyClicks += n;
		}
	}
	let sales = 0;
	let revenue = 0;
	let refunded = 0;
	let abandoned = 0;
	let activeWithData = 0;
	for (const p of purchases) {
		if (p.testMode || p.free) continue; // ni las pruebas locales ni los canjes gratis cuentan como ventas
		if (p.snapshot) activeWithData++;
		if (p.paidAt && dayKey(p.paidAt) >= from) {
			if (p.refundedAt) refunded++;
			else {
				sales++;
				revenue += p.amount;
				tpl(p.templateId).sales++;
				tpl(p.templateId).revenue += p.amount;
				const pt = series.get(dayKey(p.paidAt));
				if (pt) {
					pt.sales++;
					pt.revenue += p.amount;
				}
			}
		} else if (!p.paidAt && dayKey(p.createdAt) >= from) abandoned++;
	}
	const recent = purchases
		.slice()
		.sort((a, b) => b.createdAt - a.createdAt)
		.slice(0, 60)
		.map((p) => ({
			id: p.id,
			templateId: p.templateId,
			createdAt: p.createdAt,
			paidAt: p.paidAt ?? null,
			amount: p.amount,
			state: (p.refundedAt ? 'devuelta' : p.paidAt ? (p.expiresAt <= now ? 'vencida' : 'pagada') : 'sin pagar') as Stats['recent'][number]['state'],
			used: p.authorizations,
			max: p.maxRenders,
			delivered: !!p.deliveredAt,
			expiresAt: p.paidAt ? p.expiresAt : null,
			testMode: p.testMode,
		}));
	return {
		days,
		funnel,
		byTemplate: [...perTpl].map(([templateId, v]) => ({templateId, ...v})).sort((a, b) => b.sales - a.sales || b.selected - a.selected),
		sales,
		revenue,
		refunded,
		abandoned,
		series: [...series.values()],
		recent,
		activeWithData,
	};
}
