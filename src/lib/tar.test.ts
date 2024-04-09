// tar.test.ts
import tar from 'tar-stream';
import { jest } from '@jest/globals';
import type { FontGlyphsWrapper } from './glyphs.ts';
import { Writable } from 'node:stream';


jest.unstable_mockModule('node:fs', () => ({
	createWriteStream: jest.fn(() => new Writable({
		write: (chunk, encoding, callback): void => {
			callback();
			return;
		},
	})),
}));

const { createWriteStream } = await import('node:fs');
// eslint-disable-next-line @typescript-eslint/naming-convention
const { TarPacker } = await import('./tar.ts');

describe('TarPacker', () => {
	const mockGlyphsWrapper: FontGlyphsWrapper[] = [
		{
			fontFace: {
				fontId: 'family1-italic',
				fontName: 'Family1 Italic',
				familyName: 'Family1',
				familyId: 'family1',
				styleName: 'Regular',
				weight: 400,
				italic: true,
			},
			glyphs: [
				{ filename: 'family1-italic/0-255.pbf', buffer: Buffer.from('glyph1'), start: 0 },
				{ filename: 'family1-italic/256-511.pbf', buffer: Buffer.from('glyph2'), start: 256 },
			],
			glyphSize: 10,
		},
	];

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('adds files to the tar packer and runs packing', async () => {
		jest.spyOn(tar, 'pack');
		const tarPacker = new TarPacker();
		tarPacker.add('test.tar.gz', mockGlyphsWrapper);

		await tarPacker.run();

		expect(tar.pack).toHaveBeenCalled();
		expect(createWriteStream).toHaveBeenCalledWith('test.tar.gz');
	});
});
