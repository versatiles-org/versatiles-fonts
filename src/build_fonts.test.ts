#!/usr/bin/env node
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/naming-convention */

import { jest } from '@jest/globals';
import type { FontFace, FontSourcesWrapper } from './lib/fonts.ts';
import type { FontGlyphsWrapper } from './lib/glyphs.ts';
import type { TarPacker } from './lib/tar.ts';

jest.spyOn(console, 'log').mockReturnValue();

jest.unstable_mockModule('node:fs', () => ({
	existsSync: jest.fn().mockReturnValue(true),
	rmSync: jest.fn(),
	mkdirSync: jest.fn(),
}));

const fontFace: FontFace = {
	fontName: 'Font42 Black',
	fontId: 'font_42_black',
	familyName: 'Font42',
	familyId: 'font_42',
	weight: 900,
	italic: false,
	styleName: 'black',
};

const fontSource: FontSourcesWrapper = {
	sources: [Buffer.from('content of font.ttf')],
	fontFace,
};

jest.unstable_mockModule('./lib/fonts.ts', () => ({
	getFontSources: jest.fn(() => [fontSource]),
}));

const fontGlyphs: FontGlyphsWrapper = {
	glyphs: [
		{ buffer: Buffer.from('glyphs 0-255'), filename: 'font_42_black/0-255.pbf', start: 0 },
		{ buffer: Buffer.from('glyphs 256-511'), filename: 'font_42_black/256-511.pbf', start: 256 },
	],
	glyphSize: 26,
	fontFace,
};

jest.unstable_mockModule('./lib/glyphs.ts', () => ({
	buildAllGlyphs: jest.fn(() => [fontGlyphs]),
}));

const mockedTarPacker = {
	add: jest.fn(() => {
		return;
	}),
	run: jest.fn(async () => new Promise(r => setTimeout(r, 10))),
} as unknown as TarPacker;
jest.unstable_mockModule('./lib/tar.ts', () => ({
	TarPacker: jest.fn(() => mockedTarPacker),
}));


const { existsSync, rmSync, mkdirSync } = await import('node:fs');
const { getFontSources } = await import('./lib/fonts.ts');
const { buildAllGlyphs } = await import('./lib/glyphs.ts');

describe('build fonts', () => {
	test('simple run', async () => {
		await import('./build_fonts.ts');

		expect(jest.mocked(existsSync).mock.calls)
			.toStrictEqual([['dist']]);

		expect(jest.mocked(rmSync).mock.calls)
			.toStrictEqual([['dist', { force: true, recursive: true }]]);

		expect(jest.mocked(mkdirSync).mock.calls)
			.toStrictEqual([['dist', { recursive: true }]]);

		expect(jest.mocked(getFontSources).mock.calls)
			.toStrictEqual([['fonts']]);

		expect(jest.mocked(buildAllGlyphs).mock.calls)
			.toStrictEqual([[[fontSource]]]);

		expect(jest.mocked(mockedTarPacker.add).mock.calls)
			.toStrictEqual([
				['dist/fonts.tar.gz', [fontGlyphs]],
				['dist/font_42.tar.gz', [fontGlyphs]],
			]);

		expect(jest.mocked(mockedTarPacker.run).mock.calls)
			.toStrictEqual([[]]);

	});
});
