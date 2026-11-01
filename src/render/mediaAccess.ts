// Carga los medios (imágenes y videos) de un video compilado para dibujarlos
// en la vista previa, las miniaturas y el exportador.

import type {MediaAccess} from '../templates/types';
import {specMediaIds, type CompiledSpec} from '../templates/compiled-types';

export const mediaUrl = (id: string) => `/api/media/${id}`;

type Img = CanvasImageSource & {width: number; height: number};

/** 'none': solo imágenes · 'first-frame': además un fotograma fijo de cada video · 'play': videos en reproducción */
export type VideoMode = 'none' | 'first-frame' | 'play';

async function loadImage(id: string): Promise<ImageBitmap | null> {
	try {
		const res = await fetch(mediaUrl(id));
		if (!res.ok) return null;
		return await createImageBitmap(await res.blob());
	} catch {
		return null;
	}
}

function loadVideo(id: string): Promise<HTMLVideoElement | null> {
	return new Promise((resolve) => {
		const v = document.createElement('video');
		v.muted = true;
		v.playsInline = true;
		v.loop = true;
		v.preload = 'auto';
		v.crossOrigin = 'anonymous';
		const done = (ok: boolean) => resolve(ok ? v : null);
		v.onloadeddata = () => done(true);
		v.onerror = () => done(false);
		v.src = mediaUrl(id);
		setTimeout(() => done(v.readyState >= 2), 15000);
	});
}

export class CompiledMedia implements MediaAccess {
	private images = new Map<string, ImageBitmap>();
	private statics = new Map<number, ImageBitmap>();
	private videos = new Map<number, HTMLVideoElement>();
	private active = -1;
	private playing = true;

	/** `onlyScene`: en modo 'first-frame', solo carga el video de esa escena (miniaturas livianas). */
	static async load(spec: CompiledSpec, mode: VideoMode, onlyScene?: number): Promise<CompiledMedia> {
		const m = new CompiledMedia();
		const {images, videos} = specMediaIds(spec);
		await Promise.all(
			images.map(async (id) => {
				const bmp = await loadImage(id);
				if (bmp) m.images.set(id, bmp);
			})
		);
		if (mode !== 'none') {
			await Promise.all(
				spec.scenes.map(async (sc, i) => {
					if (sc.bg.kind !== 'video' || !videos.includes(sc.bg.mediaId)) return;
					if (mode === 'first-frame' && onlyScene !== undefined && i !== onlyScene) return;
					const v = await loadVideo(sc.bg.mediaId);
					if (!v) return;
					if (mode === 'play') {
						m.videos.set(i, v);
						return;
					}
					// fotograma fijo para miniaturas
					v.currentTime = Math.min(0.8, (v.duration || 1) / 2);
					await new Promise<void>((r) => {
						v.onseeked = () => r();
						setTimeout(r, 4000);
					});
					try {
						m.statics.set(i, await createImageBitmap(v));
					} catch {
						/* sin fotograma */
					}
				})
			);
		}
		return m;
	}

	image(id: string): Img | null {
		return this.images.get(id) ?? null;
	}

	videoFrame(sceneIndex: number, localTime: number): Img | null {
		const v = this.videos.get(sceneIndex);
		if (!v || v.readyState < 2) return this.statics.get(sceneIndex) ?? null;
		const dur = v.duration || 1;
		const want = localTime % dur;
		if (this.active !== sceneIndex) {
			this.videos.get(this.active)?.pause();
			this.active = sceneIndex;
			v.currentTime = want;
		} else if (Math.abs(v.currentTime - want) > 0.6 && Math.abs(v.currentTime - want) < dur - 0.6) {
			v.currentTime = want;
		} else if (!this.playing && Math.abs(v.currentTime - want) > 0.05) {
			// en pausa (p. ej. al mover la barra de la vista previa) el fotograma sigue la posición elegida
			v.currentTime = want;
		}
		if (this.playing && v.paused) void v.play().catch(() => undefined);
		return Object.assign(v, {width: v.videoWidth, height: v.videoHeight}) as unknown as Img;
	}

	setPlaying(p: boolean) {
		this.playing = p;
		if (!p) this.videos.forEach((v) => v.pause());
	}

	/** Imágenes decodificadas para transferirlas al Worker de exportación. */
	async cloneImages(): Promise<{id: string; bitmap: ImageBitmap}[]> {
		return Promise.all([...this.images].map(async ([id, b]) => ({id, bitmap: await createImageBitmap(b)})));
	}

	dispose() {
		this.videos.forEach((v) => {
			v.pause();
			v.removeAttribute('src');
			v.load();
		});
		this.images.forEach((b) => b.close());
		this.statics.forEach((b) => b.close());
		this.videos.clear();
		this.images.clear();
		this.statics.clear();
	}
}
