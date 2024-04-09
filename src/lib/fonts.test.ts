/* eslint-disable @typescript-eslint/naming-convention */

import { jest } from '@jest/globals';

const mockFiles: Record<string, string[]> = {
	'/fonts': ['Family 1', 'Family 2', '_ignoredDirectory'],
	'/fonts/Family 1': ['fonts.json', 'Family1_bold.otf', 'Family1_italic.ttf', 'Family1.otf'],
	'/fonts/Family 2': ['Family2_bold.ttf', 'Family2_italic.otf'],
};

jest.unstable_mockModule('node:fs', () => ({
	existsSync: jest.fn((path: string) => Object.keys(mockFiles).includes(path)),
	readdirSync: jest.fn((path: string) => mockFiles[path]),
	lstatSync: jest.fn((path: string) => ({
		isDirectory: (): boolean => Object.keys(mockFiles).includes(path),
	})),
	readFileSync: jest.fn((path: string) => {
		if (path === '/fonts/family1/fonts.json') {
			return JSON.stringify([{ name: 'fontFamily1', sources: ['font1.ttf', 'font2.otf'] }]);
		}
		throw Error();
	}),
}));

const { getFontSources } = await import('./fonts.ts');

describe('getFontSources', () => {
	it('should process font directories and ignore others', () => {
		const sources = getFontSources('/fonts');
		
		expect(sources).toStrictEqual([
			{
				fontFace: {
					familyId: 'family_1',
					familyName: 'Family 1',
					fontId: 'family_1_bold',
					fontName: 'Family 1 bold',
					italic: false,
					styleName: 'Bold',
					weight: 700,
				},
				'sources': ['/fonts/Family 1/Family1_bold.otf'],
			},
			{
				fontFace: {
					familyId: 'family_1',
					familyName: 'Family 1',
					fontId: 'family_1_italic',
					fontName: 'Family 1 italic',
					italic: true,
					styleName: 'Italic',
					weight: 400,
				},
				'sources': ['/fonts/Family 1/Family1_italic.ttf'],
			},
			{
				fontFace: {
					familyId: 'family_1',
					familyName: 'Family 1',
					fontId: 'family_1',
					fontName: 'Family 1',
					italic: false,
					styleName: 'Regular',
					weight: 400,
				},
				'sources': ['/fonts/Family 1/Family1.otf'],
			},
			{
				fontFace: {
					familyId: 'family_2',
					familyName: 'Family 2',
					fontId: 'family_2_bold',
					fontName: 'Family 2 bold',
					italic: false,
					styleName: 'Bold',
					weight: 700,
				},
				'sources': ['/fonts/Family 2/Family2_bold.ttf'],
			},
			{
				fontFace: {
					familyId: 'family_2',
					familyName: 'Family 2',
					fontId: 'family_2_italic',
					fontName: 'Family 2 italic',
					italic: true,
					styleName: 'Italic',
					weight: 400,
				},
				'sources': ['/fonts/Family 2/Family2_italic.otf'],
			},
		]);
	});
});
