// Lista de plantillas sin código de dibujo: la usa también el servidor para
// validar el identificador antes de crear una compra.
export const TEMPLATE_IDS = [
	'boca',
	'camino',
	'campeones',
	'spidey',
	'toystory',
	'sonic',
	'kpop',
	'huntrx',
	'arana',
	'dinos',
	'unicornios',
	'espacial',
	'gamer',
	'elegante',
	'tropical',
] as const;

export function isBuiltinTemplate(v: unknown): v is (typeof TEMPLATE_IDS)[number] {
	return typeof v === 'string' && (TEMPLATE_IDS as readonly string[]).includes(v);
}
