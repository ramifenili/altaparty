// El panel guarda dónde estás (pestaña, video, escena, capa) en la URL: si recargás, volvés al mismo lugar
// y se pueden compartir o guardar enlaces. Solo se usa en el navegador.

export const getParams = () => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);

/** Cambia parámetros de la URL sin recargar. `null` borra el parámetro. 'push' agrega una entrada al historial (botón Atrás). */
export function setParams(patch: Record<string, string | null | undefined>, mode: 'push' | 'replace' = 'replace') {
	if (typeof window === 'undefined') return;
	const p = getParams();
	for (const [k, v] of Object.entries(patch)) {
		if (v === null || v === undefined || v === '') p.delete(k);
		else p.set(k, v);
	}
	const q = p.toString();
	const url = window.location.pathname + (q ? `?${q}` : '');
	if (url === window.location.pathname + window.location.search) return;
	if (mode === 'push') window.history.pushState(null, '', url);
	else window.history.replaceState(null, '', url);
}
