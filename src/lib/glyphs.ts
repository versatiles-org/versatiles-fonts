import fontnik from 'fontnik';
import glyphCompose from '@mapbox/glyph-pbf-composite';
import 'work-faster';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Font } from './fonts.ts';
import { resolve } from 'node:path';

export async function makeGlyphs(font: Font) {
	if (!existsSync(font.dirOutFont)) mkdirSync(font.dirOutFont);

	const sourceFonts: Record<string, Buffer> = {};
	font.sources.forEach(sourceName => {
		sourceFonts[sourceName] = readFileSync(resolve(font.dirInFont, sourceName));
	});

	let sizeSum = 0;
	for (let start = 0; start < 65536; start += 256) {
		const end = start + 255;

		let results = await Promise.all(font.sources.map(sourceName => {
			let source = sourceFonts[sourceName];
			if (!source) throw Error(`[${font.fontFace.name}] Source "%{sourceName}" not found`);

			return new Promise((resolve, reject) => {
				fontnik.range(
					{ font: source, start, end },
					(err: any, data: unknown) => {
						if (err) reject(); else resolve(data);
					}
				);
			});
		}))

		results = results.filter(r => r);

		let combined = glyphCompose.combine(results);
		sizeSum += combined.length;

		writeFileSync(resolve(font.dirOutFont, `${start}-${end}.pbf`), combined);
	}

	font.sizeOut = sizeSum;
}
