#!/usr/bin/env node
'use strict'

const fs = require('fs');
const path = require('path');
const fontnik = require('fontnik');
const glyphCompose = require('@mapbox/glyph-pbf-composite');
const { resolve } = require('path');
require('work-faster');

const inputDir = path.resolve(__dirname, '../font-sources');
const outputDir = path.resolve(__dirname, '../dist/fonts/');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

start()
async function start() {
	const fonts = getFonts();

	let sizePos = 0;
	let sizeSum = fonts.reduce((s, f) => s + f.sizeIn, 0);

	await fonts.forEachAsync(async font => {
		let progress = (100 * sizePos / sizeSum).toFixed(1) + '%';
		progress = ' '.repeat(8 - progress.length) + progress;
		process.stdout.write('\u001b[2K\r' + progress + ' - ' + font.name)

		await makeGlyphs(font);
		sizePos += font.sizeIn;
	})
	process.stdout.write('\u001b[2K\rFinished\n')

	let fontnames = fonts.map(f => f.name);
	fs.writeFileSync(path.resolve(outputDir, 'fonts.json'), JSON.stringify(fontnames, null, '\t'));
}

function getFonts() {
	const todos = [];

	fs.readdirSync(inputDir).forEach(dir => {
		if (dir.startsWith('_')) return;

		dir = path.resolve(inputDir, dir);
		if (fs.lstatSync(dir).isDirectory()) {
			let fonts = [];
			try {
				fonts = require(path.resolve(dir, 'fonts.json'));
			} catch (e) {
				if (e.code !== 'MODULE_NOT_FOUND') console.error(e);

				fs.readdirSync(dir).forEach(file => {
					if (path.extname(file) === '.ttf' || path.extname(file) === '.otf') {
						// compatible font name generation with genfontgl
						let name = path.basename(file);
						name = name.replace(/\..*?$/, '');
						name = name.replace(/\-/g, '');
						name = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
						name = name.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
						name = name.replace(/\s+/, ' ').trim();
						fonts.push({ name, sources: [path.basename(file)] });
					}
				});
			}

			// font.name should be lowercase+underscore
			fonts.forEach(font => {
				font.sources = font.sources.filter(s => !s.startsWith('//'));
				font.name = font.name.toLowerCase().replace(/\s/g, '_');
				font.sizeIn = font.sources.reduce(
					(sum, source) => sum + fs.statSync(resolve(dir, source)).size, 0
				);
				font.dirInFont = dir;
				font.dirOutFont = resolve(outputDir, font.name)

				todos.push(font)
			});
		}
	});

	return todos;
}

async function makeGlyphs(font) {
	if (!fs.existsSync(font.dirOutFont)) fs.mkdirSync(font.dirOutFont);

	const sourceFonts = {};
	font.sources.forEach(sourceName => {
		sourceFonts[sourceName] = fs.readFileSync(resolve(font.dirInFont, sourceName));
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

		fs.writeFileSync(resolve(font.dirOutFont, `${start}-${end}.pbf`), combined);
	}

	font.sizeOut = sizeSum;
}
