
import tar from 'tar-stream';
import { createGzip } from 'node:zlib';
import { Font } from './fonts.ts';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';

export async function pack(filename: string, fonts: Font[]) {
	if (!filename.endsWith('.tar.gz')) throw Error();
	console.log(` - pack: ${filename}`);

	const pack = tar.pack();

	for (const font of fonts) {
		if (!font.glyphs) continue;
		for (const file of font.glyphs) {
			pack.entry({ name: file.name }, file.buffer);
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
