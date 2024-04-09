import { cpus } from 'node:os';

const maxConcurrency = cpus().length;

export async function runParallel<T>(items: T[], cb: ((item: T) => Promise<void>)): Promise<void> {
	let count = 0;
	let listener: (() => void) | null = null;

	for (const item of items) {
		if (count >= maxConcurrency) await waitTillLowerThan(maxConcurrency);
		count++;
		const promise = cb(item);
		// eslint-disable-next-line @typescript-eslint/no-loop-func
		void promise.then(() => {
			count--;
			if (listener) listener();
		});
	}

	await waitTillLowerThan(1);

	async function waitTillLowerThan(limit: number): Promise<void> {
		if (count < limit) return;

		return new Promise(resolve => {
			if (listener) throw Error();
			listener = (): void => {
				if (count < limit) {
					listener = null;
					resolve();
				}
			};
		});
	}
}
