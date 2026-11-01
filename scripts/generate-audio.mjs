// Sintetiza la biblioteca de sonidos de la app. Toda la música es ORIGINAL
// (generada por código desde cero), por lo que no tiene derechos de terceros y
// puede usarse comercialmente. Uso: node scripts/generate-audio.mjs
import fs from 'node:fs';
import path from 'node:path';

const SR = 22050;
const DUR = 12; // segundos por pista
const OUT = path.join(import.meta.dirname, '..', 'public', 'audio');
fs.mkdirSync(OUT, {recursive: true});

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 1;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

class Track {
	constructor() {
		this.buf = new Float32Array(SR * DUR);
	}
	voice({t, dur, f, wave = 'sine', vol = 0.3, a = 0.005, r = 0.08, decay = 0, lp = 1, detune = 0, pw = 0.5}) {
		const start = Math.floor(t * SR);
		const n = Math.floor((dur + r) * SR);
		let lpState = 0;
		let ph = 0;
		let ph2 = 0;
		for (let i = 0; i < n; i++) {
			const idx = start + i;
			if (idx >= this.buf.length) break;
			const ts = i / SR;
			let env = ts < a ? ts / a : 1;
			if (decay) env *= Math.exp(-ts * decay);
			if (ts > dur) env *= Math.max(0, 1 - (ts - dur) / r);
			ph += f / SR;
			ph2 += (f * (1 + detune)) / SR;
			let s;
			switch (wave) {
				case 'square':
					s = ph % 1 < pw ? 1 : -1;
					break;
				case 'saw':
					s = 2 * (ph % 1) - 1;
					break;
				case 'pad':
					s = (2 * (ph % 1) - 1 + 2 * (ph2 % 1) - 1) * 0.5;
					break;
				case 'tri': {
					const p = ph % 1;
					s = 4 * Math.abs(p - 0.5) - 1;
					break;
				}
				case 'bell':
					s =
						(Math.sin(2 * Math.PI * ph) +
							0.5 * Math.sin(2 * Math.PI * ph * 2.76) +
							0.25 * Math.sin(2 * Math.PI * ph * 5.4)) /
						1.75;
					break;
				case 'box':
					s =
						(Math.sin(2 * Math.PI * ph) +
							0.35 * Math.sin(2 * Math.PI * ph * 3) +
							0.12 * Math.sin(2 * Math.PI * ph * 5)) /
						1.5;
					break;
				default:
					s = Math.sin(2 * Math.PI * ph);
			}
			lpState += (s - lpState) * lp;
			this.buf[idx] += lpState * env * vol;
		}
	}
	kick(t, vol = 0.9) {
		const n = Math.floor(0.22 * SR);
		const s0 = Math.floor(t * SR);
		let ph = 0;
		for (let i = 0; i < n && s0 + i < this.buf.length; i++) {
			const ts = i / SR;
			ph += (45 + 110 * Math.exp(-ts * 28)) / SR;
			this.buf[s0 + i] += Math.sin(2 * Math.PI * ph) * Math.exp(-ts * 14) * vol;
		}
	}
	noise(t, dur, vol, hp = 0.5, tone = 0) {
		const n = Math.floor(dur * SR);
		const s0 = Math.floor(t * SR);
		let prev = 0;
		for (let i = 0; i < n && s0 + i < this.buf.length; i++) {
			const ts = i / SR;
			const x = rnd();
			const hpv = x - prev * hp;
			prev = x;
			const env = Math.exp(-ts * (6 / dur));
			this.buf[s0 + i] +=
				(hpv * (1 - tone) + Math.sin(2 * Math.PI * 190 * ts) * tone) * env * vol;
		}
	}
	snare(t, vol = 0.5) {
		this.noise(t, 0.16, vol, 0.3, 0.25);
	}
	clap(t, vol = 0.5) {
		this.noise(t, 0.05, vol, 0.2);
		this.noise(t + 0.018, 0.05, vol, 0.2);
		this.noise(t + 0.036, 0.12, vol, 0.2);
	}
	hat(t, vol = 0.18) {
		this.noise(t, 0.04, vol, 0.95);
	}
	tom(t, f = 110, vol = 0.7) {
		const n = Math.floor(0.3 * SR);
		const s0 = Math.floor(t * SR);
		let ph = 0;
		for (let i = 0; i < n && s0 + i < this.buf.length; i++) {
			const ts = i / SR;
			ph += (f + 40 * Math.exp(-ts * 20)) / SR;
			this.buf[s0 + i] += Math.sin(2 * Math.PI * ph) * Math.exp(-ts * 9) * vol;
		}
	}
	// recorre un patrón (array de midi, 0 = silencio) repetido hasta llenar la pista
	seq(step, notes, fn) {
		for (let i = 0; i * step < DUR - 0.05; i++) {
			const n = notes[i % notes.length];
			if (n) fn(i * step, n, i);
		}
	}
	save(name) {
		// ONLY=<id> regenera una sola pista sin tocar las demás
		if (process.env.ONLY && process.env.ONLY !== name) return;
		let peak = 0;
		for (const v of this.buf) peak = Math.max(peak, Math.abs(v));
		const g = 0.85 / (peak || 1);
		const fadeIn = Math.floor(0.01 * SR);
		const fadeOut = Math.floor(0.6 * SR);
		const pcm = Buffer.alloc(this.buf.length * 2);
		for (let i = 0; i < this.buf.length; i++) {
			let v = this.buf[i] * g;
			if (i < fadeIn) v *= i / fadeIn;
			if (i > this.buf.length - fadeOut) v *= (this.buf.length - i) / fadeOut;
			pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2);
		}
		const h = Buffer.alloc(44);
		h.write('RIFF', 0);
		h.writeUInt32LE(36 + pcm.length, 4);
		h.write('WAVEfmt ', 8);
		h.writeUInt32LE(16, 16);
		h.writeUInt16LE(1, 20);
		h.writeUInt16LE(1, 22);
		h.writeUInt32LE(SR, 24);
		h.writeUInt32LE(SR * 2, 28);
		h.writeUInt16LE(2, 32);
		h.writeUInt16LE(16, 34);
		h.write('data', 36);
		h.writeUInt32LE(pcm.length, 40);
		fs.writeFileSync(path.join(OUT, name + '.wav'), Buffer.concat([h, pcm]));
		console.log('audio', name);
	}
}

const beat = (bpm) => 60 / bpm;

// 1. Cancha en fiesta: bombo de tribuna + coro de metales
{
	const T = new Track();
	const b = beat(124);
	const e = b / 2;
	for (let i = 0; i < DUR / b; i++) {
		T.kick(i * b);
		if (i % 2) T.clap(i * b, 0.6);
	}
	T.seq(e, [1, 0, 1, 1, 0, 1, 1, 0], (t) => T.hat(t));
	T.seq(e, [45, 0, 45, 0, 52, 0, 45, 47], (t, n) =>
		T.voice({t, dur: e * 0.9, f: hz(n), wave: 'saw', vol: 0.25, lp: 0.12})
	);
	const hook = [69, 69, 72, 0, 69, 72, 74, 0, 76, 76, 74, 72, 74, 72, 69, 0];
	T.seq(e, hook, (t, n) =>
		T.voice({t, dur: e * 0.85, f: hz(n), wave: 'saw', vol: 0.2, lp: 0.3, a: 0.02, detune: 0.004})
	);
	T.save('cancha-en-fiesta');
}
// 2. Estrella pop: synth-pop con arpegios brillantes
{
	const T = new Track();
	const b = beat(122);
	const e = b / 2;
	const s = b / 4;
	for (let i = 0; i < DUR / b; i++) {
		T.kick(i * b, 0.8);
		T.hat(i * b + e, 0.2);
		if (i % 2) T.clap(i * b, 0.5);
	}
	const arp = [72, 76, 79, 84, 79, 76, 72, 76, 71, 74, 79, 83, 79, 74, 71, 74, 69, 72, 76, 81, 76, 72, 69, 72, 67, 71, 74, 79, 74, 71, 67, 71];
	T.seq(s, arp, (t, n) =>
		T.voice({t, dur: s * 0.8, f: hz(n), wave: 'square', pw: 0.3, vol: 0.14, lp: 0.45, decay: 6})
	);
	T.seq(b * 4, [48, 43, 45, 41], (t, n) =>
		T.voice({t, dur: b * 3.8, f: hz(n), wave: 'pad', detune: 0.006, vol: 0.2, lp: 0.08, a: 0.1})
	);
	T.seq(e, [36, 0, 36, 36, 0, 36, 0, 36], (t, n) =>
		T.voice({t, dur: e * 0.7, f: hz(n + 12), wave: 'saw', vol: 0.22, lp: 0.1})
	);
	T.save('estrella-pop');
}
// 3. Aventura heroica: tensión en menor, bajo constante y cuerdas staccato
{
	const T = new Track();
	const b = beat(138);
	const e = b / 2;
	for (let i = 0; i < DUR / b; i++) {
		T.kick(i * b);
		if (i % 2) T.snare(i * b, 0.5);
	}
	T.seq(e, [1, 1, 1, 1], (t) => T.hat(t, 0.15));
	T.seq(e, [40, 40, 40, 43, 40, 40, 38, 40], (t, n) =>
		T.voice({t, dur: e * 0.6, f: hz(n), wave: 'saw', vol: 0.3, lp: 0.15, decay: 5})
	);
	const riff = [64, 0, 67, 0, 71, 0, 67, 0, 64, 0, 62, 0, 64, 67, 71, 72, 71, 0, 67, 0, 62, 0, 64, 0, 60, 0, 62, 0, 64, 0, 0, 0];
	T.seq(e, riff, (t, n) =>
		T.voice({t, dur: e * 0.6, f: hz(n), wave: 'saw', vol: 0.15, lp: 0.35, decay: 4, detune: 0.005})
	);
	T.save('aventura-heroica');
}
// 4. Paso jurásico: tambores tribales y marimba
{
	const T = new Track();
	const b = beat(104);
	const e = b / 2;
	T.seq(e, [95, 0, 0, 80, 0, 90, 0, 0], (t, n) => T.tom(t, n, 0.8));
	T.seq(e, [0, 0, 130, 0, 0, 0, 130, 130], (t, n) => T.tom(t, n, 0.5));
	T.seq(e, [1, 0, 1, 0], (t) => T.hat(t, 0.12));
	const mel = [57, 60, 64, 0, 62, 64, 67, 0, 69, 67, 64, 0, 62, 60, 57, 0];
	T.seq(e, mel, (t, n) => T.voice({t, dur: e, f: hz(n + 12), wave: 'box', vol: 0.3, decay: 7}));
	T.seq(b * 2, [33, 38], (t, n) => T.voice({t, dur: b * 1.6, f: hz(n), wave: 'tri', vol: 0.35, decay: 1.5}));
	T.save('paso-jurasico');
}
// 5. Cielo de caramelo: caja de música pastel
{
	const T = new Track();
	const b = beat(92);
	const e = b / 2;
	const mel = [76, 79, 84, 79, 83, 79, 76, 79, 77, 81, 84, 81, 86, 84, 81, 77, 79, 83, 86, 83, 88, 86, 83, 79, 84, 0, 79, 0, 76, 0, 0, 0];
	T.seq(e, mel, (t, n) => T.voice({t, dur: e, f: hz(n), wave: 'box', vol: 0.3, decay: 5, r: 0.2}));
	T.seq(b * 2, [60, 65, 67, 55], (t, n) =>
		[0, 4, 7, 12].forEach((o, k) =>
			T.voice({t: t + k * 0.03, dur: b * 1.9, f: hz(n + o), wave: 'pad', detune: 0.004, vol: 0.07, lp: 0.06, a: 0.15, r: 0.4})
		)
	);
	T.seq(b * 2, [1], (t) => {
		for (let k = 0; k < 4; k++)
			T.voice({t: t + k * 0.11, dur: 0.1, f: hz(96 + (k % 2) * 7), wave: 'bell', vol: 0.06, decay: 12});
	});
	T.save('cielo-de-caramelo');
}
// 6. Cuenta regresiva: pad espacial y pulsos
{
	const T = new Track();
	const b = beat(90);
	T.seq(b * 4, [45, 41, 43, 40], (t, n) =>
		[0, 7, 12, 15].forEach((o) =>
			T.voice({t, dur: b * 3.9, f: hz(n + o), wave: 'pad', detune: 0.007, vol: 0.1, lp: 0.05, a: 0.8, r: 0.8})
		)
	);
	T.seq(b / 2, [81, 0, 84, 0, 88, 0, 84, 0, 79, 0, 83, 0, 86, 0, 83, 0], (t, n) =>
		T.voice({t, dur: 0.15, f: hz(n), wave: 'sine', vol: 0.16, decay: 6, r: 0.4})
	);
	for (let i = 0; i < DUR / b; i++) if (i % 2 === 0) T.kick(i * b, 0.55);
	T.seq(b / 4, [1], (t) => T.hat(t, 0.06));
	T.save('cuenta-regresiva');
}
// 7. Nivel arcade: chiptune a 8 bits
{
	const T = new Track();
	const b = beat(152);
	const s = b / 4;
	for (let i = 0; i < DUR / b; i++) {
		T.kick(i * b, 0.7);
		if (i % 2) T.snare(i * b, 0.35);
	}
	T.seq(s, [1], (t) => T.hat(t, 0.09));
	const mel = [72, 72, 0, 76, 79, 0, 76, 0, 84, 0, 83, 0, 79, 76, 72, 0, 74, 74, 0, 77, 81, 0, 77, 0, 86, 0, 84, 0, 81, 77, 74, 0];
	T.seq(s * 2, mel, (t, n) =>
		T.voice({t, dur: s * 1.8, f: hz(n), wave: 'square', pw: 0.25, vol: 0.17, lp: 0.9})
	);
	T.seq(s * 2, [36, 36, 48, 36, 36, 48, 43, 36], (t, n) =>
		T.voice({t, dur: s * 1.6, f: hz(n), wave: 'tri', vol: 0.34})
	);
	T.seq(s, [60, 64, 67, 72], (t, n) =>
		T.voice({t, dur: s * 0.8, f: hz(n + 12), wave: 'square', pw: 0.125, vol: 0.05, lp: 0.9})
	);
	T.save('nivel-arcade');
}
// 8. Gala dorada: vals elegante en 3/4
{
	const T = new Track();
	const b = beat(88);
	for (let bar = 0; bar * 3 * b < DUR; bar++) {
		const root = [48, 45, 41, 43][bar % 4];
		const t0 = bar * 3 * b;
		T.voice({t: t0, dur: b * 0.9, f: hz(root - 12), wave: 'tri', vol: 0.35, decay: 2.5});
		for (const o of [0, 4, 7]) {
			T.voice({t: t0 + b, dur: b * 0.6, f: hz(root + 12 + o), wave: 'box', vol: 0.12, decay: 5});
			T.voice({t: t0 + 2 * b, dur: b * 0.6, f: hz(root + 12 + o), wave: 'box', vol: 0.12, decay: 5});
		}
	}
	const mel = [76, 0, 79, 84, 0, 83, 81, 0, 79, 77, 0, 79, 76, 0, 0, 72, 0, 0];
	T.seq(b, mel, (t, n) => T.voice({t, dur: b * 0.95, f: hz(n), wave: 'bell', vol: 0.2, decay: 3, r: 0.3}));
	T.seq(b * 3, [1], (t) => {
		for (let k = 0; k < 5; k++)
			T.voice({t: t + b * 0.1 + k * 0.05, dur: 0.1, f: hz(100 + k * 2), wave: 'bell', vol: 0.03, decay: 14});
	});
	T.save('gala-dorada');
}
// 9. Verano tropical: ritmo caribeño con "steel drum"
{
	const T = new Track();
	const b = beat(108);
	const e = b / 2;
	for (let i = 0; i < DUR / b; i++) {
		T.kick(i * b, 0.55);
		T.hat(i * b + e, 0.2);
	}
	T.seq(e, [0, 0, 1, 0, 0, 1, 0, 1], (t) => T.clap(t, 0.35));
	T.seq(e, [43, 0, 0, 50, 0, 43, 0, 0], (t, n) =>
		T.voice({t, dur: e * 1.2, f: hz(n), wave: 'tri', vol: 0.4, decay: 3})
	);
	const mel = [72, 0, 76, 79, 0, 79, 76, 0, 74, 0, 77, 81, 0, 81, 77, 0];
	T.seq(e, mel, (t, n) => T.voice({t, dur: e, f: hz(n), wave: 'bell', vol: 0.3, decay: 6, r: 0.15}));
	T.save('verano-tropical');
}
// 10. Cumpleaños feliz: melodía tradicional (dominio público) en caja de música
{
	const T = new Track();
	const b = beat(110);
	const tune = [[67, 0.75], [67, 0.25], [69, 1], [67, 1], [72, 1], [71, 2], [67, 0.75], [67, 0.25], [69, 1], [67, 1], [74, 1], [72, 2], [67, 0.75], [67, 0.25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 1], [77, 0.75], [77, 0.25], [76, 1], [72, 1], [74, 1], [72, 2]];
	let t = 0.3;
	for (const [n, d] of tune) {
		if (t < DUR - 0.5)
			T.voice({t, dur: d * b * 0.95, f: hz(n), wave: 'box', vol: 0.35, decay: 3, r: 0.25});
		t += d * b;
	}
	T.save('cumple-feliz');
}
// 11. Camino de gloria: himno de estadio (pisadas y palmas, metales amplios y una melodía que sube)
{
	const T = new Track();
	const b = beat(96);
	const e = b / 2;
	for (let i = 0; i < DUR / b; i++) {
		// "pisa-pisa-palma": bombo en 1 y 2, palmas en 3
		const k = i % 4;
		if (k === 0 || k === 1) T.tom(i * b, 70, 0.8);
		if (k === 3) T.clap(i * b, 0.7);
		if (k === 2) T.tom(i * b + e, 90, 0.4);
	}
	T.seq(e, [1, 1, 1, 1], (t) => T.hat(t, 0.1));
	// acordes anchos de metales: la menor, fa, do, sol
	T.seq(b * 4, [57, 53, 60, 55], (t, n) => {
		for (const k of [0, 7, 12]) T.voice({t, dur: b * 3.7, f: hz(n + k), wave: 'saw', vol: 0.09, lp: 0.12, a: 0.12, detune: 0.004});
	});
	T.seq(b * 2, [45, 41, 48, 43], (t, n) => T.voice({t, dur: b * 1.9, f: hz(n), wave: 'tri', vol: 0.4, decay: 1.2}));
	// melodía triunfal
	const hook = [69, 0, 72, 0, 76, 0, 74, 72, 69, 0, 72, 0, 77, 0, 76, 74, 72, 0, 76, 0, 79, 0, 77, 76, 74, 0, 71, 0, 74, 0, 79, 0];
	T.seq(e, hook, (t, n) => T.voice({t, dur: e * 0.9, f: hz(n), wave: 'saw', vol: 0.15, lp: 0.28, a: 0.02, detune: 0.003}));
	T.save('camino-de-gloria');
}
// 12. Grito de campeón: cántico de tribuna rápido (bombo, palmas y un riff de trompetas en mayor)
{
	const T = new Track();
	const b = beat(128);
	const e = b / 2;
	for (let i = 0; i < DUR / b; i++) {
		T.kick(i * b, 0.9);
		if (i % 2) T.clap(i * b, 0.65);
	}
	// bombo de tribuna: "tum-tum-tum, tum tum"
	T.seq(e, [1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0], (t) => T.tom(t, 80, 0.5));
	T.seq(e, [1, 1, 1, 1], (t) => T.hat(t, 0.12));
	T.seq(e, [48, 0, 48, 0, 55, 0, 48, 50], (t, n) => T.voice({t, dur: e * 0.9, f: hz(n), wave: 'saw', vol: 0.22, lp: 0.12}));
	const riff = [72, 72, 0, 74, 76, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 72, 72, 0, 74, 76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 0, 0];
	T.seq(e, riff, (t, n) => T.voice({t, dur: e * 0.85, f: hz(n), wave: 'square', pw: 0.4, vol: 0.14, lp: 0.4, a: 0.01, detune: 0.004}));
	T.save('grito-campeon');
}
// 13. Telaraña: tema de superhéroe juguetón (golpes de metales, bajo caminante y una melodía que salta)
{
	const T = new Track();
	const b = beat(118);
	const e = b / 2;
	for (let i = 0; i < DUR / b; i++) {
		T.kick(i * b, 0.85);
		if (i % 2) T.snare(i * b, 0.5);
	}
	T.seq(e, [1, 1, 1, 1], (t) => T.hat(t, 0.14));
	// bajo caminante
	T.seq(e, [45, 0, 47, 0, 48, 0, 50, 52, 53, 0, 52, 0, 50, 0, 48, 47], (t, n) => T.voice({t, dur: e * 0.85, f: hz(n), wave: 'tri', vol: 0.4, decay: 3}));
	// golpes de metales
	T.seq(b * 2, [57, 0, 60, 0, 62, 0, 60, 0], (t, n) => {
		for (const k of [0, 4, 7]) T.voice({t, dur: e * 0.9, f: hz(n + k), wave: 'saw', vol: 0.1, lp: 0.2, a: 0.01, decay: 4});
	});
	// melodía que salta
	const hook = [76, 0, 79, 76, 0, 81, 0, 79, 76, 0, 74, 76, 0, 72, 0, 0, 76, 0, 79, 76, 0, 84, 0, 83, 81, 0, 79, 76, 0, 74, 72, 0];
	T.seq(e / 2, hook, (t, n) => T.voice({t, dur: (e / 2) * 0.8, f: hz(n), wave: 'square', pw: 0.35, vol: 0.12, lp: 0.45, a: 0.005}));
	T.save('telarana');
}
// 14. Juguetes: ragtime juguetón (tuba "oom-pah", marimba y una melodía saltarina)
{
	const T = new Track();
	const b = beat(132);
	const e = b / 2;
	for (let i = 0; i < DUR / b; i++) {
		T.kick(i * b, 0.5);
		if (i % 2) T.snare(i * b, 0.35);
	}
	T.seq(e, [1, 1, 1, 1], (t) => T.hat(t, 0.1));
	// "oom-pah": bajo en los tiempos fuertes y acorde en los débiles
	T.seq(b, [43, 0, 48, 0, 43, 0, 50, 0], (t, n) => T.voice({t, dur: b * 0.8, f: hz(n), wave: 'tri', vol: 0.42, decay: 3}));
	T.seq(b, [0, 60, 0, 64, 0, 62, 0, 65], (t, n) => {
		for (const k of [0, 4, 7]) T.voice({t, dur: b * 0.4, f: hz(n + k), wave: 'square', pw: 0.45, vol: 0.06, lp: 0.3, decay: 8});
	});
	// marimba
	const mel = [72, 0, 76, 79, 0, 76, 72, 0, 74, 0, 77, 81, 0, 77, 74, 0, 72, 74, 76, 0, 79, 0, 76, 74, 72, 0, 67, 0, 72, 0, 0, 0];
	T.seq(e, mel, (t, n) => T.voice({t, dur: e * 0.9, f: hz(n), wave: 'bell', vol: 0.3, decay: 7, r: 0.12}));
	T.save('juguetes');
}
// 15. Velocidad: tema de carrera electrónico (bombo a fondo, bajo en corcheas, arpegio brillante, subida y golpe)
{
	const T = new Track();
	const b = beat(150);
	const e = b / 2;
	for (let i = 0; i < DUR / b; i++) {
		T.kick(i * b, 0.85);
		if (i % 2) T.clap(i * b, 0.5);
	}
	T.seq(e / 2, [1, 1, 1, 1], (t, _n, i) => T.hat(t, i % 4 === 2 ? 0.2 : 0.1));
	// bajo en corcheas: mi menor, do, re, si
	T.seq(b * 4, [40, 36, 38, 35], (t, n) => {
		for (let k = 0; k < 8; k++) T.voice({t: t + k * e, dur: e * 0.8, f: hz(n + (k % 4 === 3 ? 12 : 0)), wave: 'saw', vol: 0.2, lp: 0.1, decay: 3});
	});
	// arpegio brillante
	T.seq(e / 2, [64, 71, 76, 71, 60, 67, 72, 67, 62, 69, 74, 69, 59, 66, 71, 66], (t, n) => T.voice({t, dur: e * 0.4, f: hz(n + 12), wave: 'square', pw: 0.3, vol: 0.07, lp: 0.35, decay: 6}));
	// subida de redoble y golpe al final de cada cuatro compases (cada 6.4 s)
	for (let k = 0; k < 2; k++) {
		const hit = (k + 1) * 6.4;
		for (let j = 0; j < 8; j++) T.snare(hit - 1.2 + j * 0.15, 0.2 + j * 0.05);
		if (hit < DUR - 0.2) {
			T.tom(hit, 60, 0.9);
			T.noise(hit, 0.7, 0.5, 0.6);
			for (const n of [40, 47, 52]) T.voice({t: hit, dur: 0.6, f: hz(n), wave: 'saw', vol: 0.16, lp: 0.15, decay: 3});
		}
	}
	T.save('velocidad');
}
