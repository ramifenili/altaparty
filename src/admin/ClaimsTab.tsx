'use client';

import React, {useCallback, useEffect, useState} from 'react';
import {adminApi} from './api';
import {getNetwork} from '../config/gratis';
import {useSiteConfig} from '../state/SiteConfig';
import type {ClaimRecord} from '../server/db';
import {Icon} from '../components/Icon';

const fmtDate = (ms: number) => new Date(ms).toLocaleString('es-AR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
const STATE = {pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado'} as const;

/** Revisión de canjes gratis: abrir el enlace, comprobar las vistas y aprobar (crea el código) o rechazar. */
export function ClaimsTab() {
	const [rows, setRows] = useState<ClaimRecord[] | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const {all} = useSiteConfig();
	const name = (id: string) => all.find((t) => t.id === id)?.name ?? id;

	const reload = useCallback(() => {
		adminApi.listClaims().then(setRows).catch((e) => setErr(e.message));
	}, []);
	useEffect(reload, [reload]);

	const decide = async (c: ClaimRecord, action: 'approve' | 'reject') => {
		let note: string | undefined;
		if (action === 'reject') {
			const n = window.prompt('Motivo (lo ve la persona; opcional):', '');
			if (n === null) return;
			note = n;
		} else if (!window.confirm(`¿Comprobaste que ${c.url} es público y llegó a las vistas? Se crea un código gratis.`)) return;
		setBusy(c.id);
		try {
			await adminApi.decideClaim(c.id, action, note);
			reload();
		} catch (e) {
			setErr(e instanceof Error ? e.message : 'No se pudo guardar.');
		} finally {
			setBusy(null);
		}
	};

	if (err) return <p className="alert alert-error">{err}</p>;
	if (!rows) return <p className="alert alert-info">Cargando…</p>;
	const pending = rows.filter((r) => r.status === 'pending').length;

	return (
		<div className="stack">
			<p className="alert alert-info">{pending} pendiente{pending === 1 ? '' : 's'}. Abrí el enlace, mirá el contador de vistas y recién ahí aprobá.</p>
			{rows.length === 0 && <p className="empty panel">Todavía no hay canjes.</p>}
			{rows.map((c) => {
				const net = getNetwork(c.network);
				return (
					<div key={c.id} className="panel">
						<p><strong>{STATE[c.status]}</strong> · {net && <Icon name={net.icon} />} {net?.name} · {fmtDate(c.createdAt)} · {name(c.templateId)}</p>
						<p><a href={c.url} target="_blank" rel="noreferrer noopener">{c.url}</a></p>
						<p className="hint">Declaró {c.views.toLocaleString('es-AR')} vistas (mínimo {net?.threshold.toLocaleString('es-AR')}) · Contacto: {c.contact ? c.contact.replace(/^wa:/, 'WhatsApp +') : '(borrado)'}</p>
						{c.note && <p className="hint">Nota: {c.note}</p>}
						{c.purchaseId && <p className="fine">Código: <code>{c.purchaseId}</code></p>}
						{c.status === 'pending' && (
							<div className="actions-bar" style={{marginTop: 10}}>
								<button type="button" className="btn btn-primary btn-sm" disabled={busy === c.id} onClick={() => void decide(c, 'approve')}>Aprobar</button>
								<button type="button" className="btn btn-secondary btn-sm" disabled={busy === c.id} onClick={() => void decide(c, 'reject')}>Rechazar</button>
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
