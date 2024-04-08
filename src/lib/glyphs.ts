import fontnik from 'fontnik';
import { readFileSync, statSync } from 'node:fs';
import { FontFace, FontSourcesWrapper } from './fonts.ts';
import { Progress } from './progress.ts';
import { runParallel } from './async.ts';



export interface FontGlyphsWrapper {
	glyphs: { filename: string, buffer: Buffer }[];
	glyphSize: number;
	fontFace: FontFace;
}

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
		const bufferIn = readFileSync(filename);
		try {
			await verifyGlyphsStyle(bufferIn, fontFace);
		} catch (err) {
			console.error('   for file:', filename);
			console.error('   for fontFace:', fontFace);
			throw err;
		}

		const glyphs = await buildGlyphs(bufferIn);

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
		const buffer = await new Promise<Buffer>(resolve => fontnik.composite(buffers, (err, buffer) => {
			if (err) throw Error(err);
			resolve(buffer);
		}));
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


async function buildGlyphs(bufferIn: Buffer) {
	const glyphs: { start: number; end: number; buffer: Buffer }[] = [];

	for (let start = 0; start < 65536; start += 256) {
		const end = start + 255;

		const buffer = await new Promise<Buffer>(resolve => {
			fontnik.range(
				{ font: bufferIn, start, end },
				(err, buffer) => {
					if (err) throw err;
					resolve(buffer);
				}
			);
		})
		if (buffer) glyphs.push({ start, end, buffer });
	}

	return glyphs;
}

async function verifyGlyphsStyle(bufferIn: Buffer, fontFace: FontFace) {
	const result = await new Promise<{ family_name: string; style_name: string; points: number[]; }[]>(resolve => {
		fontnik.load(bufferIn, (err, points) => {
			if (err) throw Error(err);
			resolve(points);
		})
	});
	if (result.length !== 1) throw Error();
	const definition = result[0];
	if (!definition.family_name.startsWith(fontFace.familyName)) {
		throw Error(`Family name "${definition.family_name}" does not start with "${fontFace.familyName}"`)
	}
	if (definition.style_name !== fontFace.styleName) {
		console.log(result);
		throw Error(`Style name "${definition.style_name}" !== "${fontFace.styleName}"`)
	}
}
