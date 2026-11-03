'use client';

import React, {useEffect, useState} from 'react';
import type {SiteSettings} from '../config/site';
import {formatArs, imagePromoPrice, videoPromoPrice} from '../config/pricing';
import {useSettings} from './useSettings';

/** Precio, vencimiento de las compras, límite de generaciones y analítica. */
export function SettingsTab() {
	const {settings, save, saving, msg} = useSettings();
	const [d, setD] = useState<SiteSettings | null>(null);
	useEffect(() => {
		if (settings && !d) setD(settings);
	}, [settings, d]);
	if (!d || !settings) return <p className="alert alert-info">Cargando…</p>;
	const num = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0;
	// lo que paga quien compra en dos veces, para avisar si le conviene más que el combo
	const imageThenVideo = d.imagePrice + videoPromoPrice(d);
	const videoThenImage = d.price + imagePromoPrice(d);

	return (
		<form
			className="stack"
			style={{maxWidth: 640}}
			onSubmit={(e) => {
				e.preventDefault();
				void save(d).then((s) => s && setD(s));
			}}
		>
			<section className="panel">
				<h3>Precio</h3>
				<div className="row-2">
					<div className="field">
						<label htmlFor="s-price">Precio actual (ARS)</label>
						<input id="s-price" className="input" inputMode="numeric" value={d.price} onChange={(e) => setD({...d, price: num(e.target.value)})} />
					</div>
					<div className="field">
						<label htmlFor="s-ref">Precio de referencia tachado (ARS)</label>
						<input id="s-ref" className="input" inputMode="numeric" value={d.referencePrice} onChange={(e) => setD({...d, referencePrice: num(e.target.value)})} />
					</div>
				</div>
				<div className="row-2">
					<div className="field">
						<label htmlFor="s-img">Precio de solo la imagen 1080×1920 (ARS)</label>
						<input id="s-img" className="input" inputMode="numeric" value={d.imagePrice} onChange={(e) => setD({...d, imagePrice: num(e.target.value)})} />
					</div>
					<div className="field">
						<label htmlFor="s-bundle">Precio de video + imagen (ARS)</label>
						<input id="s-bundle" className="input" inputMode="numeric" value={d.bundlePrice} onChange={(e) => setD({...d, bundlePrice: num(e.target.value)})} />
						<p className="hint">Se muestra el ahorro frente a comprar las dos cosas por separado ({'precio actual + imagen'}).</p>
					</div>
				</div>
				<h3 style={{marginTop: 18}}>Promos (cuando ya compró el otro producto)</h3>
				<div className="row-2">
					<div className="field">
						<label htmlFor="s-vup">Video si ya compró la imagen (ARS)</label>
						<input id="s-vup" className="input" inputMode="numeric" value={d.videoUpgrade || ''} placeholder={`Automático: ${formatArs(videoPromoPrice({...d, videoUpgrade: 0}))}`} onChange={(e) => setD({...d, videoUpgrade: num(e.target.value)})} />
						<p className="hint">Se muestra tachado el precio normal del video ({formatArs(d.price)}).</p>
					</div>
					<div className="field">
						<label htmlFor="s-iup">Imagen si ya compró el video (ARS)</label>
						<input id="s-iup" className="input" inputMode="numeric" value={d.imageUpgrade || ''} placeholder={`Automático: ${formatArs(imagePromoPrice({...d, imageUpgrade: 0}))}`} onChange={(e) => setD({...d, imageUpgrade: num(e.target.value)})} />
						<p className="hint">Se muestra tachado el precio normal de la imagen ({formatArs(d.imagePrice)}).</p>
					</div>
				</div>
				<p className="hint">Dejalos vacíos para que se calculen solos. No pueden superar el precio normal.</p>
				{imageThenVideo < d.bundlePrice && (
					<p className="alert alert-info">
						Ojo: comprar la imagen y después el video ({formatArs(imageThenVideo)}) sale más barato que el combo ({formatArs(d.bundlePrice)}).
					</p>
				)}
				{videoThenImage < d.bundlePrice && (
					<p className="alert alert-info">
						Ojo: comprar el video y después la imagen ({formatArs(videoThenImage)}) sale más barato que el combo ({formatArs(d.bundlePrice)}).
					</p>
				)}
				<label className="switch">
					<input type="checkbox" checked={d.showReferencePrice} onChange={(e) => setD({...d, showReferencePrice: e.target.checked})} />
					<span>Mostrar el precio tachado (solo si corresponde a una promoción real)</span>
				</label>
				<p className="hint">El cobro usa SIEMPRE el precio guardado en el servidor. Cada compra conserva el precio con el que se creó.</p>
			</section>

			<section className="panel">
				<h3>Compras</h3>
				<div className="row-2">
					<div className="field">
						<label htmlFor="s-ret">Días para descargar</label>
						<input id="s-ret" className="input" inputMode="numeric" value={d.retentionDays} onChange={(e) => setD({...d, retentionDays: num(e.target.value)})} />
						<p className="hint">Pasado ese plazo (contado desde el pago) la compra vence y se borran los datos y la foto del cliente automáticamente.</p>
					</div>
					<div className="field">
						<label htmlFor="s-max">Creaciones por compra</label>
						<input id="s-max" className="input" inputMode="numeric" value={d.maxFinalRenders} onChange={(e) => setD({...d, maxFinalRenders: num(e.target.value)})} />
						<p className="hint">Cuántas veces puede crear el video final con una misma compra.</p>
					</div>
				</div>
				<p className="hint">Los cambios rigen para compras nuevas.</p>
			</section>

			<section className="panel">
				<h3>Analítica</h3>
				<div className="row-2">
					<div className="field">
						<label htmlFor="s-ga">Google Analytics 4 (ID de medición)</label>
						<input id="s-ga" className="input" placeholder="G-XXXXXXXXXX" value={d.analytics.gaId} onChange={(e) => setD({...d, analytics: {...d.analytics, gaId: e.target.value.trim()}})} />
					</div>
					<div className="field">
						<label htmlFor="s-cl">Microsoft Clarity (ID del proyecto)</label>
						<input id="s-cl" className="input" placeholder="abcd1234ef" value={d.analytics.clarityId} onChange={(e) => setD({...d, analytics: {...d.analytics, clarityId: e.target.value.trim()}})} />
					</div>
				</div>
				<p className="hint">Se cargan solo si el visitante acepta el aviso de cookies. Dejá vacío para desactivarlos. Los contadores propios del embudo funcionan siempre y no usan cookies.</p>
			</section>

			<div className="actions-bar">
				<button type="submit" className="btn btn-primary" disabled={saving}>
					{saving && <span className="spinner" aria-hidden="true" />} Guardar ajustes
				</button>
			</div>
			{msg && <p className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`}>{msg.text}</p>}
		</form>
	);
}
