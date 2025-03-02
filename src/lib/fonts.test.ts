 

import { jest } from '@jest/globals';

const mockFiles: Record<string, string[]> = {
	'/fonts': ['Family 1', 'Family 2', '_ignoredDirectory'],
	'/fonts/Family 1': ['index.json', 'Family 1 bold.otf', 'Family 1 - Italic.ttf', 'Family_1_regular.otf'],
	'/fonts/Family 2': ['Family 2 bold.ttf', 'Family_2_italic.otf'],
};

jest.unstable_mockModule('node:fs', () => ({
	existsSync: jest.fn((path: string) => Object.keys(mockFiles).includes(path)),
	readdirSync: jest.fn((path: string) => mockFiles[path]),
	lstatSync: jest.fn((path: string) => ({
		isDirectory: (): boolean => Object.keys(mockFiles).includes(path),
	})),
	readFileSync: jest.fn((path: string) => {
		if (path === '/fonts/family1/index.json') {
			return JSON.stringify([{ name: 'Family 1 - Regular', sources: ['font1.otf', 'font2.ttf'] }]);
		}
		return `content of ${path}`;
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
					fontName: 'Family 1 - Bold',
					italic: false,
					styleName: 'Bold',
					weight: 700,
				},
				'sources': ['content of /fonts/Family 1/Family 1 bold.otf'],
			},
			{
				fontFace: {
					familyId: 'family_1',
					familyName: 'Family 1',
					fontId: 'family_1_italic',
					fontName: 'Family 1 - Italic',
					italic: true,
					styleName: 'Italic',
					weight: 400,
				},
				'sources': ['content of /fonts/Family 1/Family 1 - Italic.ttf'],
			},
			{
				fontFace: {
					familyId: 'family_1',
					familyName: 'Family 1',
					fontId: 'family_1_regular',
					fontName: 'Family 1 - Regular',
					italic: false,
					styleName: 'Regular',
					weight: 400,
				},
				'sources': ['content of /fonts/Family 1/Family_1_regular.otf'],
			},
			{
				fontFace: {
					familyId: 'family_2',
					familyName: 'Family 2',
					fontId: 'family_2_bold',
					fontName: 'Family 2 - Bold',
					italic: false,
					styleName: 'Bold',
					weight: 700,
				},
				'sources': ['content of /fonts/Family 2/Family 2 bold.ttf'],
			},
			{
				fontFace: {
					familyId: 'family_2',
					familyName: 'Family 2',
					fontId: 'family_2_italic',
					fontName: 'Family 2 - Italic',
					italic: true,
					styleName: 'Italic',
					weight: 400,
				},
				'sources': ['content of /fonts/Family 2/Family_2_italic.otf'],
			},
		]);
	});
});
