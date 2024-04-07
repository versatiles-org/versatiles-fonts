import fontnik from 'fontnik';
import glyphCompose from '@mapbox/glyph-pbf-composite';
import { readFileSync } from 'node:fs';
import { Font, FontSource } from './fonts.ts';

export async function mergeGlyphs(font: Font) {
	const results = new Map<number, { start: number; end: number; buffers: Buffer[] }>();
	for (const source of font.sources) {
		if (source.glyphs === null) throw Error();
		for (const glyph of source.glyphs) {
			const entry = results.get(glyph.start);
			if (entry) {
				if (entry.end !== glyph.end) throw Error();
				entry.buffers.push(glyph.buffer);
			} else {
				results.set(glyph.start, {
					start: glyph.start,
					end: glyph.end,
					buffers: [glyph.buffer],
				});
			}
		}
	}
	font.glyphs = Array.from(results.values()).map(entry => ({
		name: `${font.fontFace.slug}/${entry.start}-${entry.end}.pbf`,
		buffer: glyphCompose.combine(entry.buffers),
	}));
}

export async function buildGlyphs(fontSource: FontSource) {
	const bufferIn = readFileSync(fontSource.filename);
	const glyphs: FontSource['glyphs'] = [];

	for (let start = 0; start < 65536; start += 256) {
		const end = start + 255;

		const buffer = await new Promise<Buffer>(resolve => {
			fontnik.range(
				{ font: bufferIn, start, end },
				(err: any, data: unknown) => {
					if (err) throw err;
					resolve(data as Buffer);
				}
			);
		})
		if (buffer) glyphs.push({ start, end, buffer });
	}

	fontSource.glyphs = glyphs;
	fontSource.glyphSize = glyphs.reduce((s, g) => s + g.buffer.length, 0);
}