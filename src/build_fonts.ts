#!/usr/bin/env node
'use strict'

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { getFonts } from './lib/fonts.ts';
import { pack } from './lib/tar.ts';

process.chdir(new URL('../', import.meta.url).pathname)



console.log('prepare folder');
if (existsSync('dist')) rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });



console.log('scan for fonts');
const fonts = getFonts('font-sources', 'dist/fonts/');



console.log('convert fonts');
let sizePos = 0;
let sizeSum = fonts.reduce((s, f) => s + f.sizeIn, 0);
await fonts.forEach(async font => {
	let progress = (100 * sizePos / sizeSum).toFixed(1) + '%';
	progress = ' '.repeat(8 - progress.length) + progress;
	process.stdout.write(`\u001b[2K\r${progress} - ${font.fontFace.name}`)

	//await makeGlyphs(font);
	sizePos += font.sizeIn;
})
process.stdout.write('\u001b[2K\r')

await pack('fonts', fonts);

let fontFamilies = Map.groupBy(fonts, f => f.fontFace.family);
for (let [family, fonts] of Object.entries(fontFamilies)) {
	await pack(family, fonts);
}



console.log('Finished')

