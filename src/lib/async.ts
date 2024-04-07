import { cpus } from 'node:os';

const maxConcurrency = cpus().length;

export async function runParallel(asyncList: ((() => Promise<void>) | Promise<void>)[]): Promise<void> {
	let count = 0;
	let listener: null | (() => void) = null;

	for (const func of asyncList) {
		if (count >= maxConcurrency) await waitTillLowerThan(maxConcurrency);
		count++;
		const promise = (typeof func === 'function') ? func() : func;
		promise.then(() => {
			count--;
			if (listener) listener();
		})
	}

	await waitTillLowerThan(1);

	async function waitTillLowerThan(limit: number): Promise<void> {
		if (count < limit) return;

		return new Promise(resolve => {
			if (listener) throw Error();
			listener = () => {
				if (count < limit) {
					listener = null;
					resolve();
				}
			}
		})
	}
}