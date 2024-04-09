
import { jest } from '@jest/globals';

jest.unstable_mockModule('node:os', () => ({
	cpus: jest.fn(() => [0, 1, 2, 3, 4]),
}));

const { runParallel } = await import('./async.ts');

describe('runParallel', () => {
	it('should process items in parallel up to the max concurrency limit', async () => {
		const items = Array(10).fill(null); // Create an array of 10 items
		const processCount: number[] = [];
		const delay = async (): Promise<void> => new Promise(resolve => setTimeout(resolve, 50));

		let count = 0;
		await runParallel(items, async () => {
			count++;
			processCount.push(count);
			await delay(); // Simulate async work with a delay
			count--;
			processCount.push(count);
		});

		// Assert that all items have been processed
		expect(processCount).toStrictEqual([
			1, 2, 3, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 3, 2, 1, 0,
		]);
	});
});
