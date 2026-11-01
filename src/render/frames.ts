// Produce los fotogramas de una exportación (JPEG, o PNG transparente para los
// videos compilados con fondos de video). Usa un Worker con OffscreenCanvas
// (no se frena si la pestaña pierde el foco) y, si el navegador no lo soporta,
// cae al dibujo en el hilo principal.

import type {TemplateContent, TemplateDefinition} from '../templates/types';
import {renderFrame, frameSize} from './frame';
import {fontFileUrl} from './assets';
import {cloneTemplateImages, templateImageTransfer} from '../templates/assets';
import {getWatermarkConfig, loadWatermarkImage} from './watermark';
import type {CompiledMedia} from './mediaAccess';
import type {WorkerOut, WorkerStart} from './frameWorker';

export type FrameJob = {
	template: TemplateDefinition;
	content: TemplateContent;
	watermark: boolean;
	scale: number;
	total: number;
	format: 'jpeg' | 'png';
	/** videos compilados con fondos de video: solo capas con transparencia */
	overlayOnly: boolean;
	/** imágenes ya cargadas del video compilado */
	media: CompiledMedia | null;
	/** recibe cada fotograma en orden; el worker espera a que se escriba para seguir */
	onFrame: (index: number, bytes: Uint8Array) => Promise<void>;
	signal?: AbortSignal;
};

const fontCache = new Map<string, Promise<ArrayBuffer | null>>();
function fontData(family: string) {
	const url = fontFileUrl(family);
	if (!url) return Promise.resolve(null);
	let p = fontCache.get(family);
	if (!p) {
		p = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
		fontCache.set(family, p);
	}
	return p;
}

export function supportsWorkerRendering() {
	return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof OffscreenCanvas.prototype.convertToBlob === 'function';
}

/** Devuelve 'worker' o 'main' según cómo se produjeron los fotogramas. */
export async function produceFrames(job: FrameJob): Promise<'worker' | 'main'> {
	if (supportsWorkerRendering()) {
		const ok = await viaWorker(job);
		if (ok) return 'worker';
	}
	await viaMainThread(job);
	return 'main';
}

/** true si terminó; false si el Worker no es compatible (antes de producir ningún fotograma). */
async function viaWorker(job: FrameJob): Promise<boolean> {
	const {template, content, signal} = job;
	const families = [...new Set([...template.fonts, 'Montserrat'])];
	const fonts: WorkerStart['fonts'] = [];
	for (const family of families) {
		const data = await fontData(family);
		if (data) fonts.push({family, data: data.slice(0)});
	}
	const wmSource = await loadWatermarkImage();
	const wmCopy = job.watermark && wmSource ? await createImageBitmap(wmSource) : null;
	const photo = content.photo ? await createImageBitmap(content.photo) : null;
	const images = job.media ? await job.media.cloneImages() : [];
	const templateImages = await cloneTemplateImages(template);
	const {photo: _omit, ...plain} = content;
	void _omit;

	const worker = new Worker(new URL('./frameWorker.ts', import.meta.url), {type: 'module'});
	let written = 0;
	let started = false;
	try {
		return await new Promise<boolean>((resolve, reject) => {
			let chain = Promise.resolve();
			const onAbort = () => reject(new Error('La generación fue cancelada.'));
			signal?.addEventListener('abort', onAbort, {once: true});
			worker.onerror = (ev) => (started ? reject(new Error(ev.message || 'Falló el Worker de dibujo.')) : resolve(false));
			worker.onmessage = (e: MessageEvent<WorkerOut>) => {
				const m = e.data;
				if (m.type === 'unsupported') return resolve(false);
				if (m.type === 'error') return started ? reject(new Error(m.message)) : resolve(false);
				started = true;
				chain = chain
					.then(() => job.onFrame(m.index, new Uint8Array(m.data)))
					.then(() => {
						written++;
						worker.postMessage({type: 'ack', count: written});
						if (written === job.total) resolve(true);
					})
					.catch(reject);
			};
			const start: WorkerStart = {
				type: 'start',
				templateId: template.id,
				spec: template.spec,
				images,
				templateImages,
				content: plain,
				photo,
				watermarkImage: wmCopy,
				watermarkConfig: getWatermarkConfig(),
				fonts,
				watermark: job.watermark,
				scale: job.scale,
				fps: template.fps,
				total: job.total,
				format: job.format,
				overlayOnly: job.overlayOnly,
			};
			worker.postMessage(start, [...fonts.map((f) => f.data), ...images.map((i) => i.bitmap), ...templateImageTransfer(templateImages), ...(photo ? [photo] : []), ...(wmCopy ? [wmCopy] : [])]);
		});
	} finally {
		worker.terminate();
		photo?.close();
	}
}

async function viaMainThread(job: FrameJob) {
	const {template, content, signal} = job;
	await loadWatermarkImage();
	const {width, height} = frameSize(job.scale);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Tu navegador no pudo crear el lienzo de dibujo.');
	for (let i = 0; i < job.total; i++) {
		if (signal?.aborted) throw new Error('La generación fue cancelada.');
		renderFrame(ctx, template, content, i / template.fps, {
			watermark: job.watermark,
			scale: job.scale,
			media: job.media ?? undefined,
			overlayOnly: job.overlayOnly,
		});
		const blob = await new Promise<Blob | null>((res) => (job.format === 'png' ? canvas.toBlob(res, 'image/png') : canvas.toBlob(res, 'image/jpeg', 0.9)));
		if (!blob) throw new Error('No se pudo capturar un fotograma.');
		await job.onFrame(i, new Uint8Array(await blob.arrayBuffer()));
	}
	canvas.width = canvas.height = 0; // libera el búfer del canvas
}
