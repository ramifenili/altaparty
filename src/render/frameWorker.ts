/// <reference lib="webworker" />
// Worker que dibuja los fotogramas con OffscreenCanvas y los codifica (JPEG, o
// PNG con transparencia para los videos compilados con fondos de video).
// Al no depender del hilo principal, la exportación no se frena cuando la
// pestaña pierde el foco o queda en segundo plano.

import {getTemplate} from '../templates/registry';
import {buildCompiledTemplate} from '../templates/compiled';
import type {CompiledSpec} from '../templates/compiled-types';
import type {MediaAccess, TemplateContent, TemplateId} from '../templates/types';
import type {WatermarkConfig} from '../config/watermark';
import {renderFrame} from './frame';
import {setTemplateImages, type TemplateImageEntry} from '../templates/assets';
import {setWatermarkConfig, setWatermarkImage} from './watermark';

export type WorkerStart = {
	type: 'start';
	templateId: TemplateId;
	/** videos compilados: la definición viaja en el mensaje */
	spec?: CompiledSpec;
	images?: {id: string; bitmap: ImageBitmap}[];
	/** imágenes de las plantillas de código (public/templates/<id>/) */
	templateImages?: TemplateImageEntry[];
	content: Omit<TemplateContent, 'photo'>;
	photo: ImageBitmap | null;
	watermarkImage: ImageBitmap | null;
	watermarkConfig: WatermarkConfig;
	fonts: {family: string; data: ArrayBuffer}[];
	watermark: boolean;
	scale: number;
	fps: number;
	quality: number;
	total: number;
	format: 'jpeg' | 'png';
	overlayOnly: boolean;
};

export type WorkerOut =
	| {type: 'unsupported'; reason: string}
	| {type: 'frame'; index: number; data: ArrayBuffer}
	| {type: 'error'; message: string};

const scope = self as unknown as DedicatedWorkerGlobalScope & {fonts?: FontFaceSet};
let acked = 0;
let wake: (() => void) | null = null;

scope.onmessage = async (e: MessageEvent<WorkerStart | {type: 'ack'; count: number}>) => {
	const msg = e.data;
	if (msg.type === 'ack') {
		acked = msg.count;
		wake?.();
		return;
	}
	const post = (m: WorkerOut, transfer: Transferable[] = []) => scope.postMessage(m, transfer);
	try {
		if (typeof OffscreenCanvas === 'undefined' || !scope.fonts || typeof FontFace === 'undefined') {
			return post({type: 'unsupported', reason: 'OffscreenCanvas o fuentes en Worker no disponibles'});
		}
		for (const f of msg.fonts) {
			const face = new FontFace(f.family, f.data, {weight: '100 900'});
			await face.load();
			scope.fonts.add(face);
		}
		setTemplateImages(msg.templateImages ?? []);
		setWatermarkConfig(msg.watermarkConfig);
		setWatermarkImage(msg.watermarkImage);
		const template = msg.spec ? buildCompiledTemplate(msg.spec) : getTemplate(msg.templateId);
		const content: TemplateContent = {...msg.content, photo: msg.photo};
		const imageMap = new Map((msg.images ?? []).map((i) => [i.id, i.bitmap]));
		const media: MediaAccess = {
			image: (id) => imageMap.get(id) ?? null,
			videoFrame: () => null,
		};
		const w = Math.round(720 * msg.scale);
		const h = Math.round(1280 * msg.scale);
		const canvas = new OffscreenCanvas(w, h);
		const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D | null;
		if (!ctx) return post({type: 'unsupported', reason: 'sin contexto 2D'});
		for (let i = 0; i < msg.total; i++) {
			// control de flujo: no más de 12 fotogramas adelantados respecto de lo que el hilo principal escribió
			while (i - acked > 12) await new Promise<void>((r) => (wake = r));
			renderFrame(ctx, template, content, i / msg.fps, {watermark: msg.watermark, scale: msg.scale, media, overlayOnly: msg.overlayOnly});
			const blob = await canvas.convertToBlob(msg.format === 'png' ? {type: 'image/png'} : {type: 'image/jpeg', quality: msg.quality});
			const data = await blob.arrayBuffer();
			post({type: 'frame', index: i, data}, [data]);
		}
	} catch (err) {
		post({type: 'error', message: err instanceof Error ? err.message : String(err)});
	}
};
