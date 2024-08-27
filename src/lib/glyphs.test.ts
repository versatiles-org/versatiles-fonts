/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/naming-convention */
import { jest } from '@jest/globals';

jest.unstable_mockModule('./progress.ts', () => ({
	Progress: function () {
		return {
			increase: () => {
				return;
			},
			finish: () => {
				return;
			},
		};
	},
}));
const { buildAllGlyphs } = await import('./glyphs.ts');
const { getFontSources } = await import('./fonts.ts');

describe('buildAllGlyphs', () => {
	it('should build all glyphs from font sources', async () => {
		process.chdir(new URL('../../', import.meta.url).pathname);

		const fontSources = getFontSources('fonts')
			.filter(f => f.fontFace.fontId === 'fira_sans_bold');

		const result = await buildAllGlyphs(fontSources);

		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(1);
		expect(result[0].fontFace).toStrictEqual({
			fontName: 'Fira Sans - Bold',
			fontId: 'fira_sans_bold',
			familyName: 'Fira Sans',
			familyId: 'fira_sans',
			styleName: 'Bold',
			italic: false,
			weight: 700,
		});
		expect(result[0].glyphs.length).toBe(256);
		expect(result[0].glyphSize).toBeGreaterThan(800000);
		for (const glyph of result[0].glyphs) {
			expect(glyph.filename).toMatch(/^fira_sans_bold\/\d+-\d+\.pbf$/);
			expect(glyph.buffer).toBeInstanceOf(Buffer);
			expect(typeof glyph.start).toBe('number');
		}
	});
});
