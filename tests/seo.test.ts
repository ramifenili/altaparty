import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveSlug, slugify, stripSiteSuffix, templateSeo, templateSlug} from '../src/lib/seo.ts';
import {normalizeSettings} from '../src/config/site.ts';
import {isValidFont, normalizeSpec} from '../src/templates/compiled-types.ts';
import {sniffMedia} from '../src/server/media-sniff.ts';

const tpl = {id: 'tropical', name: 'Fiesta Tropical', description: 'Atardecer con palmeras y olas.'};

test('slugify: sin tildes ni símbolos', () => {
	assert.equal(slugify('Fiesta Tropical'), 'fiesta-tropical');
	assert.equal(slugify('Misión Espacial'), 'mision-espacial');
	assert.equal(slugify('Azul & Oro!!'), 'azul-y-oro');
	assert.equal(slugify('  ¡Héroe   Arácnido!  '), 'heroe-aracnido');
});

test('SEO predeterminado desde el nombre y la descripción; el admin puede pisarlo', () => {
	assert.equal(templateSlug(tpl), 'fiesta-tropical');
	const d = templateSeo(tpl);
	assert.match(d.title, /Fiesta Tropical/);
	assert.match(d.title, /AltaParty/);
	assert.ok(d.description.length <= 160);
	const o = templateSeo(tpl, {seoTitle: 'Mi título', seoDescription: 'Mi descripción'});
	assert.equal(o.title, 'Mi título | AltaParty', 'el título siempre termina con el nombre del sitio');
	assert.equal(templateSeo(tpl, {seoTitle: 'Mi título | AltaParty'}).title, 'Mi título | AltaParty', 'sin duplicarlo');
	assert.equal(templateSeo(tpl, {seoTitle: 'Mi título — AltaParty'}).title, 'Mi título | AltaParty');
	assert.equal(stripSiteSuffix('Hola '), 'Hola ', 'sin sufijo no toca los espacios (se está escribiendo)');
	assert.equal(o.description, 'Mi descripción');
	assert.equal(templateSlug(tpl, {slug: 'cumple-tropical'}), 'cumple-tropical');
	assert.equal(templateSlug(tpl, {slug: 'Slug Inválido!'}), 'fiesta-tropical', 'un slug inválido se ignora');
});

test('el admin puede editar nombre y etiqueta de cada plantilla', () => {
	const s = normalizeSettings({templates: {a1: {enabled: true, order: 1, name: '  Mi Nombre ', category: 'Fútbol', seoTitle: 'Algo | AltaParty'}}});
	assert.equal(s.templates.a1.name, 'Mi Nombre');
	assert.equal(s.templates.a1.category, 'Fútbol');
	assert.equal(s.templates.a1.seoTitle, 'Algo', 'se guarda sin el sufijo; se agrega al mostrarlo');
});

test('resolveSlug encuentra por el slug editado o el predeterminado', () => {
	const list = [tpl, {id: 'boca', name: 'Azul y Oro', description: 'x'}];
	assert.equal(resolveSlug('fiesta-tropical', list, {}), 'tropical');
	assert.equal(resolveSlug('FIESTA-TROPICAL', list, {}), 'tropical');
	assert.equal(resolveSlug('cumple-tropical', list, {tropical: {slug: 'cumple-tropical'}}), 'tropical');
	assert.equal(resolveSlug('fiesta-tropical', list, {tropical: {slug: 'cumple-tropical'}}), null, 'el slug viejo deja de existir');
	assert.equal(resolveSlug('no-existe', list, {}), null);
});

test('normalizeSettings valida slugs: formato válido y únicos', () => {
	const s = normalizeSettings({
		templates: {
			a1: {enabled: true, order: 1, slug: 'cumple-tropical', seoTitle: '  Título  '},
			b2: {enabled: true, order: 2, slug: 'cumple-tropical'},
			c3: {enabled: true, order: 3, slug: 'Con Espacios!'},
		},
	});
	assert.equal(s.templates.a1.slug, 'cumple-tropical');
	assert.equal(s.templates.a1.seoTitle, 'Título');
	assert.equal(s.templates.b2.slug, undefined, 'duplicado descartado');
	assert.equal(s.templates.c3.slug, undefined, 'inválido descartado');
});

test('tipografías: incluidas (CABJ 1905) o subidas (cf-<id>); cualquier otra se reemplaza', () => {
	assert.equal(isValidFont('CABJ1905'), true);
	assert.equal(isValidFont('cf-abcdef1234567890abcd'), true);
	assert.equal(isValidFont('cf-../../x'), false);
	assert.equal(isValidFont('Comic Sans'), false);
	const spec = normalizeSpec({
		name: 'x',
		scenes: [{layers: [{type: 'text', font: 'cf-abcdef1234567890abcd'}, {type: 'text', font: 'Raro'}, {type: 'shape', shape: 'cubo', fill: 'rojo', opacity: 999, h: -4}]}],
	});
	const ls = spec!.scenes[0].layers;
	assert.ok(ls[0].type === 'text' && ls[0].font === 'cf-abcdef1234567890abcd');
	assert.ok(ls[1].type === 'text' && ls[1].font === 'Anton');
	assert.ok(ls[2].type === 'shape' && ls[2].shape === 'rect' && ls[2].opacity === 100 && ls[2].h >= 0.1 && ls[2].fill === '#ffffff');
});

test('las tipografías subidas se reconocen por su contenido', () => {
	const pad = (b: number[]) => Buffer.concat([Buffer.from(b), Buffer.alloc(32)]);
	assert.equal(sniffMedia(pad([0, 1, 0, 0]))?.kind, 'font');
	assert.equal(sniffMedia(Buffer.concat([Buffer.from('OTTO'), Buffer.alloc(32)]))?.mime, 'font/otf');
	assert.equal(sniffMedia(Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(32)]))?.mime, 'font/woff2');
});

test('{title} se reemplaza por el nombre en el título y la descripción', async () => {
	const {templateSeo} = await import('../src/lib/seo.ts');
	const t = {id: 'a1', name: 'Fiesta Tropical', description: 'Playa.', category: 'Verano'};
	const r = templateSeo(t, {seoTitle: '{title}: invitación en video', seoDescription: 'Mirá {title} y personalizala.'});
	assert.equal(r.title, 'Fiesta Tropical: invitación en video | AltaParty');
	assert.equal(r.description, 'Mirá Fiesta Tropical y personalizala.');
});

test('etiquetas ocultas: se normalizan y ayudan a buscar sin tildes', async () => {
	const {normalizeTags, matchesSearch} = await import('../src/lib/seo.ts');
	const {normalizeSettings} = await import('../src/config/site.ts');
	assert.deepEqual(normalizeTags('Fútbol,  boca , FÚTBOL,,azul y oro'), ['fútbol', 'boca', 'azul y oro']);
	assert.deepEqual(normalizeSettings({templates: {a1: {enabled: true, order: 1, tags: ['Boca', 'boca', 5]}}}).templates.a1.tags, ['boca']);
	const t = {name: 'Azul y Oro', category: 'Deportes', tags: ['futbol', 'cancha']};
	assert.equal(matchesSearch(t, 'FÚTBOL'), true);
	assert.equal(matchesSearch(t, 'azul cancha'), true);
	assert.equal(matchesSearch(t, 'unicornio'), false);
	assert.equal(matchesSearch(t, ''), true);
});
