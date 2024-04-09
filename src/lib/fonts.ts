import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export interface FontSourcesWrapper {
	sources: Buffer[];
	fontFace: FontFace;
}

export interface FontFace {
	fontName: string;
	fontId: string;
	familyName: string;
	familyId: string;
	weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
	italic: boolean;
	styleName: string;
}

export function getFontSources(inputDir: string): FontSourcesWrapper[] {
	const todos = new Array<FontSourcesWrapper>();

	readdirSync(inputDir).forEach(dirName => {
		if (dirName.startsWith('_')) return;

		const dirInFont = resolve(inputDir, dirName);
		if (!lstatSync(dirInFont).isDirectory()) return;
		let fonts = new Array<{ name: string; sources: string[] }>();

		const fontFile = resolve(dirInFont, 'fonts.json');
		if (existsSync(fontFile)) {
			fonts = JSON.parse(readFileSync(fontFile, 'utf8')) as { name: string; sources: string[] }[];
		} else {
			readdirSync(dirInFont).forEach(file => {
				if (file.endsWith('.ttf') || file.endsWith('.otf')) {
					// compatible font name generation with genfontgl
					let name = basename(file);
					name = name.replace(/\..*?$/, '');
					name = name.replace(/\-/g, '');
					name = name.replace(/_/g, ' ');
					name = name.replace(/([a-z0-9])([A-Z0-9])/g, '$1 $2');
					name = name.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
					name = name.replace(/\s+/, ' ').trim();
					fonts.push({ name, sources: [basename(file)] });
				}
			});
		}

		// font.name should be lowercase+underscore
		fonts.forEach(font => {
			const sources = font.sources
				.filter(filename => !filename.startsWith('#'))
				.map(filename => readFileSync(resolve(dirInFont, filename)));

			if (sources.length <= 0) throw Error();

			todos.push({
				sources,
				fontFace: getFontFace(font.name, dirName),
			});
		});
	});

	return todos;
}

function getFontFace(fontName: string, familyName: string): FontFace {
	let variation = fontName;
	if (!variation.startsWith(familyName)) throw Error(`fontName "${fontName}" does not start with familyName "${familyName}"`);
	variation = variation.slice(familyName.length).toLowerCase();

	// eslint-disable-next-line @typescript-eslint/naming-convention
	const weight: FontFace['weight'] = extractVariation({ thin: 100, 'extra light': 200, light: 300, regular: 400, medium: 500, 'semi bold': 600, 'semibold': 600, 'web bold': 700, 'extra bold': 800, bold: 700, black: 900 }, 400);
	const italic: FontFace['italic'] = extractVariation({ italic: true }, false);

	const styleParts: string[] = [];
	switch (weight) {
		case 100: styleParts.push('Thin'); break;
		case 200: styleParts.push('Extra Light'); break;
		case 300: styleParts.push('Light'); break;
		case 400: break;
		case 500: styleParts.push('Medium'); break;
		case 600: styleParts.push('Semi Bold'); break;
		case 700: styleParts.push('Bold'); break;
		case 800: styleParts.push('Extra Bold'); break;
		case 900: styleParts.push('Black'); break;
	}
	if (italic) styleParts.push('Italic');
	const styleName = (styleParts.length > 0) ? styleParts.join(' ') : 'Regular';

	const fontFace: FontFace = {
		fontName,
		fontId: fontName.toLowerCase().replace(/\s/g, '_'),
		familyName,
		familyId: familyName.toLowerCase().replace(/\s/g, '_'),
		styleName,
		italic,
		weight,
	};

	if (variation.trim() !== '') throw Error(`can not find variation "${variation}" in name "${fontName}"`);

	return fontFace;

	function extractVariation<T>(lookup: Record<string, T>, defaultValue: T): T {
		variation = variation.trim().replace(/\s{2,}/g, ' ');
		for (const [key, value] of Object.entries(lookup)) {
			if (!variation.includes(key)) continue;
			variation = variation.replace(key, ' ');
			return value;
		}
		return defaultValue;
	}
}
