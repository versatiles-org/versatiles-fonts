#!/usr/bin/env node

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { getFontSources } from './lib/fonts.ts';
import { TarPacker } from './lib/tar.ts';
import type { FontGlyphsWrapper } from './lib/glyphs.ts';
import { buildAllGlyphs } from './lib/glyphs.ts';



console.log('prepare folder');
process.chdir(new URL('../', import.meta.url).pathname);
if (existsSync('dist')) rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });



console.log('scan for fonts');
const fontSources = getFontSources('font-sources');



const fontGlyphs = await buildAllGlyphs(fontSources);



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

