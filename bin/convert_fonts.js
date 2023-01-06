#!/usr/bin/env node
'use strict'

const fs = require('fs');
const path = require('path');
const fontnik = require('fontnik');
const glyphCompose = require('@mapbox/glyph-pbf-composite');

const DEBUG = false;

const inputDir = path.resolve(__dirname, '../font-sources');
const outputDir = path.resolve(__dirname, '../dist');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

start()
async function start() {
	const todos = getTodos();

	// would be much faster in parallel, but this is better for logging
	let sizeSumTotal = 0;
	for (let { dir, fonts } of todos) {
		console.log('Directory [%s]:', path.relative(inputDir, dir));
		sizeSumTotal += await processFonts(dir, fonts);
	}
	console.log('Total size %s B', sizeSumTotal);

	function getTodos() {
		const todos = [];

		fs.readdirSync(inputDir).forEach(dir => {
			dir = path.resolve(inputDir, dir);
			if (fs.lstatSync(dir).isDirectory()) {
				let fonts = false;
				try {
					fonts = require(path.resolve(dir, 'fonts.json'));
					fonts.forEach(font => {
						// skip sources starting with '//' -- these are "commented"
						font.sources = font.sources.filter(f => !f.includes('//'));
					});
				} catch (e) {
					if (e.code !== 'MODULE_NOT_FOUND') console.error(e);

					fonts = [];
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
				if (fonts && (fonts.length > 0)) todos.push({ dir, fonts });
			}
		});

		return todos;
	}
}


async function processFonts(dir, fonts) {

	let sizeSum = 0;
	// would be much faster in parallel, but this is better for logging
	for (let font of fonts) {
		console.log('   Font [%s]:', font.name);
		sizeSum += await makeGlyphs(font);
	}
	return sizeSum;

	async function makeGlyphs(config) {
		const sourceFonts = {};
		const folderName = outputDir + '/' + config.name;

		config.sources.forEach(sourceName => {
			try {
				sourceFonts[sourceName] ??= fs.readFileSync(dir + '/' + sourceName);
			} catch (e) { }
		});

		if (!fs.existsSync(folderName)) fs.mkdirSync(folderName);

		let ranges = [];
		for (let i = 0; i < 65536; (i = i + 256)) {
			ranges.push([i, Math.min(i + 255, 65535)]);
		}

		let sizeSum = 0;
		const histogram = new Array(256);
		if (DEBUG) {
			for (let range of ranges) await processRange(range);
		} else {
			await Promise.all(ranges.map(range => processRange(range)));
		}

		console.log(' Size histo [kB]: %s', histogram.map(v => v > 512 ? Math.round(v / 1024) : '').join('|'));
		console.log(' Total size %s B', sizeSum);

		return sizeSum;

		async function processRange(range) {
			const [start, end] = range;

			let results = await Promise.all(config.sources.map(sourceName => {
				let source = sourceFonts[sourceName];
				if (!source) {
					console.log('[%s] Source "%s" not found', config.name, sourceName);
					return;
				}

				return new Promise((resolve, reject) => {
					fontnik.range(
						{ font: source, start, end },
						(err, data) => {
							if (err) reject(); else resolve(data);
						}
					);
				});
			}))

			results = results.filter(r => !!r);

			let combined = glyphCompose.combine(results);
			let size = combined.length;
			sizeSum += size;
			histogram[start / 256] = size;
			if (DEBUG) console.log('[%s] Range %s-%s size %s B', config.name, start, end, size);

			fs.writeFileSync(folderName + '/' + start + '-' + end + '.pbf', combined);
		}
	}
};
