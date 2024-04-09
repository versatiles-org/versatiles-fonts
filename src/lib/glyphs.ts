import fontnik from 'fontnik';
import { readFileSync } from 'node:fs';
import type { FontFace, FontSourcesWrapper } from './fonts.ts';
import { Progress } from './progress.ts';
import { runParallel } from './async.ts';


interface Range {
	start: number; end: number;
}
const defaultRanges: Range[] = [];
for (let start = 0; start < 65536; start += 256) {
	const index = start / 256;
	defaultRanges[index] = { start, end: start + 255 };
}

export interface FontGlyphsWrapper {
	glyphs: { filename: string; buffer: Buffer; start: number }[];
	glyphSize: number;
	fontFace: FontFace;
}

export async function buildAllGlyphs(fonts: FontSourcesWrapper[]): Promise<FontGlyphsWrapper[]> {
	const fontRanges = [];
	for (const font of fonts) {
		for (const filename of font.sources) {
			const bufferFont = readFileSync(filename);
			const ranges = await getGlyphRanges(bufferFont, font.fontFace);
			for (const range of ranges) {
				fontRanges.push({
					...range,
					bufferFont,
					fontFace: font.fontFace,
				});
			}
		}
	}
	fontRanges.sort(() => Math.random() - 0.5);

	const fontGlyphsLookup = new Map<string, { fontFace: FontFace; start: number; end: number; buffers: Buffer[]; size: number }>();

	const progress1 = new Progress('build glyphs', fontRanges.reduce((s, f) => s + f.charCount, 0));
	await runParallel(fontRanges, async ({ bufferFont, fontFace, start, end, charCount }) => {
		const buffer = await new Promise<Buffer>(resolve => {
			fontnik.range(
				{ font: bufferFont, start, end },
				(err, glphysBuffer) => {
					if (err) throw Error(err);
					resolve(glphysBuffer);
				},
			);
		});

		const key = fontFace.fontId + ':' + start;
		const entry = fontGlyphsLookup.get(key);
		if (entry) {
			if (entry.end !== end) throw Error();
			entry.buffers.push(buffer);
			entry.size += buffer.length;
		} else {
			fontGlyphsLookup.set(key, {
				fontFace: fontFace,
				start: start,
				end: end,
				buffers: [buffer],
				size: buffer.length,
			});
		}
		progress1.increase(charCount);
	});
	progress1.finish();



	const fontGlyphsList = Array.from(fontGlyphsLookup.values());
	const fontGlyphsWrappers = new Map<string, FontGlyphsWrapper>();
	const progress2 = new Progress('merge glyphs', fontGlyphsList.reduce((s, f) => s + f.size, 0));
	await runParallel(fontGlyphsList, async ({ fontFace, start, end, buffers, size }) => {
		const filename = `${fontFace.fontId}/${start}-${end}.pbf`;
		const buffer = await new Promise<Buffer>(resolve => {
			fontnik.composite(buffers, (err, compositeBuffer) => {
				if (err) throw Error(err);
				resolve(compositeBuffer);
			});
		});
		const glyph = { filename, buffer, start };
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
	});
	progress2.finish();

	return Array.from(fontGlyphsWrappers.values());
}

async function getGlyphRanges(buffer: Buffer, fontFace: FontFace): Promise<{ charCount: number; start: number; end: number }[]> {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const result = await new Promise<{ family_name: string; style_name: string; points: number[] }[]>(resolve => {
		fontnik.load(buffer, (err, points) => {
			if (err) throw Error(err);
			resolve(points);
		});
	});
	if (result.length !== 1) throw Error();


	// eslint-disable-next-line @typescript-eslint/naming-convention, prefer-const
	let [{ family_name, style_name, points }] = result;

	family_name = family_name.replace(/([a-z])([A-Z])/g, '$1 $2');
	if (!family_name.startsWith(fontFace.familyName)) {
		throw Error(`Family name "${family_name}" does not start with "${fontFace.familyName}"`);
	}

	style_name = style_name.replace(/([a-z])([A-Z])/g, '$1 $2');
	if (style_name.startsWith('Hairline')) style_name = style_name.replace('Hairline', 'Thin');
	if (style_name.startsWith('Regular ')) style_name = style_name.replace('Regular ', '');
	style_name = style_name.trim().replace(/\s{2,}/g, ' ');

	if (style_name !== fontFace.styleName) {
		console.log(result);
		throw Error(`Style name "${style_name}" !== "${fontFace.styleName}"`);
	}

	const ranges = defaultRanges.map(range => ({ ...range, charCount: 0 }));
	points.forEach(charIndex => {
		const i = Math.floor(charIndex / 256);
		if (i < ranges.length) ranges[i].charCount++;
	});
	return ranges;
}
