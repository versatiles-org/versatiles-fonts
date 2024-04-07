#!/usr/bin/env node
'use strict'

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { Font, getFonts } from './lib/fonts.ts';
import { Packer } from './lib/tar.ts';
import { buildGlyphs, mergeGlyphs } from './lib/glyphs.ts';
import { runParallel } from './lib/async.ts';
import { Progress } from './lib/progress.ts';

process.chdir(new URL('../', import.meta.url).pathname)



console.log('prepare folder');
if (existsSync('dist')) rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });



console.log('scan for fonts');
const fonts = getFonts('font-sources');//.filter(f => f.fontFace.family === 'Fira Sans');



const fontSources = fonts.flatMap(f => f.sources);
fontSources.sort((a, b) => b.size - a.size);
let progress = new Progress('build glyphs', fontSources.reduce((s, f) => s + f.size, 0));
await runParallel(fontSources, async fontSource => {
	await buildGlyphs(fontSource);
	progress.increase(fontSource.size);
});
progress.finish();



fonts.forEach(font => font.glyphSize = font.sources.reduce((sum, source) => sum + source.glyphSize, 0))
progress = new Progress('merge glyphs', fonts.reduce((s, f) => s + f.glyphSize, 0));
await runParallel(fonts, async font => {
	await mergeGlyphs(font);
	progress.increase(font.glyphSize);
});
progress.finish();




const packer = new Packer();
packer.add('dist/fonts.tar.gz', fonts);

const fontFamilies: Record<string, Font[]> = {};
fonts.forEach(f => {
	const key = f.fontFace.family;
	if (fontFamilies[key]?.push(f)) return;
	fontFamilies[key] = [f];
})
for (const [family, fontSubset] of Object.entries(fontFamilies)) {
	packer.add(`dist/${family}.tar.gz`, fontSubset)
}

await packer.run();



console.log('Finished')

