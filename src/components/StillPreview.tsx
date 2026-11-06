'use client';

import type {TemplateContent, TemplateDefinition} from '../templates/types';
import {TemplateCanvas} from './TemplateCanvas';
import {Clapperboard, Image, Share2, ShoppingCart} from 'lucide-react';

/** Vista previa de la imagen 1080×1920 (con marca de agua mientras no se compra). */
export function StillPreview({template, content, watermark = true, scale = 0.6}: {template: TemplateDefinition; content: TemplateContent; watermark?: boolean; scale?: number}) {
	return (
		<div className="still-preview">
			<div className="player">
				<TemplateCanvas template={template} content={content} poster scale={scale} watermark={watermark} label="Imagen de tu invitación (1080×1920)" />
			</div>
			<p className="fine" style={{textAlign: 'center'}}>
				Imagen vertical 1080×1920 (PNG y JPG) con el estilo del video, lista para WhatsApp, estados e Instagram.
			</p>
		</div>
	);
}

/** Pestañas "Video | Imagen" de las vistas previas; con `ml` (solo admin) suma "Mercado Libre" y "Compartir". */
export function PreviewTabs<M extends string>({mode, onChange, ml = false, og = false}: {mode: M; onChange: (m: M) => void; ml?: boolean; og?: boolean}) {
	return (
		<div className="preview-tabs" role="tablist" aria-label="Qué querés ver">
			<button type="button" role="tab" aria-selected={mode === 'video'} className="preview-tab" onClick={() => onChange('video' as M)}>
				<Clapperboard size={16} aria-hidden="true" /> Video
			</button>
			<button type="button" role="tab" aria-selected={mode === 'image'} className="preview-tab" onClick={() => onChange('image' as M)}>
				<Image size={16} aria-hidden="true" /> Imagen
			</button>
			{ml && (
				<button type="button" role="tab" aria-selected={mode === 'ml'} className="preview-tab" onClick={() => onChange('ml' as M)}>
					<ShoppingCart size={16} aria-hidden="true" /> Mercado Libre
				</button>
			)}
			{og && (
				<button type="button" role="tab" aria-selected={mode === 'og'} className="preview-tab" onClick={() => onChange('og' as M)}>
					<Share2 size={16} aria-hidden="true" /> Compartir
				</button>
			)}
		</div>
	);
}
