import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSettings} from '../src/config/site.ts';
import {SEED_SETTINGS} from '../src/config/seed-settings.ts';

test('la configuración inicial es válida: normalizarla no cambia nada', () => {
	assert.deepEqual(normalizeSettings(SEED_SETTINGS), SEED_SETTINGS);
});
