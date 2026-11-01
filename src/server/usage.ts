// Uso de la base de datos y del almacenamiento de archivos. Función pura: recibe lo medido
// hoy y los registros diarios guardados, y arma el informe del panel (por día, por mes y proyección).

export type UsageNow = {
	/** tamaño total de la base (o del archivo db.json en el modo local) */
	dbBytes: number;
	/** archivos de medios del admin (Vercel Blob) */
	blobBytes: number;
	/** fotos de compras guardadas en la base (se borran al vencer) */
	photoBytes: number;
	purchases: number;
	media: number;
	tables: {name: string; bytes: number}[];
};

export type UsageSnapshot = {day: string; dbBytes: number; blobBytes: number; photoBytes: number; purchases: number; media: number};

export type UsageLimits = {dbBytes: number; blobBytes: number};

export type UsageItem = {
	key: 'db' | 'blob';
	label: string;
	used: number;
	limit: number;
	pct: number;
	/** crecimiento medio por día en la ventana, o null si todavía faltan datos */
	bytesPerDay: number | null;
	/** días hasta llenar el límite al ritmo actual; null si no crece o faltan datos */
	daysLeft: number | null;
	status: 'ok' | 'warn' | 'danger';
};

export type UsageReport = {
	items: UsageItem[];
	now: UsageNow;
	daily: {day: string; dbBytes: number; blobBytes: number; dbDelta: number; blobDelta: number}[];
	monthly: {month: string; dbBytes: number; blobBytes: number; dbGrowth: number; blobGrowth: number}[];
};

const DAY_MS = 86400e3;
const WINDOW_DAYS = 30;

const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);

/** Crecimiento medio por día entre el primer y el último registro de la ventana (null si hay menos de 2 días de datos). */
function growthPerDay(points: {day: string; v: number}[]): number | null {
	if (points.length < 2) return null;
	const first = points[0];
	const last = points[points.length - 1];
	const span = dayNumber(last.day) - dayNumber(first.day);
	return span >= 1 ? (last.v - first.v) / span : null;
}

function item(key: UsageItem['key'], label: string, used: number, limit: number, points: {day: string; v: number}[]): UsageItem {
	const bytesPerDay = growthPerDay(points);
	const daysLeft = bytesPerDay && bytesPerDay > 0 ? Math.max(0, Math.floor((limit - used) / bytesPerDay)) : null;
	const pct = limit > 0 ? (used / limit) * 100 : 0;
	const status = pct >= 90 || (daysLeft !== null && daysLeft <= 14) ? 'danger' : pct >= 70 || (daysLeft !== null && daysLeft <= 45) ? 'warn' : 'ok';
	return {key, label, used, limit, pct, bytesPerDay, daysLeft, status};
}

/** `today` es el día (AAAA-MM-DD) al que corresponde `now`; reemplaza al registro de ese día si ya existía. */
export function buildUsage(now: UsageNow, today: string, history: UsageSnapshot[], limits: UsageLimits): UsageReport {
	const snaps = [...history.filter((s) => s.day !== today), {day: today, dbBytes: now.dbBytes, blobBytes: now.blobBytes, photoBytes: now.photoBytes, purchases: now.purchases, media: now.media}].sort((a, b) =>
		a.day.localeCompare(b.day)
	);
	const recent = snaps.filter((s) => dayNumber(s.day) >= dayNumber(today) - WINDOW_DAYS);

	const daily = snaps.slice(-WINDOW_DAYS).map((s) => {
		const prev = snaps[snaps.indexOf(s) - 1];
		return {day: s.day, dbBytes: s.dbBytes, blobBytes: s.blobBytes, dbDelta: prev ? s.dbBytes - prev.dbBytes : 0, blobDelta: prev ? s.blobBytes - prev.blobBytes : 0};
	});

	const byMonth = new Map<string, UsageSnapshot>();
	for (const s of snaps) byMonth.set(s.day.slice(0, 7), s); // el último registro de cada mes
	const months = [...byMonth.entries()];
	const monthly = months.map(([month, last], i) => {
		const first = snaps.find((s) => s.day.startsWith(month))!;
		// crecimiento contra el cierre del mes anterior; si no hay, contra el primer registro del mes
		const base = i > 0 ? months[i - 1][1] : first;
		return {month, dbBytes: last.dbBytes, blobBytes: last.blobBytes, dbGrowth: last.dbBytes - base.dbBytes, blobGrowth: last.blobBytes - base.blobBytes};
	});

	return {
		items: [
			item('db', 'Base de datos', now.dbBytes, limits.dbBytes, recent.map((s) => ({day: s.day, v: s.dbBytes}))),
			item('blob', 'Archivos (Blob)', now.blobBytes, limits.blobBytes, recent.map((s) => ({day: s.day, v: s.blobBytes}))),
		],
		now,
		daily: daily.reverse(),
		monthly: monthly.reverse().slice(0, 12),
	};
}

const MB = 1024 * 1024;

/** Topes de los planes (ajustables con DB_LIMIT_MB y BLOB_LIMIT_MB; por defecto 512 MB y 1 GB). */
export function usageLimits(env: {DB_LIMIT_MB?: string; BLOB_LIMIT_MB?: string}): UsageLimits {
	const mb = (v: string | undefined, def: number) => (Number(v) > 0 ? Number(v) : def);
	return {dbBytes: mb(env.DB_LIMIT_MB, 512) * MB, blobBytes: mb(env.BLOB_LIMIT_MB, 1024) * MB};
}
