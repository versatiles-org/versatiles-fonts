#!/usr/bin/env node
'use strict'

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { FontGlyphsWrapper, getFonts as getFontSources } from './lib/fonts.ts';
import { Packer } from './lib/tar.ts';
import { buildAllGlyphs } from './lib/glyphs.ts';

process.chdir(new URL('../', import.meta.url).pathname)



console.log('prepare folder');
if (existsSync('dist')) rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });



console.log('scan for fonts');
const fontSources = getFontSources('font-sources');//.filter(f => f.fontFace.family === 'Fira Sans');


const fontGlyphs = await buildAllGlyphs(fontSources);




const packer = new Packer();
packer.add('dist/fonts.tar.gz', fontGlyphs);

const fontFamilies: Record<string, FontGlyphsWrapper[]> = {};
fontGlyphs.forEach(f => {
	const key = f.fontFace.familyId;
	if (fontFamilies[key]?.push(f)) return;
	fontFamilies[key] = [f];
})
for (const [family, fontSubset] of Object.entries(fontFamilies)) {
	packer.add(`dist/${family}.tar.gz`, fontSubset)
}

await packer.run();



console.log('Finished')

