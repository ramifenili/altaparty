'use client';

import React, {useEffect, useRef, useState} from 'react';
import type {WatermarkConfig} from '../config/watermark';
import {useSiteConfig} from '../state/SiteConfig';
import {SAMPLE_INVITATION, toTemplateContent} from '../domain/invitation';
import {renderFrame} from '../render/frame';
import {loadFonts} from '../render/assets';
import {loadWatermarkImage, setWatermarkConfig} from '../render/watermark';
import {adminApi} from './api';
import {useSettings} from './useSettings';

/** Marca de agua de las vistas previas: texto o imagen, transparencia (%), tamaño y separación. */
export function WatermarkTab() {
	const {settings, save, saving, msg} = useSettings();
	const [draft, setDraft] = useState<WatermarkConfig | null>(null);
	const [uploadErr, setUploadErr] = useState<string | null>(null);
	const {all} = useSiteConfig();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const wm = draft ?? settings?.watermark ?? null;

	useEffect(() => {
		if (settings && !draft) setDraft(settings.watermark);
	}, [settings, draft]);

	// vista previa en vivo con lo que se está editando (sin guardar)
	useEffect(() => {
		if (!wm || !canvasRef.current) return;
		let alive = true;
		const tpl = all[0];
		(async () => {
			setWatermarkConfig(wm);
			await Promise.all([loadFonts([...tpl.fonts, 'Montserrat']), loadWatermarkImage(wm)]);
			const ctx = canvasRef.current?.getContext('2d');
			if (alive && ctx) renderFrame(ctx, tpl, toTemplateContent(SAMPLE_INVITATION, null), tpl.thumbnailTime, {watermark: true, scale: 0.5});
		})();
		return () => {
			alive = false;
		};
	}, [wm, all]);

	if (!settings || !wm) return <p className="alert alert-info">Cargando…</p>;
	const set = <K extends keyof WatermarkConfig>(k: K, v: WatermarkConfig[K]) => setDraft({...wm, [k]: v});

	return (
		<div className="admin-two">
			<div className="stack">
				<p className="lead" style={{fontSize: 15}}>La marca de agua se incrusta en cada fotograma de la vista previa. Los clientes no pueden quitarla ni cambiarla.</p>
				<div className="field">
					<span className="label">Tipo</span>
					<div className="chips" role="group" aria-label="Tipo de marca de agua">
						<button type="button" className="chip" aria-pressed={wm.mode === 'text'} onClick={() => set('mode', 'text')}>Texto</button>
						<button type="button" className="chip" aria-pressed={wm.mode === 'image'} onClick={() => set('mode', 'image')}>Imagen / logo</button>
					</div>
				</div>
				{wm.mode === 'text' ? (
					<div className="field">
						<label htmlFor="wm-text">Texto que se repite</label>
						<input id="wm-text" className="input" value={wm.text} maxLength={60} onChange={(e) => set('text', e.target.value)} />
					</div>
				) : (
					<div className="field">
						<label htmlFor="wm-img">Imagen (PNG con fondo transparente recomendado)</label>
						<input
							id="wm-img"
							type="file"
							accept="image/png,image/jpeg,image/webp"
							onChange={async (e) => {
								const f = e.target.files?.[0];
								e.target.value = '';
								if (!f) return;
								setUploadErr(null);
								try {
									const m = await adminApi.uploadMedia(f);
									if (m.kind !== 'image') throw new Error('Subí una imagen.');
									set('imageSrc', `/api/media/${m.id}`);
								} catch (x) {
									setUploadErr(x instanceof Error ? x.message : 'No se pudo subir.');
								}
							}}
						/>
						<p className="hint">Imagen actual: <code>{wm.imageSrc}</code>. Si no carga, se usa el texto.</p>
						{uploadErr && <p className="error-text">{uploadErr}</p>}
					</div>
				)}
				<Slider label={`Opacidad: ${wm.opacityPercent} %`} min={10} max={100} step={1} value={wm.opacityPercent} onChange={(v) => set('opacityPercent', v)} hint="Más bajo = más sutil. Mínimo 10 % para que nunca desaparezca." />
				{wm.mode === 'text' ? (
					<Slider label={`Tamaño del texto: ${wm.textSize}px`} min={14} max={80} step={1} value={wm.textSize} onChange={(v) => set('textSize', v)} />
				) : (
					<Slider label={`Ancho de la imagen: ${wm.imageWidth}px`} min={60} max={600} step={10} value={wm.imageWidth} onChange={(v) => set('imageWidth', v)} />
				)}
				<Slider label={`Separación horizontal: ${wm.spacingX}px`} min={200} max={1200} step={20} value={wm.spacingX} onChange={(v) => set('spacingX', v)} />
				<Slider label={`Separación vertical: ${wm.spacingY}px`} min={80} max={600} step={10} value={wm.spacingY} onChange={(v) => set('spacingY', v)} />
				<Slider label={`Inclinación: ${wm.angleDeg}°`} min={-90} max={90} step={1} value={wm.angleDeg} onChange={(v) => set('angleDeg', v)} />
				<Slider label={`Movimiento: ${wm.driftPerSecond} px/s`} min={0} max={200} step={2} value={wm.driftPerSecond} onChange={(v) => set('driftPerSecond', v)} hint="Un patrón que se mueve es más difícil de recortar." />
				<label className="switch">
					<input type="checkbox" checked={wm.centerStamp} onChange={(e) => set('centerStamp', e.target.checked)} />
					<span>Sello central (recomendado)</span>
				</label>
				{wm.centerStamp && (
					<div className="row-2">
						<div className="field"><label htmlFor="wm-t1">Título del sello</label><input id="wm-t1" className="input" value={wm.centerStampTitle} maxLength={30} onChange={(e) => set('centerStampTitle', e.target.value)} /></div>
						<div className="field"><label htmlFor="wm-t2">Subtítulo</label><input id="wm-t2" className="input" value={wm.centerStampSubtitle} maxLength={60} onChange={(e) => set('centerStampSubtitle', e.target.value)} /></div>
					</div>
				)}
				<div className="actions-bar">
					<button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save({...settings, watermark: wm})}>
						{saving && <span className="spinner" aria-hidden="true" />} Guardar marca de agua
					</button>
				</div>
				{msg && <p className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`}>{msg.text}</p>}
			</div>
			<div>
				<p className="eyebrow">Así se ve</p>
				<canvas ref={canvasRef} width={360} height={640} style={{width: '100%', maxWidth: 300, borderRadius: 16, boxShadow: 'var(--shadow)'}} aria-label="Vista previa de la marca de agua" />
			</div>
		</div>
	);
}

function Slider({label, min, max, step, value, onChange, hint}: {label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; hint?: string}) {
	return (
		<div className="field">
			<label>
				{label}
				<input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{width: '100%', display: 'block', marginTop: 6}} />
			</label>
			{hint && <p className="hint">{hint}</p>}
		</div>
	);
}
