// Funciones puras de animación, sin dependencias externas.
// Equivalentes simplificados a lo que usábamos de Remotion
// (interpolate / spring), pero calculadas a mano.

export function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

export function easeOutCubic(t: number) {
	const c = clamp(t, 0, 1);
	return 1 - Math.pow(1 - c, 3);
}

// Curva tipo "resorte" (overshoot suave), sin librerías de física:
// se acerca a 1 con un pequeño rebote, similar a spring() de Remotion
// con damping alto.
export function easeOutBackSoft(t: number) {
	const c = clamp(t, 0, 1);
	const s = 1.2;
	return 1 + (s + 1) * Math.pow(c - 1, 3) + s * Math.pow(c - 1, 2);
}

export function interpolate(
	value: number,
	inputRange: [number, number],
	outputRange: [number, number]
) {
	const [inMin, inMax] = inputRange;
	const [outMin, outMax] = outputRange;
	const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
	return outMin + t * (outMax - outMin);
}

// progreso 0..1 para una animación de entrada de `duration` frames
// que arranca en el frame `delay`.
export function reveal(frame: number, delay: number, duration = 20) {
	const local = frame - delay;
	if (local <= 0) return 0;
	if (local >= duration) return 1;
	return easeOutBackSoft(local / duration);
}

// Igual que reveal, pero sin rebote (para cosas que no deben "pasarse").
export function revealLinear(frame: number, delay: number, duration = 20) {
	const local = frame - delay;
	if (local <= 0) return 0;
	if (local >= duration) return 1;
	return easeOutCubic(local / duration);
}

// Pseudo-random determinístico (mismo resultado siempre para el mismo i),
// para que las partículas se vean iguales en cada render/preview.
export function seeded(i: number) {
	const x = Math.sin(i * 999) * 10000;
	return x - Math.floor(x);
}
