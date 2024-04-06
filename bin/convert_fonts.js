#!/usr/bin/env node
'use strict'

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import fontnik from 'fontnik';
import glyphCompose from '@mapbox/glyph-pbf-composite';
import { execSync } from 'node:child_process';

import 'work-faster';

const inputDir = new URL('../font-sources', import.meta.url).pathname;
const outputDir = new URL('../dist/fonts/', import.meta.url).pathname;

if (existsSync(outputDir)) rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

console.log('scan for fonts');
const fonts = getFonts();

let sizePos = 0;
let sizeSum = fonts.reduce((s, f) => s + f.sizeIn, 0);

console.log('convert fonts');
await fonts.forEachAsync(async font => {
	let progress = (100 * sizePos / sizeSum).toFixed(1) + '%';
	progress = ' '.repeat(8 - progress.length) + progress;
	process.stdout.write('\u001b[2K\r' + progress + ' - ' + font.name)

	await makeGlyphs(font);
	sizePos += font.sizeIn;
})
process.stdout.write('\u001b[2K\r')

let fontnames = fonts.map(f => f.name);
writeFileSync(resolve(outputDir, 'fonts.json'), JSON.stringify(fontnames, null, '\t'));

console.log('tar fonts');

tar('fonts');

let fontFamilies = {};
fonts.forEach(f => (fontFamilies[f.family] ??= []).push(f.name));
for (let [family, names] of Object.entries(fontFamilies)) tar(family, names);

console.log('Finished')

function tar(name, folders) {
	console.log(`   ${name}.tar`)
	let paths = folders ? folders.map(f => './' + f) : ['.'];
	let cmd = `find ${paths.join(' ')} -name "*.pbf" -print0 | tar -cf ../${name}.tar --null --files-from -`;
	execSync(cmd, { cwd: outputDir })
}

function getFonts() {
	const todos = [];

	readdirSync(inputDir).forEach(dirName => {
		if (dirName.startsWith('_')) return;

		let dirInFont = resolve(inputDir, dirName);
		if (!lstatSync(dirInFont).isDirectory()) return;
			let fonts = [];

			let fontFile = resolve(dirInFont, 'fonts.json');
			if (existsSync(fontFile)) {
				fonts = JSON.parse(readFileSync(fontFile));
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
				font.sources = font.sources.filter(s => !s.startsWith('//'));
			font.slug = font.name.toLowerCase().replace(/\s/g, '_');
				font.sizeIn = font.sources.reduce(
					(sum, source) => sum + statSync(resolve(dirInFont, source)).size, 0
				);
				font.dirInFont = dirInFont;
			font.family = dirName;
			font.dirOutFont = resolve(outputDir, font.slug);

			let variation = font.name;
			if (!variation.startsWith(font.family)) throw Error();
			variation = variation.slice(font.family.length).toLowerCase();
			font.weight = extractVariation({
				thin: 100,
				'extra light': 200,
				light: 300,
				regular: 400,
				medium: 500,
				'semi bold': 600,
				'semibold': 600,
				'web bold': 700,
				'extra bold': 800,
				bold: 700,
				black: 900
			}, 400);
			font.style = extractVariation({ italic: 'italic' });
			font.variant = extractVariation({ caption: 'caption', narrow: 'narrow', condensed: 'condensed' });
			if (variation.trim() !== '') throw Error(`can not find variation "${variation}" in name "${font.name}"`);

			todos.push(font);

			function extractVariation(lookup, defaultValue = 'normal') {
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

async function makeGlyphs(font) {
	if (!existsSync(font.dirOutFont)) mkdirSync(font.dirOutFont);

	const sourceFonts = {};
	font.sources.forEach(sourceName => {
		sourceFonts[sourceName] = readFileSync(resolve(font.dirInFont, sourceName));
	});

	let sizeSum = 0;
	for (let start = 0; start < 65536; start += 256) {
		const end = start + 255;

		let results = await Promise.all(font.sources.map(sourceName => {
			let source = sourceFonts[sourceName];
			if (!source) throw Error(`[${font.name}] Source "%{sourceName}" not found`);

			return new Promise((resolve, reject) => {
				fontnik.range(
					{ font: source, start, end },
					(err, data) => {
						if (err) reject(); else resolve(data);
					}
				);
			});
		}))

		results = results.filter(r => r);

		let combined = glyphCompose.combine(results);
		sizeSum += combined.length;

		writeFileSync(resolve(font.dirOutFont, `${start}-${end}.pbf`), combined);
	}

	font.sizeOut = sizeSum;
}
