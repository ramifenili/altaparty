import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {SOUNDS, getSound, resolveAudio, formatDuration} from '../src/audio/library.ts';
import {TEMPLATE_IDS} from '../src/templates/ids.ts';

const TEMPLATE_FILES: Record<string, string> = {};

test('cada sonido de la biblioteca existe en public/audio con un formato de audio soportado', () => {
	for (const s of SOUNDS) {
		const buf = fs.readFileSync(path.join(process.cwd(), 'public', s.file));
		const ext = s.file.split('.').pop()?.toLowerCase();
		assert.ok(['wav', 'mp3', 'm4a', 'aac', 'ogg'].includes(ext ?? ''), `${s.id}: formato ${ext}`);
		assert.ok(buf.length > 10_000, `${s.id}: archivo vacío`);
		if (ext === 'wav') {
			assert.equal(buf.toString('ascii', 0, 4), 'RIFF', s.id);
			assert.equal(buf.toString('ascii', 8, 12), 'WAVE', s.id);
		}
		if (ext === 'mp3') assert.ok(buf.toString('ascii', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0), `${s.id}: no parece un mp3`);
	}
});

test('hay un sonido predeterminado distinto y existente para cada plantilla (15) y los ids son únicos', () => {
	assert.equal(new Set(SOUNDS.map((s) => s.id)).size, SOUNDS.length);
	assert.equal(TEMPLATE_IDS.length, 15);
	const defaults = new Map<string, string>();
	for (const id of TEMPLATE_IDS) {
		const file = TEMPLATE_FILES[id] ?? `${id}.ts`;
		const src = fs.readFileSync(path.join(process.cwd(), 'src', 'templates', file), 'utf8');
		assert.match(src, new RegExp(`id: ['\"]${id}['\"]`), `${file} declara id ${id}`);
		const audio = /defaultAudioId: ['\"]([^'\"]+)['\"]/.exec(src)?.[1];
		assert.ok(audio && getSound(audio), `${id}: sonido predeterminado existente`);
		defaults.set(id, audio!);
	}
	assert.equal(new Set(defaults.values()).size, 15, 'cada plantilla tiene un sonido predeterminado propio');
});

test('resolveAudio: predeterminado, biblioteca, silencio y audio propio', () => {
	const def = resolveAudio({kind: 'default'}, 'estrella-pop');
	assert.ok(def.kind === 'url' && def.url === getSound('estrella-pop')!.file);
	const lib = resolveAudio({kind: 'library', id: 'nivel-arcade'}, 'estrella-pop');
	assert.ok(lib.kind === 'url' && lib.url.includes('nivel-arcade'));
	assert.equal(resolveAudio({kind: 'mute'}, 'estrella-pop').kind, 'none');
	const file = {name: 'mi-cancion.MP3'} as File;
	const custom = resolveAudio({kind: 'custom', file, url: 'blob:x', name: 'mi-cancion.MP3', duration: 30}, 'estrella-pop');
	assert.ok(custom.kind === 'file' && custom.ext === 'mp3');
	// al cambiar de plantilla, "default" sigue a la plantilla nueva; el audio propio se conserva
	const other = resolveAudio({kind: 'default'}, 'gala-dorada');
	assert.ok(other.kind === 'url' && other.url.includes('gala-dorada'));
});

test('formatDuration', () => {
	assert.equal(formatDuration(12), '0:12');
	assert.equal(formatDuration(75), '1:15');
	assert.equal(formatDuration(null), '');
});
