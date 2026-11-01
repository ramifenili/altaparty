import type {TemplateDefinition, TemplateId} from './types';
import {boca} from './boca';
import {camino} from './camino';
import {campeones} from './campeones';
import {spidey} from './spidey';
import {toystory} from './toystory';
import {sonic} from './sonic';
import {kpop} from './kpop';
import {huntrx} from './huntrx';
import {arana} from './arana';
import {dinos} from './dinos';
import {unicornios} from './unicornios';
import {espacial} from './espacial';
import {gamer} from './gamer';
import {elegante} from './elegante';
import {tropical} from './tropical';
import {withOutro} from './outro';

/**
 * Catálogo de plantillas. Para agregar una: crear su archivo con un
 * `TemplateDefinition`, sumar su id en `ids.ts` y registrarla acá.
 * El editor, la vista previa y el exportador no necesitan cambios.
 */
export const TEMPLATES: TemplateDefinition[] = [boca, camino, campeones, spidey, toystory, sonic, kpop, huntrx, arana, dinos, unicornios, espacial, gamer, elegante, tropical].map(withOutro);

export function getTemplate(id: TemplateId): TemplateDefinition {
	return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
