import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export interface FontSourcesWrapper {
	sources: string[];
	fontFace: FontFace;
}

export interface FontGlyphsWrapper {
	glyphs: { filename: string, buffer: Buffer }[];
	glyphSize: number;
	fontFace: FontFace;
}

export interface FontFace {
	fontName: string;
	fontId: string;
	familyName: string;
	familyId: string;
	weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
	style: 'italic' | 'normal';
	variant: 'caption' | 'narrow' | 'condensed' | 'normal';
}

export function getFonts(inputDir: string): FontSourcesWrapper[] {
	const todos = new Array<FontSourcesWrapper>();

	readdirSync(inputDir).forEach(dirName => {
		if (dirName.startsWith('_')) return;

		const dirInFont = resolve(inputDir, dirName);
		if (!lstatSync(dirInFont).isDirectory()) return;
		let fonts = new Array<{ name: string; sources: string[] }>();

		let fontFile = resolve(dirInFont, 'fonts.json');
		if (existsSync(fontFile)) {
			fonts = JSON.parse(readFileSync(fontFile, 'utf8'));
		} else {
			readdirSync(dirInFont).forEach(file => {
				if (file.endsWith('.ttf') || file.endsWith('.otf')) {
					// compatible font name generation with genfontgl
					let name = basename(file);
					name = name.replace(/\..*?$/, '');
					name = name.replace(/\-/g, '');
					name = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
					name = name.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
					name = name.replace(/\s+/, ' ').trim();
					fonts.push({ name, sources: [basename(file)] });
				}
			});
		}

		// font.name should be lowercase+underscore
		fonts.forEach(font => {
			const fontId = font.name.toLowerCase().replace(/\s/g, '_');
			const familyName = dirName;
			const sources = font.sources
				.filter(filename => !filename.startsWith('#'))
				.map(filename => resolve(dirInFont, filename));

			let variation = font.name;
			if (!variation.startsWith(familyName)) throw Error();
			variation = variation.slice(familyName.length).toLowerCase();

			todos.push({
				sources,
				fontFace: {
					fontName: font.name,
					fontId,
					familyName,
					familyId: familyName.toLowerCase().replace(/\s/g, '_'),
					weight: extractVariation({ thin: 100, 'extra light': 200, light: 300, regular: 400, medium: 500, 'semi bold': 600, 'semibold': 600, 'web bold': 700, 'extra bold': 800, bold: 700, black: 900 }, 400),
					style: extractVariation({ italic: 'italic' }, 'normal'),
					variant: extractVariation({ caption: 'caption', narrow: 'narrow', condensed: 'condensed' }, 'normal'),
				}
			});

			if (variation.trim() !== '') throw Error(`can not find variation "${variation}" in name "${font.name}"`);

			function extractVariation<T>(lookup: Record<string, T>, defaultValue: T): T {
				variation = variation.trim().replace(/\s{2,}/g, ' ');
				for (const [key, value] of Object.entries(lookup)) {
					if (!variation.includes(key)) continue;
					variation = variation.replace(key, ' ');
					return value;
				}
				return defaultValue;
			}
		});
	});

	return todos;
}
