'use client';

import React, {useEffect, useState} from 'react';
import {adminApi} from './api';
import type {UsageItem, UsageReport} from '../server/usage';

const fmtBytes = (n: number) => {
	const a = Math.abs(n);
	if (a >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
	if (a >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
	if (a >= 1024) return `${(n / 1024).toFixed(0)} KB`;
	return `${n} B`;
};
const fmtDelta = (n: number) => (n === 0 ? '—' : `${n > 0 ? '+' : '−'}${fmtBytes(Math.abs(n))}`);
const fmtDay = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
const fmtMonth = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString('es-AR', {month: 'long', year: 'numeric'});

const STATUS = {
	ok: {pill: 'pill-pagada', text: 'Tranquilo'},
	warn: {pill: 'pill-sin-pagar', text: 'Atención'},
	danger: {pill: 'pill-vencida', text: 'Peligro'},
} as const;

function forecast(i: UsageItem) {
	if (i.bytesPerDay === null) return 'Todavía faltan días de registro para proyectar el ritmo.';
	if (i.bytesPerDay <= 0) return 'El uso no crece (o baja): no se llena a este ritmo.';
	return `Crece ${fmtBytes(i.bytesPerDay)} por día${i.daysLeft === null ? '' : `: al ritmo actual se llena en ~${i.daysLeft} días`}.`;
}

/** Uso de la base de datos y de los archivos, por día y por mes, con la proyección de cuándo se llenan. */
export function UsageTab() {
	const [u, setU] = useState<UsageReport | null>(null);
	const [err, setErr] = useState<string | null>(null);

	useEffect(() => {
		adminApi.usage().then(setU).catch((e) => setErr(e.message));
	}, []);

	if (err) return <p className="alert alert-error">{err}</p>;
	if (!u) return <p className="alert alert-info">Midiendo…</p>;

	return (
		<div className="stack">
			<div className="kpis">
				{u.items.map((i) => (
					<div key={i.key} className="kpi">
						<span>{i.label}</span>
						<strong>{fmtBytes(i.used)}</strong>
						<span className="fine">de {fmtBytes(i.limit)} ({i.pct.toFixed(1)} %)</span>
					</div>
				))}
				<div className="kpi"><span>Fotos de compras guardadas</span><strong>{fmtBytes(u.now.photoBytes)}</strong><span className="fine">{u.now.purchases} compra(s) en la base</span></div>
				<div className="kpi"><span>Medios del admin</span><strong>{u.now.media}</strong><span className="fine">archivo(s) subido(s)</span></div>
			</div>

			<section className="panel">
				<h3>¿Se va a llenar?</h3>
				<div className="funnel">
					{u.items.map((i) => (
						<div key={i.key} className="stack" style={{gap: 6}}>
							<div className="funnel-row">
								<span>{i.label}</span>
								<div className="bar"><div style={{width: `${Math.min(100, i.pct)}%`}} /></div>
								<strong><span className={`pill ${STATUS[i.status].pill}`}>{STATUS[i.status].text}</span></strong>
							</div>
							<p className="fine">{forecast(i)}</p>
						</div>
					))}
				</div>
				<p className="fine">
					Los topes son los del plan gratuito (base 512 MB, archivos 1 GB) y se ajustan con las variables <code>DB_LIMIT_MB</code> y <code>BLOB_LIMIT_MB</code> en Vercel. Verificá los límites reales de tu plan en Neon y Vercel. La proyección usa el crecimiento de los últimos 30 días y mejora a medida que se acumulan registros; avisa «Atención» al 70 % o a menos de 45 días, y «Peligro» al 90 % o a menos de 14.
				</p>
			</section>

			<section className="panel">
				<h3>Por día</h3>
				<div className="table-wrap">
					<table className="table">
						<thead><tr><th>Día</th><th>Base</th><th>Cambio</th><th>Archivos</th><th>Cambio</th></tr></thead>
						<tbody>
							{u.daily.map((d) => (
								<tr key={d.day}>
									<td>{fmtDay(d.day)}</td><td>{fmtBytes(d.dbBytes)}</td><td>{fmtDelta(d.dbDelta)}</td><td>{fmtBytes(d.blobBytes)}</td><td>{fmtDelta(d.blobDelta)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<p className="fine">El cambio compara con el registro anterior. La base también baja sola: al vencer una compra se borran sus datos personales y su foto.</p>
			</section>

			<section className="panel">
				<h3>Por mes</h3>
				<div className="table-wrap">
					<table className="table">
						<thead><tr><th>Mes</th><th>Base al cierre</th><th>Creció</th><th>Archivos al cierre</th><th>Crecieron</th></tr></thead>
						<tbody>
							{u.monthly.map((m) => (
								<tr key={m.month}>
									<td>{fmtMonth(m.month)}</td><td>{fmtBytes(m.dbBytes)}</td><td>{fmtDelta(m.dbGrowth)}</td><td>{fmtBytes(m.blobBytes)}</td><td>{fmtDelta(m.blobGrowth)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			<section className="panel">
				<h3>Qué ocupa lugar en la base</h3>
				<div className="table-wrap">
					<table className="table">
						<thead><tr><th>Tabla</th><th>Tamaño</th></tr></thead>
						<tbody>
							{u.now.tables.map((t) => (
								<tr key={t.name}><td><code>{t.name}</code></td><td>{fmtBytes(t.bytes)}</td></tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	);
}
