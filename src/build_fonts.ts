#!/usr/bin/env node

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { getFontSources } from './lib/fonts.ts';
import { TarPacker } from './lib/tar.ts';
import type { FontGlyphsWrapper } from './lib/glyphs.ts';
import { buildAllGlyphs } from './lib/glyphs.ts';
import { resolve } from 'node:path';



console.log('prepare folder');
process.chdir(new URL('../', import.meta.url).pathname);
if (existsSync('dist')) rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });



console.log('scan for fonts');
const fontSources = getFontSources('fonts');


const tempDir = resolve('dist/tmp');
const fontGlyphs = buildAllGlyphs(fontSources, tempDir);



const packer = new TarPacker();
packer.add('dist/fonts.tar.gz', fontGlyphs);

const fontFamilies: Record<string, FontGlyphsWrapper[]> = {};
fontGlyphs.forEach(f => {
	const key = f.fontFace.familyId;
	if (key in fontFamilies) {
		fontFamilies[key].push(f);
	} else {
		fontFamilies[key] = [f];
	}
});
for (const [family, fontSubset] of Object.entries(fontFamilies)) {
	packer.add(`dist/${family}.tar.gz`, fontSubset);
}

await packer.run();



console.log('Finished');

