import fontnik from 'fontnik';
import glyphCompose from '@mapbox/glyph-pbf-composite';
import { readFileSync, statSync } from 'node:fs';
import { FontFace, FontGlyphsWrapper, FontSourcesWrapper } from './fonts.ts';
import { Progress } from './progress.ts';
import { runParallel } from './async.ts';



export async function buildAllGlyphs(fonts: FontSourcesWrapper[]): Promise<FontGlyphsWrapper[]> {
	const fontSources = fonts.flatMap(font => font.sources.map(filename => ({
		filename,
		fontFace: font.fontFace,
		size: statSync(filename).size
	})));
	fontSources.sort((a, b) => b.size - a.size);

	const fontGlyphsLookup = new Map<string, { fontFace: FontFace; start: number; end: number; buffers: Buffer[], size: number }>();

	let progress1 = new Progress('build glyphs', fontSources.reduce((s, f) => s + f.size, 0));
	await runParallel(fontSources, async ({ filename, fontFace, size }) => {
		const glyphs = await buildGlyphs(filename);

		for (const glyph of glyphs) {
			const key = fontFace.fontId + ':' + glyph.start;
			const entry = fontGlyphsLookup.get(key);
			if (entry) {
				if (entry.end !== glyph.end) throw Error();
				entry.buffers.push(glyph.buffer);
				entry.size += glyph.buffer.length;
			} else {
				fontGlyphsLookup.set(key, {
					fontFace: fontFace,
					start: glyph.start,
					end: glyph.end,
					buffers: [glyph.buffer],
					size: glyph.buffer.length,
				});
			}
		}
		progress1.increase(size);
	});
	progress1.finish();

	const fontGlyphsList = Array.from(fontGlyphsLookup.values());
	const fontGlyphsWrappers = new Map<string, FontGlyphsWrapper>();
	let progress2 = new Progress('merge glyphs', fontGlyphsList.reduce((s, f) => s + f.size, 0));
	await runParallel(fontGlyphsList, async ({ fontFace, start, end, buffers, size }) => {
		const filename = `${fontFace.fontId}/${start}-${end}.pbf`;
		const buffer = glyphCompose.combine(buffers);
		const glyph = { filename, buffer };
		const key = fontFace.fontId;
		const entry = fontGlyphsWrappers.get(key);
		if (entry) {
			entry.fontFace = fontFace;
			entry.glyphs.push(glyph);
			entry.glyphSize += buffer.length;
		} else {
			fontGlyphsWrappers.set(key, { fontFace, glyphs: [glyph], glyphSize: buffer.length });
		}
		progress2.increase(size);
	})
	progress2.finish();

	return Array.from(fontGlyphsWrappers.values());
}


async function buildGlyphs(filename: string) {
	const bufferIn = readFileSync(filename);
	const glyphs: { start: number; end: number; buffer: Buffer }[] = [];

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

	return glyphs;
}
