// Videos "compilados": plantillas definidas por datos (JSON) que arma el admin
// con escenas. Cada escena tiene un fondo (color, degradé, imagen o VIDEO) y
// capas animadas: textos con los datos del cumpleañero, la foto y imágenes
// (personajes) reemplazables. Se comparten entre servidor, admin y navegador.

export const FONT_KEYS = ['Anton', 'Bangers', 'Fredoka', 'PressStart', 'Playfair', 'Montserrat', 'Pacifico', 'CABJ1905'] as const;
export type FontKey = (typeof FONT_KEYS)[number];

/** Tipografía subida por el admin: `cf-<id del archivo>`. */
export const isCustomFont = (f: string) => /^cf-[a-z0-9]{8,32}$/.test(f);
export const customFontMediaId = (f: string) => f.slice(3);
export const isValidFont = (f: unknown): f is string => typeof f === 'string' && ((FONT_KEYS as readonly string[]).includes(f) || isCustomFont(f));

export const ENTER_ANIMS = ['none', 'fade', 'pop', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'typewriter'] as const;
export type EnterAnim = (typeof ENTER_ANIMS)[number];

export const LOOP_ANIMS = ['none', 'float', 'sway', 'bounce', 'pulse'] as const;
export type LoopAnim = (typeof LOOP_ANIMS)[number];

/** Salidas: `undefined` conserva el comportamiento histórico (fundido en el último cuarto de segundo). */
export const EXIT_ANIMS = ['none', 'fade', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'shrink'] as const;
export type ExitAnim = (typeof EXIT_ANIMS)[number];

/** Curvas de interpolación para entradas y salidas (funciones del tiempo absoluto, sin estado). */
export const EASES = ['outCubic', 'outQuad', 'outExpo', 'inOutCubic', 'outBack', 'linear'] as const;
export type Ease = (typeof EASES)[number];

/** Transición hacia una escena (se aplica durante los primeros `duration` segundos de esa escena). */
export const TRANSITIONS = ['cut', 'fade', 'dip', 'slideLeft', 'slideRight', 'slideUp', 'slideDown', 'zoomIn', 'wipeLeft', 'wipeRight'] as const;
export type TransitionKind = (typeof TRANSITIONS)[number];
export type SceneTransition = {kind: TransitionKind; /** segundos */ duration: number; /** color de `dip` */ color?: string};

export const PHOTO_SHAPES = ['circle', 'rounded', 'oval', 'hex', 'star', 'heart'] as const;
export type SpecPhotoShape = (typeof PHOTO_SHAPES)[number];

type LayerBase = {
	id: string;
	/** segundos dentro de la escena en que aparece (0 = al empezar) */
	start: number;
	/** segundos en que desaparece (0 = hasta el final de la escena) */
	end: number;
	enter: EnterAnim;
	loop: LoopAnim;
	/** centro de la capa, en % del cuadro (0–100) */
	x: number;
	y: number;
	/** ancho en % del ancho del cuadro */
	w: number;
	/** grados */
	rotate: number;
	// ---- opcionales (plantillas anteriores no los tienen y se dibujan igual que siempre) ----
	/** duración de la entrada en segundos (por defecto 0,55) */
	enterDur?: number;
	/** salida; sin definir = fundido corto histórico */
	exit?: ExitAnim;
	/** duración de la salida en segundos (por defecto 0,25) */
	exitDur?: number;
	/** curva de la entrada y de la salida */
	ease?: Ease;
	/** opacidad general de la capa, 0–100 (por defecto 100) */
	alpha?: number;
	/** escala general de la capa en % (por defecto 100) */
	scale?: number;
};

export type TextLayer = LayerBase & {
	type: 'text';
	/** admite {nombre} {edad} {fecha} {fecha_larga} {dia} {mes} {dia_semana} {hora} {lugar} {direccion} */
	text: string;
	/** alto de letra en % del ancho del cuadro */
	size: number;
	/** una de FONT_KEYS o `cf-<id>` (tipografía subida) */
	font: string;
	color: string;
	stroke: string;
	/** grosor del borde en % del tamaño de letra */
	strokeW: number;
	align: 'left' | 'center' | 'right';
	uppercase: boolean;
	shadow: boolean;
	maxLines: number;
};

export type PhotoLayer = LayerBase & {
	type: 'photo';
	shape: SpecPhotoShape;
	border: string;
	borderW: number;
	/** si no hay foto: 'hide' no dibuja nada, 'initial' muestra la inicial del nombre */
	ifMissing: 'hide' | 'initial';
};

export type ImageLayer = LayerBase & {
	type: 'image';
	mediaId: string;
	flip: boolean;
	/** opcional: alto de la caja en % del alto del cuadro. Sin definir, la imagen conserva su proporción a partir del ancho. */
	h?: number;
	/** con `h`: 'contain' entra completa en la caja; 'cover' llena la caja recortando los bordes */
	fit?: 'contain' | 'cover';
};

/** Rectángulo o círculo de color: marcos, líneas, fondos de texto, destellos de transición. */
export type ShapeLayer = LayerBase & {
	type: 'shape';
	shape: 'rect' | 'circle';
	fill: string;
	/** 0–100 */
	opacity: number;
	/** alto en % del alto del cuadro */
	h: number;
	/** esquinas redondeadas, en % del lado menor */
	radius: number;
};

export type Layer = TextLayer | PhotoLayer | ImageLayer | ShapeLayer;

export type SceneBg =
	| {kind: 'color'; color: string}
	| {kind: 'gradient'; from: string; to: string; angle: number}
	| {kind: 'image'; mediaId: string}
	| {kind: 'video'; mediaId: string};

export type Scene = {
	id: string;
	/** segundos */
	duration: number;
	bg: SceneBg;
	layers: Layer[];
	/** transición de entrada desde la escena anterior (sin definir = corte directo) */
	transition?: SceneTransition;
};

export type CompiledSpec = {
	id: string;
	name: string;
	description: string;
	category: string;
	audience: 'infantil' | 'juvenil' | 'elegante';
	defaultAudioId: string;
	enabled: boolean;
	scenes: Scene[];
	/** escena (índice) que se usa de miniatura */
	thumbScene: number;
	/** ids de medios (imagen) usados como miniatura */
	thumbMediaId?: string;
	createdAt: number;
	updatedAt: number;
};

export const SPEC_LIMITS = {maxScenes: 14, maxLayersPerScene: 14, maxSeconds: 60, minSceneSeconds: 1, fps: 24};

export const COMPILED_PREFIX = 'c-';
export const isCompiledId = (id: string) => id.startsWith(COMPILED_PREFIX);

const HEX = /^#[0-9a-f]{3,8}$/i;
const MEDIA_ID = /^[a-z0-9]{8,32}$/;
const num = (v: unknown, min: number, max: number, d: number) => {
	const n = typeof v === 'number' && Number.isFinite(v) ? v : d;
	return Math.min(max, Math.max(min, n));
};
const str = (v: unknown, max: number, d = '') => (typeof v === 'string' ? v.slice(0, max) : d);
const color = (v: unknown, d: string) => (typeof v === 'string' && (HEX.test(v) || v === '') ? v : d);
const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => ((list as readonly string[]).includes(v as string) ? (v as T) : d);
const rid = (v: unknown) => (typeof v === 'string' && /^[a-z0-9-]{3,40}$/i.test(v) ? v : Math.random().toString(36).slice(2, 10));

/** Campos opcionales de animación: solo se incluyen si vienen en el JSON (las plantillas viejas quedan idénticas). */
function normExtras(r: Record<string, unknown>) {
	const o: {enterDur?: number; exit?: ExitAnim; exitDur?: number; ease?: Ease; alpha?: number; scale?: number} = {};
	if (r.enterDur !== undefined) o.enterDur = num(r.enterDur, 0.05, 5, 0.55);
	if (r.exit !== undefined) o.exit = pick(r.exit, EXIT_ANIMS, 'fade');
	if (r.exitDur !== undefined) o.exitDur = num(r.exitDur, 0.05, 5, 0.25);
	if (r.ease !== undefined) o.ease = pick(r.ease, EASES, 'outCubic');
	if (r.alpha !== undefined) o.alpha = num(r.alpha, 0, 100, 100);
	if (r.scale !== undefined) o.scale = num(r.scale, 5, 400, 100);
	return o;
}

function normTransition(raw: unknown): SceneTransition | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const r = raw as Record<string, unknown>;
	const kind = pick(r.kind, TRANSITIONS, 'cut');
	if (kind === 'cut') return undefined;
	return {kind, duration: num(r.duration, 0.1, 3, 0.5), ...(kind === 'dip' ? {color: color(r.color, '#000000') || '#000000'} : {})};
}

function normLayer(raw: unknown): Layer | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const base = {
		id: rid(r.id),
		start: num(r.start, 0, 60, 0),
		end: num(r.end, 0, 60, 0),
		enter: pick(r.enter, ENTER_ANIMS, 'fade'),
		loop: pick(r.loop, LOOP_ANIMS, 'none'),
		x: num(r.x, -50, 150, 50),
		y: num(r.y, -50, 150, 50),
		w: num(r.w, 1, 200, 50),
		rotate: num(r.rotate, -180, 180, 0),
		...normExtras(r),
	};
	if (r.type === 'text') {
		return {
			...base,
			type: 'text',
			text: str(r.text, 200, '{nombre}'),
			size: num(r.size, 1, 40, 8),
			font: isValidFont(r.font) ? r.font : 'Anton',
			color: color(r.color, '#ffffff'),
			stroke: color(r.stroke, ''),
			strokeW: num(r.strokeW, 0, 50, 12),
			align: pick(r.align, ['left', 'center', 'right'] as const, 'center'),
			uppercase: r.uppercase === true,
			shadow: r.shadow !== false,
			maxLines: Math.round(num(r.maxLines, 1, 6, 2)),
		};
	}
	if (r.type === 'photo') {
		return {
			...base,
			type: 'photo',
			shape: pick(r.shape, PHOTO_SHAPES, 'circle'),
			border: color(r.border, '#ffffff'),
			borderW: num(r.borderW, 0, 20, 4),
			ifMissing: pick(r.ifMissing, ['hide', 'initial'] as const, 'hide'),
		};
	}
	if (r.type === 'shape') {
		return {
			...base,
			type: 'shape',
			shape: pick(r.shape, ['rect', 'circle'] as const, 'rect'),
			fill: color(r.fill, '#ffffff') || '#ffffff',
			opacity: num(r.opacity, 0, 100, 100),
			h: num(r.h, 0.1, 200, 10),
			radius: num(r.radius, 0, 50, 0),
		};
	}
	if (r.type === 'image' && typeof r.mediaId === 'string' && MEDIA_ID.test(r.mediaId)) {
		return {
			...base,
			type: 'image',
			mediaId: r.mediaId,
			flip: r.flip === true,
			...(r.h !== undefined ? {h: num(r.h, 0.5, 200, 20), fit: pick(r.fit, ['contain', 'cover'] as const, 'contain')} : {}),
		};
	}
	return null;
}

function normBg(raw: unknown): SceneBg {
	const r = (raw ?? {}) as Record<string, unknown>;
	if (r.kind === 'gradient') {
		return {kind: 'gradient', from: color(r.from, '#1b0b4d'), to: color(r.to, '#c2307a'), angle: num(r.angle, 0, 360, 180)};
	}
	if ((r.kind === 'image' || r.kind === 'video') && typeof r.mediaId === 'string' && MEDIA_ID.test(r.mediaId)) {
		return {kind: r.kind, mediaId: r.mediaId};
	}
	return {kind: 'color', color: color(r.color, '#101030')};
}

/** Valida y limpia una especificación venida del admin (nunca se confía en el JSON crudo). */
export function normalizeSpec(raw: unknown, prev?: CompiledSpec): CompiledSpec | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const scenesRaw = Array.isArray(r.scenes) ? r.scenes.slice(0, SPEC_LIMITS.maxScenes) : [];
	const scenes: Scene[] = scenesRaw.map((s) => {
		const sr = (s ?? {}) as Record<string, unknown>;
		const layers = (Array.isArray(sr.layers) ? sr.layers : [])
			.slice(0, SPEC_LIMITS.maxLayersPerScene)
			.map(normLayer)
			.filter((l): l is Layer => l !== null);
		return {
			id: rid(sr.id),
			duration: num(sr.duration, SPEC_LIMITS.minSceneSeconds, 30, 3),
			bg: normBg(sr.bg),
			layers,
			...(normTransition(sr.transition) ? {transition: normTransition(sr.transition)} : {}),
		};
	});
	if (!scenes.length) return null;
	// duración total acotada
	let total = scenes.reduce((a, s) => a + s.duration, 0);
	if (total > SPEC_LIMITS.maxSeconds) {
		const k = SPEC_LIMITS.maxSeconds / total;
		scenes.forEach((s) => (s.duration = Math.max(SPEC_LIMITS.minSceneSeconds, Math.floor(s.duration * k * 10) / 10)));
		total = scenes.reduce((a, s) => a + s.duration, 0);
	}
	const name = str(r.name, 40).trim();
	if (!name) return null;
	const now = Date.now();
	const idRaw = typeof r.id === 'string' && /^c-[a-z0-9-]{2,36}$/.test(r.id) ? r.id : prev?.id;
	return {
		id: idRaw ?? `${COMPILED_PREFIX}${Math.random().toString(36).slice(2, 10)}`,
		name,
		description: str(r.description, 140),
		category: str(r.category, 24, 'Especial') || 'Especial',
		audience: pick(r.audience, ['infantil', 'juvenil', 'elegante'] as const, 'juvenil'),
		defaultAudioId: str(r.defaultAudioId, 40, 'cumple-feliz'),
		enabled: r.enabled === true,
		scenes,
		thumbScene: Math.min(scenes.length - 1, Math.round(num(r.thumbScene, 0, 99, 0))),
		thumbMediaId: typeof r.thumbMediaId === 'string' && MEDIA_ID.test(r.thumbMediaId) ? r.thumbMediaId : undefined,
		createdAt: prev?.createdAt ?? now,
		updatedAt: now,
	};
}

export const specDuration = (s: CompiledSpec) => s.scenes.reduce((a, sc) => a + sc.duration, 0);

/** Medios (ids) que usa una especificación. */
export function specMediaIds(s: CompiledSpec): {videos: string[]; images: string[]; fonts: string[]} {
	const videos = new Set<string>();
	const images = new Set<string>();
	const fonts = new Set<string>();
	for (const sc of s.scenes) {
		if (sc.bg.kind === 'video') videos.add(sc.bg.mediaId);
		if (sc.bg.kind === 'image') images.add(sc.bg.mediaId);
		for (const l of sc.layers) {
			if (l.type === 'image') images.add(l.mediaId);
			if (l.type === 'text' && isCustomFont(l.font)) fonts.add(customFontMediaId(l.font));
		}
	}
	return {videos: [...videos], images: [...images], fonts: [...fonts]};
}
