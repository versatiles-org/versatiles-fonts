import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export interface FontSourcesWrapper {
	sources: string[];
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
	styleName: string;
}

export function getFontSources(inputDir: string): FontSourcesWrapper[] {
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
			const sources = font.sources
				.filter(filename => !filename.startsWith('#'))
				.map(filename => resolve(dirInFont, filename));

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
	if (!variation.startsWith(familyName)) throw Error();
	variation = variation.slice(familyName.length).toLowerCase();

	const weight: FontFace['weight'] = extractVariation({ thin: 100, 'extra light': 200, light: 300, regular: 400, medium: 500, 'semi bold': 600, 'semibold': 600, 'web bold': 700, 'extra bold': 800, bold: 700, black: 900 }, 400);
	const style: FontFace['style'] = extractVariation({ italic: 'italic' }, 'normal');
	const variant: FontFace['variant'] = extractVariation({ caption: 'caption', narrow: 'narrow', condensed: 'condensed' }, 'normal');

	const styleParts: string[] = [];
	switch (weight) {
		case 100: styleParts.push('Thin'); break;
		case 200: styleParts.push('ExtraLight'); break;
		case 300: styleParts.push('Light'); break;
		case 500: styleParts.push('Medium'); break;
		case 600: styleParts.push('SemiBold'); break;
		case 700: styleParts.push('Bold'); break;
		case 800: styleParts.push('ExtraBold'); break;
		case 900: styleParts.push('Black'); break;
	}
	switch (style) {
		case 'italic': styleParts.push('Italic'); break;
	}
	switch (variant) {
		case 'caption': styleParts.push('Caption'); break;
		case 'narrow': styleParts.push('Narrow'); break;
		case 'condensed': styleParts.push('Condensed'); break;
	}
	const styleName = (styleParts.length > 0) ? styleParts.join(' ') : 'Regular';

	const fontFace: FontFace = {
		fontName,
		fontId: fontName.toLowerCase().replace(/\s/g, '_'),
		familyName,
		familyId: familyName.toLowerCase().replace(/\s/g, '_'),
		weight,
		style,
		variant,
		styleName,
	}

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
