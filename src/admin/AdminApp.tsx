'use client';

import React, {useEffect, useState} from 'react';
import {adminApi, AdminApiError} from './api';
import {StatsTab} from './StatsTab';
import {TemplatesTab} from './TemplatesTab';
import {WatermarkTab} from './WatermarkTab';
import {SettingsTab} from './SettingsTab';
import {ClaimsTab} from './ClaimsTab';
import {getParams, setParams} from './url';

const TABS = [
	{id: 'resumen', label: '📊 Resumen'},
	{id: 'gratis', label: '🎁 Canjes gratis'},
	{id: 'plantillas', label: '🎞 Plantillas'},
	{id: 'marca', label: '💧 Marca de agua'},
	{id: 'ajustes', label: '⚙️ Ajustes'},
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Panel interno: ventas, estadísticas, plantillas, marca de agua y ajustes. */
export function AdminApp() {
	const [auth, setAuth] = useState<'checking' | 'out' | 'in' | 'disabled'>('checking');
	const [testMode, setTestMode] = useState(false);
	const [tab, setTab] = useState<TabId>('resumen');

	useEffect(() => {
		adminApi
			.me()
			.then((r) => {
				setTestMode(r.testMode);
				const t = getParams().get('tab');
				const found = TABS.find((x) => x.id === t);
				if (found) setTab(found.id);
				setAuth('in');
			})
			.catch((e) => setAuth(e instanceof AdminApiError && e.http === 503 ? 'disabled' : 'out'));
	}, []);

	// botón Atrás / Adelante del navegador
	useEffect(() => {
		const onPop = () => {
			const found = TABS.find((x) => x.id === getParams().get('tab'));
			setTab(found?.id ?? 'resumen');
		};
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, []);

	if (auth === 'checking') return <main><p className="alert alert-info">Cargando…</p></main>;
	if (auth === 'disabled') {
		return (
			<main>
				<div className="panel" style={{maxWidth: 560, margin: '40px auto'}}>
					<h1 style={{fontSize: 28}}>Panel desactivado</h1>
					<p className="lead">Definí la variable <code>ADMIN_PASSWORD</code> (mínimo 8 caracteres) en el servidor y reiniciá para activarlo.</p>
				</div>
			</main>
		);
	}
	if (auth === 'out') return <Login onDone={() => location.reload()} />;

	return (
		<>
			<header className="app-header">
				<span className="brand">
					<span className="brand-mark" aria-hidden="true">🛠</span> Panel interno
				</span>
				<span style={{display: 'flex', gap: 8}}>
					<a className="btn btn-secondary btn-sm" href="/" target="_blank" rel="noreferrer">Ver el sitio ↗</a>
					<button
						type="button"
						className="btn btn-secondary btn-sm"
						onClick={async () => {
							await adminApi.logout().catch(() => undefined);
							location.reload();
						}}
					>
						Salir
					</button>
				</span>
			</header>
			<main>
				{testMode && <p className="alert alert-info">🧪 Modo prueba local activo (pagos simulados): las compras de prueba no cuentan como ventas.</p>}
				<nav className="admin-tabs" aria-label="Secciones">
					{TABS.map((t) => (
						<button key={t.id} type="button" className="chip" aria-pressed={tab === t.id} onClick={() => {
								setTab(t.id);
								setParams({tab: t.id, video: null, scene: null, layer: null, days: null}, 'push');
							}}>
							{t.label}
						</button>
					))}
				</nav>
				{tab === 'resumen' && <StatsTab />}
				{tab === 'gratis' && <ClaimsTab />}
				{tab === 'plantillas' && <TemplatesTab />}
				{tab === 'marca' && <WatermarkTab />}
				{tab === 'ajustes' && <SettingsTab />}
			</main>
		</>
	);
}

function Login({onDone}: {onDone: () => void}) {
	const [pw, setPw] = useState('');
	const [err, setErr] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	return (
		<main>
			<form
				className="panel"
				style={{maxWidth: 420, margin: '60px auto'}}
				onSubmit={async (e) => {
					e.preventDefault();
					setBusy(true);
					setErr(null);
					try {
						await adminApi.login(pw);
						onDone();
					} catch (x) {
						setErr(x instanceof Error ? x.message : 'No se pudo iniciar sesión.');
						setBusy(false);
					}
				}}
			>
				<h1 style={{fontSize: 28}}>Panel interno</h1>
				<div className="field" style={{marginTop: 16}}>
					<label htmlFor="adm-pw">Contraseña</label>
					<input id="adm-pw" className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" autoFocus required />
					{err && <p className="error-text" role="alert">{err}</p>}
				</div>
				<button type="submit" className="btn btn-primary btn-block" style={{marginTop: 14}} disabled={busy}>
					{busy && <span className="spinner" aria-hidden="true" />} Entrar
				</button>
			</form>
		</main>
	);
}
