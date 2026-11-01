'use client';

import {useEffect, useRef, useState} from 'react';
import type {TemplateContent, TemplateDefinition} from '../templates/types';
import {renderFrame, renderPoster} from '../render/frame';
import {loadFonts} from '../render/assets';
import {loadTemplateAssets} from '../templates/assets';
import {loadWatermarkImage} from '../render/watermark';
import {CompiledMedia} from '../render/mediaAccess';

/**
 * Dibuja una plantilla en un canvas pequeño (miniaturas).
 * - Estático en el instante más representativo, o animado si `animate` es true.
 * - `range` limita la animación a un tramo [desde, hasta] en segundos (en bucle),
 *   para que el hover muestre solo un adelanto y no el video completo.
 * - `watermark` pinta la marca de agua dentro del canvas.
 */
export function TemplateCanvas({
	template,
	content,
	animate = false,
	scale = 0.3,
	label,
	at,
	range,
	watermark = false,
	poster = false,
}: {
	template: TemplateDefinition;
	content: TemplateContent;
	animate?: boolean;
	scale?: number;
	label?: string;
	at?: number;
	range?: [number, number];
	watermark?: boolean;
	/** dibuja la imagen 1080×1920 (diseño propio de la plantilla) en vez de un cuadro del video */
	poster?: boolean;
}) {
	const ref = useRef<HTMLCanvasElement>(null);
	const [ready, setReady] = useState(false);
	const mediaRef = useRef<CompiledMedia | null>(null);
	// miniaturas perezosas: no se cargan ni se animan hasta que el canvas está cerca de la pantalla
	const [near, setNear] = useState(false);
	const [inView, setInView] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el || typeof IntersectionObserver === 'undefined') {
			setNear(true);
			setInView(true);
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				const hit = entries.some((e) => e.isIntersecting);
				setInView(hit);
				if (hit) setNear(true);
			},
			{rootMargin: '200px'}
		);
		io.observe(el);
		return () => io.disconnect();
	}, []);

	useEffect(() => {
		if (!near) return;
		let alive = true;
		setReady(false);
		Promise.all([
			loadFonts([...template.fonts, 'Montserrat']),
			// miniatura: de los GIF y videos alcanza con el primer cuadro
			loadTemplateAssets(template, {still: true}),
			watermark ? loadWatermarkImage() : null,
			template.spec ? CompiledMedia.load(template.spec, 'first-frame', template.spec.thumbScene) : null,
		]).then(([, , , media]) => {
			if (!alive) return media?.dispose();
			mediaRef.current = media;
			setReady(true);
		});
		return () => {
			alive = false;
			mediaRef.current?.dispose();
			mediaRef.current = null;
		};
	}, [template, watermark, near]);

	useEffect(() => {
		const ctx = ref.current?.getContext('2d');
		if (!ready || !ctx) return;
		const draw = (t: number) =>
			poster ? renderPoster(ctx, template, content, {watermark, scale}) : renderFrame(ctx, template, content, t, {watermark, scale, media: mediaRef.current ?? undefined});
		if (!animate) {
			draw(at ?? template.thumbnailTime);
			return;
		}
		// fuera de la pantalla no se anima (queda el último cuadro dibujado)
		if (!inView) return;
		const [from, to] = range ?? [0, template.duration];
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			draw(from + (((now - t0) / 1000) % (to - from)));
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [ready, template, content, animate, scale, at, range, watermark, inView, poster]);

	return (
		<canvas
			ref={ref}
			width={Math.round(720 * scale)}
			height={Math.round(1280 * scale)}
			role="img"
			aria-label={label ?? `Vista de la plantilla ${template.name}`}
		/>
	);
}
