
import tar from 'tar-stream';
import { createGzip } from 'node:zlib';
import { FontGlyphsWrapper } from './glyphs.ts';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { Progress } from './progress.ts';
import { runParallel } from './async.ts';

async function pack(filename: string, fonts: FontGlyphsWrapper[]) {
	if (!filename.endsWith('.tar.gz')) throw Error();

	const pack = tar.pack();

	for (const font of fonts) {
		if (!font.glyphs) continue;
		for (const { filename, buffer } of font.glyphs) {
			pack.entry({ name: filename }, buffer);
		}
	}

	pack.finalize();
	await finished(
		pack
			.pipe(createGzip({ level: 9 }))
			.pipe(createWriteStream(filename))
	);

	//writeFileSync(
	//	resolve(outputDir, 'fonts.json'),
	//	JSON.stringify(fonts.map(f => f.name), null, '\t')
	//);
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
