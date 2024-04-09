
import { Progress } from './progress.ts';
import { jest } from '@jest/globals';

describe('Progress', () => {
	const mockWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => {
		return false;
	});
	const mockDateNow = jest.spyOn(Date, 'now');

	beforeEach(() => {
		mockWrite.mockClear();
		mockDateNow.mockClear();
	});

	afterAll(() => {
		mockWrite.mockRestore();
		mockDateNow.mockRestore();
	});

	it('initializes and renders progress', () => {
		mockDateNow.mockReturnValue(new Date('2020-01-01T00:00:00Z').getTime());
		new Progress('Test Progress', 100);

		expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('Test Progress: 0%'));
	});

	it('updates and renders new progress', () => {
		const progress = new Progress('Update Test', 200);
		progress.update(100);

		expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('Update Test: 50%'));
	});

	it('increases and renders increased progress', () => {
		const progress = new Progress('Increase Test', 300);
		progress.increase(150);

		expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('Increase Test: 50%'));
	});

	it('finishes progress and writes newline', () => {
		const progress = new Progress('Finish Test', 100);
		progress.finish();

		expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('Finish Test: 100%'));
		expect(mockWrite).toHaveBeenCalledWith('\n');
	});

	it('calculates and displays ETA after progress starts', () => {
		mockDateNow
			.mockReturnValueOnce(new Date('2020-01-01T00:00:00Z').getTime())
			.mockReturnValue(new Date('2020-01-01T00:01:00Z').getTime());

		const progress = new Progress('ETA Test', 100);
		progress.update(50);

		expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining('ETA Test: 50% - 1:00'));
	});
});
