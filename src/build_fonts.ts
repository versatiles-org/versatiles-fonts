#!/usr/bin/env node
'use strict'

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { Font, getFonts } from './lib/fonts.ts';
import { pack } from './lib/tar.ts';
import { makeGlyphs } from './lib/glyphs.ts';
import { runParallel } from './lib/async.ts';

process.chdir(new URL('../', import.meta.url).pathname)



console.log('prepare folder');
if (existsSync('dist')) rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });



console.log('scan for fonts');
const fonts = getFonts('font-sources');//.filter(f => f.fontFace.family === 'Fira Sans');



console.log('convert fonts');
let sizePos = 0;
let sizeSum = fonts.reduce((s, f) => s + f.sizeIn, 0);
await runParallel(fonts.map(font => (async () => {
	await makeGlyphs(font);
	sizePos += font.sizeIn;
	let progress = (100 * sizePos / sizeSum).toFixed(1) + '%';
	progress = ' '.repeat(8 - progress.length) + progress;
	process.stdout.write(`\u001b[2K\r${progress} - ${font.fontFace.name}`)
})));
process.stdout.write('\u001b[2K\r')



console.log('pack fonts');
const todos: [string, Font[]][] = []
todos.push(['dist/fonts.tar.gz', fonts]);

const fontFamilies: Record<string, Font[]> = {};
fonts.forEach(f => {
	const key = f.fontFace.family;
	if (fontFamilies[key]?.push(f)) return;
	fontFamilies[key] = [f];
})

for (const [family, fontSubset] of Object.entries(fontFamilies)) {
	await pack(`dist/${family}.tar.gz`, fontSubset);
}



console.log('Finished')

