
import tar from 'tar-stream';
import { createGzip } from 'node:zlib';
import { FontGlyphsWrapper } from './glyphs.ts';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { Progress } from './progress.ts';
import { runParallel } from './async.ts';
import { FontFace } from './fonts.ts';

async function pack(filename: string, fonts: FontGlyphsWrapper[]) {
	if (!filename.endsWith('.tar.gz')) throw Error();

	const pack = tar.pack();

	// add glyphs
	fonts.sort((a, b) => a.fontFace.fontId.localeCompare(b.fontFace.fontId));
	for (const font of fonts) {
		if (!font.glyphs) continue;
		font.glyphs.sort((a, b) => a.start - b.start);
		for (const { filename, buffer } of font.glyphs) {
			pack.entry({ name: filename }, buffer);
		}
	}

	// add fonts.json
	pack.entry({ name: 'fonts.json' }, JSON.stringify(fonts.map(f => f.fontFace.fontId), null, '\t'));

	type VFontFamilies = Record<string, VFontFamily>;
	interface VFontFamily { name: string, fontFace: Record<string, VFontFace> };
	interface VFontFace {
		name: string;
		italic: boolean;
		weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
	}

	// add font_families.json
	const fontFamilies: VFontFamilies = {};
	fonts.forEach(font => {
		const { fontFace } = font;
		if (!fontFamilies[fontFace.familyId]) {
			fontFamilies[fontFace.familyId] = {
				name: fontFace.familyName,
				fontFace: {},
			}
		}
		fontFamilies[fontFace.familyId].fontFace[fontFace.fontId] = {
			name: fontFace.styleName,
			italic: fontFace.italic,
			weight: fontFace.weight,
		}
	})
	pack.entry({ name: 'font_families.json' }, JSON.stringify(fontFamilies, null, '\t'));

	pack.finalize();
	await finished(
		pack
			.pipe(createGzip({ level: 9 }))
			.pipe(createWriteStream(filename))
	);
}

export class TarPacker {
	readonly todos: { filename: string; fonts: FontGlyphsWrapper[]; size: number }[] = [];
	add(filename: string, fonts: FontGlyphsWrapper[]) {
		this.todos.push({ filename, fonts, size: fonts.reduce((s, f) => s + f.glyphSize, 0) })
	}
	async run() {
		const progress = new Progress('pack fonts', this.todos.reduce((s, t) => s + t.size, 0))
		await runParallel(this.todos, async todo => {
			await pack(todo.filename, todo.fonts);
			progress.increase(todo.size);
		});
		progress.finish();
	}
}
