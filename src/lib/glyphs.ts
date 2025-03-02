import type { FontFace, FontSourcesWrapper } from './fonts.ts';
import { Progress } from './progress.ts';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { readdirSync, readFileSync, rmSync } from 'node:fs';

export interface FontGlyphsWrapper {
	glyphs: { filename: string; buffer: Buffer; start: number }[];
	fontFace: FontFace;
	size: number;
}

export function buildAllGlyphs(fonts: FontSourcesWrapper[], tempDir: string): FontGlyphsWrapper[] {
	const result: FontGlyphsWrapper[] = [];

	let progress = new Progress('Converting glyphs...', fonts.reduce((sum, f) => sum + f.size, 0));

	for (const font of fonts) {
		const outDir = resolve(tempDir, font.fontFace.fontId);
		rmSync(outDir, { recursive: true, force: true });

		spawnSync('versatiles_glyphs', [
			'convert',
			'-o', outDir,
			...font.filenames
		], { stdio: 'ignore' });

		const glyphs = readdirSync(outDir).filter(f => f.endsWith('.pbf')).map(f => ({
			filename: join(font.fontFace.fontId, f),
			buffer: readFileSync(resolve(outDir, f)),
			start: parseInt(f.split('-')[0], 10),
		}));

		result.push({
			fontFace: font.fontFace,
			glyphs,
			size: glyphs.reduce((sum, g) => sum + g.buffer.length, 0)
		});

		progress.increase(font.size);
	}

	progress.finish();

	return result;
}
