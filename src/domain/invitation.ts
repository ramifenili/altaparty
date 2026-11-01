import type {TemplateContent, PhotoSource} from '../templates/types';

/** Datos que carga el usuario una sola vez (texto; la foto se maneja aparte). */
export type InvitationData = {
	name: string;
	age: string;
	/** YYYY-MM-DD */
	date: string;
	/** HH:mm */
	time: string;
	/** HH:mm; opcional: si está, el horario se muestra "16:00 hs a 20:00 hs" */
	timeEnd: string;
	venue: string;
	address: string;
};

export type FieldName = keyof InvitationData;
export type InvitationErrors = Partial<Record<FieldName, string>>;

export const EMPTY_INVITATION: InvitationData = {
	name: '',
	age: '',
	date: '',
	time: '',
	timeEnd: '',
	venue: '',
	address: '',
};

export const LIMITS = {name: 28, venue: 60, address: 90} as const;

const MONTHS = [
	'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
	'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function parseIsoDate(iso: string) {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
	if (!m) return null;
	const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const date = new Date(y, mo - 1, d);
	if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
	return date;
}

export function todayIso(now = new Date()) {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function validateInvitation(data: InvitationData, now = new Date()): InvitationErrors {
	const e: InvitationErrors = {};
	const name = data.name.trim();
	if (!name) e.name = 'Ingresá el nombre del cumpleañero o cumpleañera.';
	else if (name.length > LIMITS.name) e.name = `Usá hasta ${LIMITS.name} caracteres.`;

	if (!data.age.trim()) e.age = 'Ingresá la edad que cumple.';
	else {
		const n = Number(data.age);
		if (!/^\d+$/.test(data.age.trim()) || n < 1 || n > 120) e.age = 'La edad debe ser un número entre 1 y 120.';
	}

	if (!data.date) e.date = 'Elegí la fecha del evento.';
	else {
		const d = parseIsoDate(data.date);
		if (!d) e.date = 'La fecha no es válida.';
		else if (data.date < todayIso(now)) e.date = 'La fecha no puede ser anterior a hoy.';
	}

	if (!data.time) e.time = 'Indicá el horario de la fiesta.';
	else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time)) e.time = 'El horario no es válido.';
	if (data.timeEnd && !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.timeEnd)) e.timeEnd = 'El horario de fin no es válido.';

	const venue = data.venue.trim();
	if (!venue) e.venue = 'Ingresá el nombre del salón o lugar.';
	else if (venue.length > LIMITS.venue) e.venue = `Usá hasta ${LIMITS.venue} caracteres.`;

	const address = data.address.trim();
	if (!address) e.address = 'Ingresá la dirección del salón o lugar.';
	else if (address.length > LIMITS.address) e.address = `Usá hasta ${LIMITS.address} caracteres.`;
	return e;
}

export function isComplete(data: InvitationData) {
	return Object.keys(validateInvitation(data, new Date(0))).filter((k) => k !== 'date').length === 0 && !!data.date;
}

export function formatLongDate(iso: string) {
	const d = parseIsoDate(iso);
	if (!d) return '';
	return `${WEEKDAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

export function formatTime(hhmm: string) {
	return /^\d{2}:\d{2}$/.test(hhmm) ? `${hhmm} hs` : hhmm;
}

/** Convierte los datos del formulario en lo que consumen las plantillas. */
export function toTemplateContent(data: InvitationData, photo: PhotoSource | null): TemplateContent {
	const d = parseIsoDate(data.date) ?? new Date();
	return {
		name: data.name.trim(),
		age: Number(data.age) || 0,
		day: d.getDate(),
		monthName: MONTHS[d.getMonth()],
		weekday: WEEKDAYS[d.getDay()],
		year: d.getFullYear(),
		time: formatTime(data.time) + (/^\d{2}:\d{2}$/.test(data.timeEnd ?? '') ? ` a ${formatTime(data.timeEnd)}` : ''),
		venue: data.venue.trim(),
		address: data.address.trim(),
		photo,
	};
}

/** Datos para las miniaturas: lo que ya cargó el usuario, completado con datos de muestra. */
export function galleryData(data: InvitationData): InvitationData {
	const pick = (k: FieldName) => (data[k].trim() ? data[k] : SAMPLE_INVITATION[k]);
	return {
		name: pick('name'),
		age: /^\d{1,3}$/.test(data.age.trim()) && Number(data.age) > 0 ? data.age.trim() : SAMPLE_INVITATION.age,
		date: parseIsoDate(data.date) ? data.date : SAMPLE_INVITATION.date,
		time: /^\d{2}:\d{2}$/.test(data.time) ? data.time : SAMPLE_INVITATION.time,
		timeEnd: /^\d{2}:\d{2}$/.test(data.time) && /^\d{2}:\d{2}$/.test(data.timeEnd ?? '') ? data.timeEnd : '',
		venue: pick('venue'),
		address: pick('address'),
	};
}

/** Datos de muestra para la galería antes de que el usuario complete el formulario. */
export const SAMPLE_INVITATION: InvitationData = {
	name: 'Mateo',
	age: '7',
	date: '2026-12-12',
	time: '16:00',
	timeEnd: '',
	venue: 'Salón Los Pibes',
	address: 'Av. Corrientes 1234, CABA',
};

export const PHOTO_LIMITS = {maxBytes: 8 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp']} as const;
export const AUDIO_LIMITS = {
	maxBytes: 5 * 1024 * 1024,
	types: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg'],
	extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg'],
} as const;
