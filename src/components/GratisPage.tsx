'use client';

import React, {useCallback, useEffect, useState} from 'react';
import {getNetwork, GRATIS, NETWORKS, type ClaimView, type NetworkId} from '../config/gratis';
import {formatArs} from '../config/pricing';
import {useSiteConfig} from '../state/SiteConfig';
import {PURCHASE_KEY} from './OfferPanel';

const CLAIM_KEY = 'gratis:claim';

class GratisError extends Error {}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(url, {...init, cache: 'no-store', headers: {'Content-Type': 'application/json'}});
	} catch {
		throw new GratisError('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.');
	}
	const data = (await res.json().catch(() => ({}))) as {message?: string};
	if (!res.ok) throw new GratisError(data.message ?? 'Ocurrió un error inesperado.');
	return data as T;
}

const fmtNum = (n: number) => n.toLocaleString('es-AR');

/** Programa "Video gratis a cambio de difusión": se publica la vista previa y, si llega a las vistas, el video sin marca de agua es gratis. */
export function GratisPage() {
	const {config, catalog} = useSiteConfig();
	const [claim, setClaim] = useState<ClaimView | null>(null);
	const [lookup, setLookup] = useState('');
	const [lookupErr, setLookupErr] = useState<string | null>(null);

	const [network, setNetwork] = useState<NetworkId>('instagram');
	const [url, setUrl] = useState('');
	const [views, setViews] = useState('');
	const [contact, setContact] = useState('');
	const [templateId, setTemplateId] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const net = getNetwork(network)!;
	const tpl = templateId || catalog[0]?.id || '';

	const load = useCallback(async (id: string) => {
		setLookupErr(null);
		try {
			const c = await call<ClaimView>(`/api/gratis/${encodeURIComponent(id)}`);
			setClaim(c);
			try { localStorage.setItem(CLAIM_KEY, c.claimId); } catch { /* sin almacenamiento */ }
		} catch (e) {
			setLookupErr(e instanceof Error ? e.message : 'No pudimos consultar el canje.');
		}
	}, []);

	useEffect(() => {
		let saved: string | null = null;
		try { saved = localStorage.getItem(CLAIM_KEY); } catch { /* sin almacenamiento */ }
		if (saved) void load(saved);
	}, [load]);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const c = await call<ClaimView>('/api/gratis', {method: 'POST', body: JSON.stringify({network, url, views: Number(views), contact, templateId: tpl})});
			setClaim(c);
			try { localStorage.setItem(CLAIM_KEY, c.claimId); } catch { /* sin almacenamiento */ }
		} catch (err) {
			setError(err instanceof Error ? err.message : 'No pudimos enviar el canje.');
		} finally {
			setBusy(false);
		}
	};

	const useCode = () => {
		if (!claim?.purchaseId) return;
		try { localStorage.setItem(PURCHASE_KEY, JSON.stringify({purchaseId: claim.purchaseId})); } catch { /* sin almacenamiento */ }
		window.location.href = '/';
	};

	return (
		<>
			<header className="app-header">
				<a className="brand" href="/" aria-label="Ir al inicio">
					<span className="brand-mark" aria-hidden="true">🎉</span>
					AltaParty
				</a>
				<a className="btn btn-secondary btn-sm" href="/">← Crear mi invitación</a>
			</header>

			<main>
				<div className="home-intro">
					<p className="eyebrow">Programa de difusión</p>
					<h1>Publicá tu invitación. <em>Si la ven, es gratis.</em></h1>
					<p className="lead">
						Subí la vista previa a tu red social, etiquetanos y, cuando llegue a {fmtNum(NETWORKS[0].threshold)} vistas, te regalamos el video final sin marca de agua
						(normalmente {formatArs(config.pricing.price)}). Sin pagar nada por adelantado.
					</p>
				</div>

				<ol className="gratis-steps" aria-label="Cómo funciona">
					<li className="panel">
						<span className="num">1</span>
						<h3>Armá y descargá la vista previa</h3>
						<p className="hint">Elegí tu diseño, cargá los datos de la fiesta y bajá la vista previa con marca de agua. Es gratis y no necesita cuenta.</p>
					</li>
					<li className="panel">
						<span className="num">2</span>
						<h3>Publicala en modo público</h3>
						<p className="hint">En Instagram, TikTok, Facebook, YouTube Shorts o X. Etiquetá <strong>@{GRATIS.handle}</strong> y poné <strong>{GRATIS.hashtag}</strong>. Dejala pública al menos {GRATIS.keepPublicDays} días.</p>
					</li>
					<li className="panel">
						<span className="num">3</span>
						<h3>Mandanos el enlace</h3>
						<p className="hint">Cuando llegue a las vistas, completá el formulario. Una persona lo revisa (en menos de {GRATIS.reviewHours} h) y te damos tu código para bajar el video sin marca.</p>
					</li>
				</ol>

				<section aria-labelledby="redes-title" style={{marginTop: 28}}>
					<h2 id="redes-title" style={{fontSize: 26}}>Elegí tu red</h2>
					<ul className="gratis-nets">
						{NETWORKS.map((n) => (
							<li key={n.id} className="panel">
								<span aria-hidden="true" style={{fontSize: 26}}>{n.icon}</span>
								<strong>{n.name}</strong>
								<span className="hint">{n.format}</span>
								<span className="gratis-views">{fmtNum(n.threshold)} vistas</span>
								{n.note && <span className="hint">{n.note}</span>}
							</li>
						))}
					</ul>
					<p className="hint" style={{marginTop: 10}}>
						Los <em>Estados</em> y <em>Stories</em> de WhatsApp o Instagram no sirven: desaparecen y no podemos comprobar las vistas.
						Con una sola publicación alcanza; no se suman vistas de varios posteos.
					</p>
				</section>

				<section className="panel" style={{marginTop: 28}} aria-labelledby="canje-title">
					{claim ? (
						<ClaimResult claim={claim} onUse={useCode} onRefresh={() => void load(claim.claimId)} onNew={() => { setClaim(null); try { localStorage.removeItem(CLAIM_KEY); } catch { /* */ } }} />
					) : (
						<>
							<p className="eyebrow">Paso 3</p>
							<h2 id="canje-title" style={{fontSize: 26}}>Canjeá tu video gratis</h2>
							<form onSubmit={submit} className="form-grid" noValidate>
								<div className="field">
									<label htmlFor="g-net">Red social</label>
									<select id="g-net" className="input" value={network} onChange={(e) => setNetwork(e.target.value as NetworkId)}>
										{NETWORKS.map((n) => <option key={n.id} value={n.id}>{n.name} (mínimo {fmtNum(n.threshold)} vistas)</option>)}
									</select>
								</div>
								<div className="field">
									<label htmlFor="g-url">Enlace de tu publicación</label>
									<input id="g-url" className="input" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={`https://www.${net.hosts[0]}/...`} autoComplete="off" />
								</div>
								<div className="field">
									<label htmlFor="g-views">Vistas que muestra hoy</label>
									<input id="g-views" className="input" inputMode="numeric" value={views} onChange={(e) => setViews(e.target.value.replace(/\D/g, ''))} placeholder={String(net.threshold)} />
									<p className="hint">Lo comprobamos abriendo el enlace. Tiene que ser público y con el contador de vistas visible.</p>
								</div>
								<div className="field">
									<label htmlFor="g-tpl">Diseño que querés recibir</label>
									<select id="g-tpl" className="input" value={tpl} onChange={(e) => setTemplateId(e.target.value)}>
										{catalog.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
									</select>
								</div>
								<div className="field">
									<label htmlFor="g-contact">Tu email o WhatsApp</label>
									<input id="g-contact" className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="nombre@email.com o 11 2345 6789" autoComplete="email" />
									<p className="hint">Solo para avisarte. Lo borramos 90 días después de resolver el canje.</p>
								</div>
								{error && <p className="error-text" role="alert">{error}</p>}
								<button type="submit" className="btn btn-primary" disabled={busy || !tpl}>
									{busy && <span className="spinner" aria-hidden="true" />} Enviar mi canje
								</button>
							</form>
							<details style={{marginTop: 16}}>
								<summary style={{cursor: 'pointer', fontWeight: 700}}>¿Ya enviaste tu canje? Consultá el estado</summary>
								<form className="form-grid" onSubmit={(e) => { e.preventDefault(); if (lookup.trim()) void load(lookup.trim()); }}>
									<div className="field">
										<label htmlFor="g-look">Código de seguimiento</label>
										<input id="g-look" className="input" value={lookup} onChange={(e) => setLookup(e.target.value)} autoComplete="off" />
										{lookupErr && <p className="error-text" role="alert">{lookupErr}</p>}
									</div>
									<button type="submit" className="btn btn-secondary">Consultar</button>
								</form>
							</details>
						</>
					)}
				</section>

				<section className="panel" style={{marginTop: 28}} aria-labelledby="reglas-title">
					<h2 id="reglas-title" style={{fontSize: 26}}>Reglas</h2>
					<ul className="gratis-rules">
						<li>Las vistas tienen que ser orgánicas: no se aceptan vistas compradas, bots ni publicidad paga.</li>
						<li>Podés publicar las veces que quieras, pero <strong>una sola publicación</strong> tiene que llegar al mínimo.</li>
						<li>La publicación debe mostrar la vista previa de tu invitación (con la marca de agua visible) y estar pública al menos {GRATIS.keepPublicDays} días.</li>
						<li>Un canje por persona cada {GRATIS.perContactDays} días y un enlace sirve una sola vez.</li>
						<li>Cada canje lo revisa una persona y su decisión es final. El código gratis vence a los {config.pricing.retentionDays} días y permite hasta {config.pricing.maxFinalRenders} generaciones, igual que una compra.</li>
						<li>Tu video y tu cuenta son tuyos. Podemos compartir tu publicación con crédito, salvo que nos pidas que no.</li>
						<li>¿Preferís no publicar? Podés <a href="/">comprarlo</a> por {formatArs(config.pricing.price)} con Mercado Pago.</li>
					</ul>
				</section>
			</main>

			<footer className="site-footer">
				<p>Las plantillas son diseños originales; no son productos oficiales ni están afiliadas a ninguna marca. El programa puede cambiar; los canjes aprobados se respetan.</p>
			</footer>
		</>
	);
}

function ClaimResult({claim, onUse, onRefresh, onNew}: {claim: ClaimView; onUse: () => void; onRefresh: () => void; onNew: () => void}) {
	return (
		<div role="status">
			<p className="eyebrow">Tu canje</p>
			{claim.status === 'pending' && (
				<>
					<h2 style={{fontSize: 26}}>Recibimos tu canje ⏳</h2>
					<p className="lead">Lo estamos revisando; te respondemos en menos de {GRATIS.reviewHours} horas. Volvé a esta página y tocá <em>Actualizar</em>.</p>
				</>
			)}
			{claim.status === 'approved' && claim.purchaseId && (
				<>
					<h2 style={{fontSize: 26}}>¡Aprobado! 🎉 Tu video es gratis</h2>
					<p className="lead">Tocá el botón y te llevamos al generador con tu código ya cargado.</p>
					<p className="fine">Código: <code>{claim.purchaseId}</code></p>
					<div className="actions-bar" style={{marginTop: 12}}>
						<button type="button" className="btn btn-primary" onClick={onUse}>Usar mi código →</button>
					</div>
				</>
			)}
			{claim.status === 'rejected' && (
				<>
					<h2 style={{fontSize: 26}}>No pudimos aprobar este canje</h2>
					<p className="alert alert-error">{claim.note || 'No pudimos comprobar las vistas o la publicación. Revisá que sea pública y que muestre el contador de vistas.'}</p>
				</>
			)}
			<p className="fine">Código de seguimiento (guardalo): <code>{claim.claimId}</code></p>
			<div className="actions-bar" style={{marginTop: 12}}>
				{claim.status === 'pending' && <button type="button" className="btn btn-secondary" onClick={onRefresh}>🔄 Actualizar</button>}
				{claim.status === 'rejected' && <button type="button" className="btn btn-secondary" onClick={onNew}>Enviar otro canje</button>}
			</div>
		</div>
	);
}
