import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
	EMPTY_INVITATION,
	formatLongDate,
	formatTime,
	toTemplateContent,
	validateInvitation,
	type InvitationData,
} from '../src/domain/invitation.ts';

const NOW = new Date(2026, 5, 1);
const valid: InvitationData = {
	name: 'Mateo',
	age: '7',
	date: '2026-12-12',
	time: '16:00',
	timeEnd: '',
	venue: 'Salón Los Pibes',
	address: 'Av. Corrientes 1234, CABA',
};

test('un formulario vacío marca todos los campos obligatorios, en español', () => {
	const e = validateInvitation(EMPTY_INVITATION, NOW);
	assert.deepEqual(Object.keys(e).sort(), ['address', 'age', 'date', 'name', 'time', 'venue']);
	assert.match(e.name!, /nombre/i);
	assert.match(e.time!, /horario/i);
});

test('datos completos no tienen errores (la foto es opcional)', () => {
	assert.deepEqual(validateInvitation(valid, NOW), {});
});

test('la edad debe ser un entero entre 1 y 120', () => {
	for (const bad of ['0', '121', '-3', '7.5', 'abc', ' ']) {
		assert.ok(validateInvitation({...valid, age: bad}, NOW).age, `edad ${bad}`);
	}
	assert.equal(validateInvitation({...valid, age: '120'}, NOW).age, undefined);
});

test('la fecha no puede estar en el pasado ni ser inexistente', () => {
	assert.ok(validateInvitation({...valid, date: '2026-01-10'}, NOW).date);
	assert.ok(validateInvitation({...valid, date: '2026-02-31'}, NOW).date);
	assert.equal(validateInvitation({...valid, date: '2026-06-01'}, NOW).date, undefined);
});

test('los textos largos se rechazan con un mensaje claro', () => {
	assert.ok(validateInvitation({...valid, name: 'x'.repeat(40)}, NOW).name);
	assert.ok(validateInvitation({...valid, address: 'y'.repeat(200)}, NOW).address);
});

test('formatos legibles de fecha y horario', () => {
	assert.equal(formatLongDate('2026-12-12'), 'sábado 12 de diciembre de 2026');
	assert.equal(formatTime('16:00'), '16:00 hs');
	const c = toTemplateContent(valid, null);
	assert.equal(c.monthName, 'diciembre');
	assert.equal(c.weekday, 'sábado');
	assert.equal(c.age, 7);
	assert.equal(c.photo, null);
});
