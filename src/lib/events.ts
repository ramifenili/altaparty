/** Eventos que acepta el servidor (y que muestra el embudo del admin). Sin imports: lo usan cliente y servidor. */
export const EVENTS = ['page_view', 'template_selected', 'preview_started', 'preview_ready', 'buy_click', 'generator_opened', 'final_started', 'final_ready', 'image_ready', 'video_downloaded', 'image_downloaded'] as const;
export type EventName = (typeof EVENTS)[number];

export const EVENT_LABELS: Record<EventName, string> = {
	page_view: 'Visitas',
	template_selected: 'Eligieron plantilla',
	preview_started: 'Pidieron vista previa',
	preview_ready: 'Vieron la oferta',
	buy_click: 'Tocaron comprar',
	generator_opened: 'Abrieron el generador (pagaron)',
	final_started: 'Empezaron el video final',
	final_ready: 'Generaron el video final',
	image_ready: 'Generaron la imagen final',
	video_downloaded: 'Descargaron el video (tocaron el botón)',
	image_downloaded: 'Descargaron la imagen (tocaron el botón)',
};
