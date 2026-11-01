const fs = require('fs');
const path = require('path');

const srcDir = path.join(
	__dirname,
	'..',
	'node_modules',
	'@ffmpeg',
	'core',
	'dist',
	'umd'
);
const destDir = path.join(__dirname, '..', 'public', 'ffmpeg');

if (!fs.existsSync(srcDir)) {
	console.warn(
		'[copy-ffmpeg-core] No se encontró @ffmpeg/core, se omite la copia.'
	);
	process.exit(0);
}

fs.mkdirSync(destDir, {recursive: true});

for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
	const from = path.join(srcDir, file);
	const to = path.join(destDir, file);
	if (fs.existsSync(from)) {
		fs.copyFileSync(from, to);
		console.log(`[copy-ffmpeg-core] copiado ${file} -> public/ffmpeg/`);
	}
}
