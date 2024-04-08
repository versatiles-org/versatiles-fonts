
declare module 'fontnik' {
	export function composite(
		buffers: Buffer[],
		callback: (
			err: string,
			res: Buffer
		) => void
	);
	export function load(
		bufferIn: Buffer,
		callback: (
			err: string,
			res: {
				family_name: string;
				style_name: string;
				points: number[];
			}[]
		) => void);
	export function range(
		options: { font: Buffer; start: number; end: number },
		callback: (
			err: string,
			buffer: Buffer
		) => void
	);
}
