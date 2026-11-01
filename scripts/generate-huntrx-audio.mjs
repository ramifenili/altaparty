// Sintetiza "Cazadoras K-pop" (public/audio/cazadoras.wav), la música de la plantilla HUNTR/X. Es ORIGINAL (generada por
// código), sin derechos de terceros. 30 s a 120 BPM: cada corte de escena de la plantilla (4, 9, 14, 19 y 23 s) cae en
// un tiempo fuerte y lleva su whoosh de subida + impacto. Uso: node scripts/generate-huntrx-audio.mjs
import fs from 'node:fs';
import path from 'node:path';

const SR = 22050;
const DUR = 30;
const OUT = path.join(import.meta.dirname, '..', 'public', 'audio');
fs.mkdirSync(OUT, {recursive: true});

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const buf = new Float32Array(SR * DUR);

function voice({t, dur, f, wave = 'sine', vol = 0.3, a = 0.005, r = 0.08, decay = 0, lp = 1, detune = 0, pw = 0.5}) {
	const start = Math.floor(t * SR);
	const n = Math.floor((dur + r) * SR);
	let lpState = 0;
	let ph = 0;
	let ph2 = 0;
	for (let i = 0; i < n; i++) {
		const idx = start + i;
		if (idx >= buf.length) break;
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
			case 'bell':
				s = (Math.sin(2 * Math.PI * ph) + 0.5 * Math.sin(2 * Math.PI * ph * 2.76) + 0.25 * Math.sin(2 * Math.PI * ph * 5.4)) / 1.75;
				break;
			default:
				s = Math.sin(2 * Math.PI * ph);
		}
		lpState += (s - lpState) * lp;
		buf[idx] += lpState * env * vol;
	}
}
function kick(t, vol = 0.9) {
	const s0 = Math.floor(t * SR);
	let ph = 0;
	for (let i = 0; i < 0.22 * SR && s0 + i < buf.length; i++) {
		const ts = i / SR;
		ph += (45 + 110 * Math.exp(-ts * 28)) / SR;
		buf[s0 + i] += Math.sin(2 * Math.PI * ph) * Math.exp(-ts * 14) * vol;
	}
}
function noise(t, dur, vol, hp = 0.5) {
	const s0 = Math.floor(t * SR);
	let prev = 0;
	for (let i = 0; i < dur * SR && s0 + i < buf.length; i++) {
		const x = rnd();
		const y = x - prev * hp;
		prev = x;
		buf[s0 + i] += y * Math.exp(-(i / SR) * (6 / dur)) * vol;
	}
}
const clap = (t, vol = 0.5) => {
	noise(t, 0.05, vol, 0.2);
	noise(t + 0.018, 0.05, vol, 0.2);
	noise(t + 0.036, 0.12, vol, 0.2);
};
const hat = (t, vol = 0.14) => noise(t, 0.04, vol, 0.95);
/** Subida: ruido que crece (y sube de brillo) hasta `t1`. */
function whoosh(t0, t1, vol = 0.35) {
	const s0 = Math.floor(t0 * SR);
	const n = Math.floor((t1 - t0) * SR);
	let prev = 0;
	let lp = 0;
	for (let i = 0; i < n && s0 + i < buf.length; i++) {
		const k = i / n;
		const x = rnd();
		lp += (x - lp) * (0.04 + 0.7 * k * k);
		const y = lp - prev * 0.2;
		prev = lp;
		buf[s0 + i] += y * k * k * vol * 2.2;
	}
}
function impact(t, vol = 0.8) {
	const s0 = Math.floor(t * SR);
	let ph = 0;
	for (let i = 0; i < 0.5 * SR && s0 + i < buf.length; i++) {
		const ts = i / SR;
		ph += (38 + 90 * Math.exp(-ts * 18)) / SR;
		buf[s0 + i] += Math.sin(2 * Math.PI * ph) * Math.exp(-ts * 6) * vol;
	}
	noise(t, 0.6, vol * 0.6, 0.6);
}

const b = 0.5; // 120 BPM
const bar = b * 4;
// Am - F - C - G (cuatro compases de 2 s; se repite)
const CHORDS = [
	{root: 45, tones: [57, 60, 64, 69]},
	{root: 41, tones: [53, 57, 60, 65]},
	{root: 48, tones: [55, 60, 64, 67]},
	{root: 43, tones: [55, 59, 62, 67]},
];
const CUTS = [4, 9, 14, 19, 23];
const SUB_CUTS = [5.7, 7.4];

for (let bi = 0; bi < DUR / bar; bi++) {
	const t0 = bi * bar;
	const ch = CHORDS[bi % 4];
	// pad de fondo
	for (const n of ch.tones.slice(0, 3))
		voice({t: t0, dur: bar * 0.98, f: hz(n), wave: 'pad', detune: 0.006, vol: 0.07, lp: 0.07, a: 0.12});
	// bajo en corcheas
	for (let k = 0; k < 8; k++) {
		if (t0 + k * b / 2 < 1) continue;
		voice({t: t0 + (k * b) / 2, dur: (b / 2) * 0.8, f: hz(ch.root + (k % 4 === 3 ? 12 : 0)), wave: 'saw', vol: 0.19, lp: 0.1, decay: 3});
	}
	// arpegio brillante en semicorcheas (entra desde el segundo 1)
	const arp = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 2, 1];
	for (let k = 0; k < 16; k++) {
		const t = t0 + k * (b / 4);
		if (t < 1) continue;
		voice({t, dur: b / 4 * 0.8, f: hz(ch.tones[arp[k] % 4] + 12), wave: 'square', pw: 0.3, vol: 0.075, lp: 0.4, decay: 6});
	}
	// estocada en el contratiempo
	for (const k of [1.5, 3.5]) {
		const t = t0 + k * b;
		if (t < 1) continue;
		for (const n of ch.tones.slice(0, 3)) voice({t, dur: b * 0.3, f: hz(n + 12), wave: 'saw', vol: 0.05, lp: 0.25, decay: 8});
	}
}

// batería: bombo en cada tiempo desde 1 s, palmas en 2 y 4, hi-hat en el contratiempo; se corta un instante en cada subida
for (let i = 0; i < DUR / b; i++) {
	const t = i * b;
	if (t < 1) continue;
	const rise = CUTS.some((c) => t > c - 0.5 && t < c);
	if (!rise) kick(t, 0.85);
	if (i % 2 && !rise) clap(t, 0.45);
	hat(t + b / 2, i % 4 === 1 ? 0.2 : 0.12);
}
// melodía (gancho) en campanas brillantes, desde el bloque del nombre (9 s)
const hook = [76, 0, 79, 81, 0, 79, 76, 0, 74, 0, 77, 79, 0, 77, 74, 0, 72, 74, 76, 0, 79, 0, 76, 74, 72, 0, 69, 0, 72, 0, 0, 0];
hook.forEach((n, i) => {
	const t = 9 + i * (b / 2);
	if (n && t < 23) voice({t, dur: b * 0.4, f: hz(n + 12), wave: 'bell', vol: 0.16, decay: 5});
});

// subida + impacto en cada corte; destellos mágicos cuando entra cada protagonista
for (const c of CUTS) {
	whoosh(c - 0.5, c, 0.35);
	impact(c, 0.7);
	for (const n of [57, 64, 69]) voice({t: c, dur: 0.7, f: hz(n), wave: 'saw', vol: 0.1, lp: 0.15, decay: 3});
}
for (const c of SUB_CUTS) {
	whoosh(c - 0.3, c, 0.25);
	impact(c, 0.5);
}
for (const c of [4.1, 5.8, 7.5]) for (let k = 0; k < 4; k++) voice({t: c + k * 0.06, dur: 0.3, f: hz(88 + k * 3), wave: 'bell', vol: 0.12, decay: 7});
// título HUNTR/X (1,0 s) y las tres palabras del festejo (15, 16 y 17 s)
for (const c of [1, 15, 16, 17]) {
	impact(c, 0.6);
	for (const k of [0, 1, 2]) voice({t: c + k * 0.05, dur: 0.4, f: hz(81 + k * 4), wave: 'bell', vol: 0.12, decay: 6});
}
// redoble final hacia la tarjeta de datos
for (let j = 0; j < 8; j++) noise(21.4 + j * 0.2, 0.12, 0.1 + j * 0.03, 0.3);

let peak = 0;
for (const v of buf) peak = Math.max(peak, Math.abs(v));
const g = 0.85 / (peak || 1);
const fadeOut = Math.floor(1.2 * SR);
const pcm = Buffer.alloc(buf.length * 2);
for (let i = 0; i < buf.length; i++) {
	let v = buf[i] * g;
	if (i < SR * 0.01) v *= i / (SR * 0.01);
	if (i > buf.length - fadeOut) v *= (buf.length - i) / fadeOut;
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
fs.writeFileSync(path.join(OUT, 'cazadoras.wav'), Buffer.concat([h, pcm]));
console.log('audio cazadoras');
