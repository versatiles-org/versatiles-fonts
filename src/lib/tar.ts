
import tar from 'tar-stream';
import { createGzip } from 'node:zlib';
import type { FontGlyphsWrapper } from './glyphs.ts';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { Progress } from './progress.ts';
import { runParallel } from './async.ts';

async function packFonts(tarGzFilename: string, fonts: FontGlyphsWrapper[]): Promise<void> {
	if (!tarGzFilename.endsWith('.tar.gz')) throw Error();

	const pack = tar.pack();

	// add glyphs
	fonts.sort((a, b) => a.fontFace.fontId.localeCompare(b.fontFace.fontId));
	for (const font of fonts) {
		font.glyphs.sort((a, b) => a.start - b.start);
		for (const { filename, buffer } of font.glyphs) {
			pack.entry({ name: filename }, buffer);
		}
	}

	// add index.json
	pack.entry({ name: 'index.json' }, JSON.stringify(fonts.map(f => f.fontFace.fontId), null, '\t'));

	type VFontFamilies = Record<string, VFontFamily>;
	interface VFontFamily {
		name: string; fontFace: Record<string, VFontFace>;
	}
	interface VFontFace {
		name: string;
		italic: boolean;
		weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
	}

	// add font_families.json
	const fontFamilies: VFontFamilies = {};
	fonts.forEach(font => {
		const { fontFace } = font;
		if (!(fontFace.familyId in fontFamilies)) {
			fontFamilies[fontFace.familyId] = {
				name: fontFace.familyName,
				fontFace: {},
			};
		}
		fontFamilies[fontFace.familyId].fontFace[fontFace.fontId] = {
			name: fontFace.styleName,
			italic: fontFace.italic,
			weight: fontFace.weight,
		};
	});
	pack.entry({ name: 'font_families.json' }, JSON.stringify(fontFamilies, null, '\t'));

	pack.finalize();
	await finished(
		pack
			.pipe(createGzip({ level: 9 }))
			.pipe(createWriteStream(tarGzFilename)),
	);
}

export class TarPacker {
	private readonly todos: { filename: string; fonts: FontGlyphsWrapper[]; size: number }[] = [];

	public add(filename: string, fonts: FontGlyphsWrapper[]): void {
		this.todos.push({ filename, fonts, size: fonts.reduce((s, f) => s + f.glyphSize, 0) });
	}

	public async run(): Promise<void> {
		const progress = new Progress('pack fonts', this.todos.reduce((s, t) => s + t.size, 0));
		await runParallel(this.todos, async todo => {
			await packFonts(todo.filename, todo.fonts);
			progress.increase(todo.size);
		});
		progress.finish();
	}
}
