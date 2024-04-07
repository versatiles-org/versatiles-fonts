import fontnik from 'fontnik';
import glyphCompose from '@mapbox/glyph-pbf-composite';
import { readFileSync } from 'node:fs';
import { Font } from './fonts.ts';
import { resolve } from 'node:path';

export async function makeGlyphs(font: Font) {
	const results = new Map<number, { start: number; end: number; buffers: Buffer[] }>();
	for (const source of font.sources) {
		const bufferIn = readFileSync(resolve(font.dirInFont, source));

		for (let start = 0; start < 65536; start += 256) {
			const end = start + 255;

			const bufferOut = await new Promise<Buffer>(resolve => {
				fontnik.range(
					{ font: bufferIn, start, end },
					(err: any, data: unknown) => {
						if (err) throw err;
						resolve(data as Buffer);
					}
				);
			})
			if (bufferOut) {
				const entry = results.get(start);
				if (entry) {
					entry.buffers.push(bufferOut);
				} else {
					results.set(start, { start, end, buffers: [bufferOut] });
				}
			}
		}
	}

	font.results = Array.from(results.values()).map(entry => ({
		name: `${font.fontFace.slug}/${entry.start}-${entry.end}.pbf`,
		buffer: glyphCompose.combine(entry.buffers),
	}));
	font.sizeOut = font.results.reduce((s, e) => s + e.buffer.length, 0);
}
