// Descarga (una sola vez) tipografías con licencia OFL desde Google Fonts y las
// guarda en public/fonts para que la app y el exportador no dependan de un CDN.
import fs from 'node:fs';
import path from 'node:path';

const FONTS = [
	['Bangers', 'Bangers', '400'],
	['Anton', 'Anton', '400'],
	['Fredoka', 'Fredoka', '600'],
	['PressStart2P', 'Press+Start+2P', '400'],
	['PlayfairDisplay', 'Playfair+Display', '700'],
	['Montserrat', 'Montserrat', '800'],
	['Pacifico', 'Pacifico', '400'],
	// variable (400–900): sirve para todos los pesos con un solo archivo
	['RacingSansOne', 'Racing+Sans+One', '400'],
	['RedHatDisplay', 'Red+Hat+Display', '400..900'],
	// landing: equivalentes abiertos de las tipografías de referencia
	['DMSans', 'DM+Sans', '400..800'],
	['Inter', 'Inter', '400..600'],
	['Caveat', 'Caveat', '600'],
	// títulos de la interfaz
	['BagelFatOne', 'Bagel+Fat+One', '400'],
	['DynaPuff', 'DynaPuff', '400..700'],
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const out = path.join(import.meta.dirname, '..', 'public', 'fonts');
fs.mkdirSync(out, {recursive: true});

for (const [file, family, weight] of FONTS) {
	const dest = path.join(out, `${file}.woff2`);
	if (fs.existsSync(dest)) continue;
	const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`, {headers: {'User-Agent': UA}})).text();
	// el último bloque @font-face es el subset "latin" (incluye ñ y acentos del español)
	const urls = [...css.matchAll(/url\((https:[^)]+\.woff2)\)/g)].map((m) => m[1]);
	const url = urls[urls.length - 1];
	if (!url) throw new Error('Sin woff2 para ' + family);
	fs.writeFileSync(dest, Buffer.from(await (await fetch(url)).arrayBuffer()));
	console.log('fuente', file);
}
