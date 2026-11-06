/** Plantillas incluidas (código) o videos compilados `c-...` creados desde el admin. */
export type TemplateId = string;

export type Audience = 'infantil' | 'juvenil' | 'elegante';

/** Foto lista para dibujar en canvas. */
export type PhotoSource = CanvasImageSource & {width: number; height: number};

/** Datos de la invitación ya formateados para dibujar. */
export type TemplateContent = {
	name: string;
	age: number;
	day: number;
	monthName: string;
	weekday: string;
	year: number;
	/** "16:00 hs" */
	time: string;
	venue: string;
	address: string;
	photo: PhotoSource | null;
};

/** Acceso a imágenes y videos de fondo de los videos compilados. */
export interface MediaAccess {
	image(mediaId: string): (CanvasImageSource & {width: number; height: number}) | null;
	/** fotograma del video de fondo de la escena (en vista previa), o null si no está disponible */
	videoFrame(sceneIndex: number, localTime: number): (CanvasImageSource & {width: number; height: number}) | null;
}

export type FrameContext = {
	/** segundos desde el inicio del video */
	t: number;
	content: TemplateContent;
	/** solo videos compilados */
	media?: MediaAccess;
	/**
	 * Exportación de un video compilado con fondos de VIDEO: se dibujan solo las capas (con
	 * transparencia) y FFmpeg las superpone sobre los videos.
	 */
	overlayOnly?: boolean;
};

/**
 * Estilo de las imágenes 1200×1200 de Mercado Libre (render/mercadolibre.ts): fondo, letras, colores y personajes propios de la
 * plantilla, tomados de la imagen del video. Sin él se usa un diseño genérico con la paleta de la plantilla.
 */
export type MlStyle = {
	/** fondo en el lienzo de 720×1280 de la plantilla; la imagen toma una franja de 720×720 que empieza en `window` */
	background: (ctx: CanvasRenderingContext2D) => void;
	window: {datos: number; pasos: number};
	/** imagen de compartir el link: franja del fondo a usar (si la de `datos` incluye el piso) y si se centra el grupo de personajes en lugar del principal */
	share?: {window?: number; centerGroup?: boolean};
	/** personajes (de `assets`) de la primera imagen, de izquierda a derecha */
	characters: string[];
	/** elementos sueltos (sin personajes) para decorar las imágenes */
	decor?: string[];
	/** alto de cada personaje respecto del base (p. ej. el protagonista más grande); por defecto todos iguales */
	charScale?: number[];
	/** personajes que se dibujan espejados (miran hacia el otro lado) */
	charFlip?: boolean[];
	/** alto base de los personajes, x donde empieza su zona y separación entre ellos (negativa = se tapan un poco) */
	charHeight?: number;
	charX?: number;
	charGap?: number;
	/** el primer elemento de `decor` se reparte varias veces por los bordes, en lugar de ir en un solo lugar */
	scatter?: boolean;
	/** tipografía de los títulos (la que usan `title`, `heading` y `label`) */
	font: (size: number) => string;
	/** título centrado en 1 o 2 líneas; devuelve el y donde termina */
	title: (ctx: CanvasRenderingContext2D, lines: string[], cx: number, y: number, maxW: number) => number;
	/** subtítulo (los pasos), alineado a la izquierda o centrado */
	heading: (ctx: CanvasRenderingContext2D, str: string, x: number, baseline: number, size: number, align: CanvasTextAlign) => void;
	/** texto corto, alineado a la izquierda (las líneas del formulario) o centrado */
	label: (ctx: CanvasRenderingContext2D, str: string, x: number, baseline: number, size: number, align: CanvasTextAlign) => void;
	/** color de las insignias numeradas y de los detalles, y color del número encima */
	accent: string;
	ink: string;
	/** panel detrás del texto del paso a paso (null = sin panel) */
	panelPasos: {fill: string; border: string} | null;
	/** el cierre del paso a paso va en una pastilla blanca con letras del color `ink` */
	footerPill?: boolean;
};

export type TemplateDefinition = {
	id: TemplateId;
	name: string;
	description: string;
	category: string;
	/** etiquetas ocultas (solo sirven para buscar); las edita el admin */
	tags?: string[];
	audience: Audience;
	palette: string[];
	/** familias tipográficas (de public/fonts) que usa la plantilla */
	fonts: string[];
	/** duración del video exportado, en segundos */
	duration: number;
	/** segundos en que la música termina de bajar y se corta (por defecto, el final del video) */
	audioEnd?: number;
	fps: number;
	defaultAudioId: string;
	/** cómo se adapta el diseño a la foto opcional */
	photoRule: string;
	/** instante (s) que mejor representa la plantilla en miniaturas */
	thumbnailTime: number;
	/** instante (s) del que sale la imagen 1080×1920 de la invitación; sin él, `thumbnailTime` */
	imageTime?: number;
	/**
	 * Diseño propio de la imagen 1080×1920 (se dibuja en el mismo lienzo de 720×1280): personajes, nombre y edad grandes y
	 * los datos de la fiesta, todos a la vista a la vez. Sin él se usa el diseño genérico de templates/poster.ts.
	 */
	poster?: (ctx: CanvasRenderingContext2D, content: TemplateContent) => void;
	/** estilo de las imágenes para Mercado Libre */
	ml?: MlStyle;
	/** imágenes (de `assets`) que el diseño genérico de la imagen pone en una fila: los personajes de la plantilla */
	posterArt?: string[];
	/** imágenes de la plantilla (nombres sin extensión) que viven en public/templates/<id>/; ver templates/assets.ts */
	assets?: string[];
	draw: (ctx: CanvasRenderingContext2D, frame: FrameContext) => void;
	/** videos compilados: la definición (para exportar y para saber qué medios necesita) */
	spec?: import('./compiled-types').CompiledSpec;
};
