'use client';

import React, {useEffect, useState} from 'react';
import {adminApi} from './api';
import {getParams, setParams} from './url';
import {formatArs} from '../config/pricing';
import {EVENTS, EVENT_LABELS} from '../lib/events';
import {useSiteConfig} from '../state/SiteConfig';
import type {Stats} from '../server/stats';

const fmtDate = (ms: number | null) =>
	ms ? new Date(ms).toLocaleString('es-AR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '—';

export function StatsTab() {
	const [days, setDays] = useState(() => {
		const d = Number(getParams().get('days'));
		return [7, 30, 90].includes(d) ? d : 30;
	});
	const [s, setS] = useState<Stats | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const {all, config} = useSiteConfig();
	const name = (id: string) => all.find((t) => t.id === id)?.name ?? id;

	useEffect(() => {
		setS(null);
		adminApi.stats(days).then(setS).catch((e) => setErr(e.message));
	}, [days]);

	if (err) return <p className="alert alert-error">{err}</p>;
	if (!s) return <p className="alert alert-info">Calculando…</p>;

	const visits = s.funnel.page_view || 0;
	const conv = visits ? ((s.sales / visits) * 100).toFixed(1) : '—';
	const maxFunnel = Math.max(1, ...EVENTS.map((e) => s.funnel[e]));
	const maxRev = Math.max(1, ...s.series.map((d) => d.revenue));
	const ga = config.analytics.gaId;
	const clarity = config.analytics.clarityId;

	return (
		<div className="stack">
			<div className="chips" role="group" aria-label="Período">
				{[7, 30, 90].map((d) => (
					<button key={d} type="button" className="chip" aria-pressed={days === d} onClick={() => {
						setDays(d);
						setParams({days: String(d)});
					}}>Últimos {d} días</button>
				))}
			</div>

			<div className="kpis">
				<div className="kpi"><span>Ventas</span><strong>{s.sales}</strong></div>
				<div className="kpi"><span>Ingresos</span><strong>{formatArs(s.revenue)}</strong></div>
				<div className="kpi"><span>Visitas</span><strong>{visits}</strong></div>
				<div className="kpi"><span>Conversión visita → venta</span><strong>{conv}{conv === '—' ? '' : ' %'}</strong></div>
				<div className="kpi"><span>Compras abandonadas</span><strong>{s.abandoned}</strong></div>
				<div className="kpi"><span>Devueltas</span><strong>{s.refunded}</strong></div>
			</div>
			<p className="fine">El ingreso es el bruto cobrado; Mercado Pago descuenta su comisión. Las ventas se registran cuando el servidor confirma el pago (al volver el cliente o por el webhook). Las compras de prueba no se cuentan.</p>

			<section className="panel">
				<h3>Ingresos por día</h3>
				<svg viewBox={`0 0 ${s.series.length * 12} 120`} className="chart" role="img" aria-label="Ingresos por día" preserveAspectRatio="none">
					{s.series.map((d, i) => {
						const h = (d.revenue / maxRev) * 100;
						return (
							<g key={d.day}>
								<title>{`${d.day}: ${formatArs(d.revenue)} · ${d.sales} ventas · ${d.visits} visitas`}</title>
								<rect x={i * 12 + 1} y={110 - h} width={10} height={Math.max(h, 1)} rx={2} fill={d.sales ? '#5b2be0' : '#e8dff5'} />
							</g>
						);
					})}
				</svg>
			</section>

			<section className="panel">
				<h3>Embudo</h3>
				<div className="funnel">
					{EVENTS.map((e) => (
						<div key={e} className="funnel-row">
							<span>{EVENT_LABELS[e]}</span>
							<div className="bar"><div style={{width: `${(s.funnel[e] / maxFunnel) * 100}%`}} /></div>
							<strong>{s.funnel[e]}</strong>
						</div>
					))}
				</div>
				<p className="fine">Son contadores propios (sin cookies). Para ver grabaciones de sesiones y mapas de calor usá Clarity; para audiencias y origen del tráfico, Google Analytics.</p>
				<p className="fine"><strong>Vistas previas generadas, dispositivo y tiempo:</strong> el evento <code>preview_ready</code> se envía a Google Analytics con los parámetros <code>device_type</code> (mobile/desktop) y <code>render_ms</code> (milisegundos reales del render), y a Clarity con las etiquetas <code>device_type</code> y <code>preview_render_s</code>. En GA4 (Administrar → Definiciones personalizadas) registrá ambos parámetros como dimensión/métrica personalizada para verlos en Explorar; Clarity los muestra como filtro. Solo cuentan visitantes que aceptaron el aviso de analítica.</p>
				<div className="actions-bar">
					{clarity ? <a className="btn btn-secondary btn-sm" target="_blank" rel="noreferrer" href={`https://clarity.microsoft.com/projects/view/${clarity}/dashboard`}>Abrir Clarity ↗</a> : <span className="fine">Clarity: cargá el ID en Ajustes.</span>}
					{ga ? <a className="btn btn-secondary btn-sm" target="_blank" rel="noreferrer" href="https://analytics.google.com/">Abrir Google Analytics ↗</a> : <span className="fine">Google Analytics: cargá el ID en Ajustes.</span>}
				</div>
			</section>

			<section className="panel">
				<h3>Plantillas: qué funciona</h3>
				<div className="table-wrap">
					<table className="table">
						<thead><tr><th>Plantilla</th><th>La eligieron</th><th>Vieron la oferta</th><th>Tocaron comprar</th><th>Ventas</th><th>Ingresos</th></tr></thead>
						<tbody>
							{s.byTemplate.map((t) => (
								<tr key={t.templateId}>
									<td>{name(t.templateId)}</td><td>{t.selected}</td><td>{t.previews}</td><td>{t.buyClicks}</td><td>{t.sales}</td><td>{formatArs(t.revenue)}</td>
								</tr>
							))}
							{!s.byTemplate.length && <tr><td colSpan={6}>Todavía no hay datos.</td></tr>}
						</tbody>
					</table>
				</div>
			</section>

			<section className="panel">
				<h3>Últimas compras</h3>
				<p className="fine">Hay {s.activeWithData} compra(s) con datos personales guardados; se borran solas al vencer.</p>
				<div className="table-wrap">
					<table className="table">
						<thead><tr><th>Creada</th><th>Plantilla</th><th>Estado</th><th>Importe</th><th>Generaciones</th><th>Entregada</th><th>Vence</th><th>Código</th></tr></thead>
						<tbody>
							{s.recent.map((p) => (
								<tr key={p.id}>
									<td>{fmtDate(p.createdAt)}</td>
									<td>{name(p.templateId)}{p.testMode ? ' 🧪' : ''}</td>
									<td><span className={`pill pill-${p.state.replace(' ', '-')}`}>{p.state}</span></td>
									<td>{formatArs(p.amount)}</td>
									<td>{p.used} / {p.max}</td>
									<td>{p.delivered ? 'Sí' : 'No'}</td>
									<td>{fmtDate(p.expiresAt)}</td>
									<td><code>{p.id.slice(0, 8)}…</code></td>
								</tr>
							))}
							{!s.recent.length && <tr><td colSpan={8}>Todavía no hay compras.</td></tr>}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	);
}
