
export class Progress {
	private readonly msg: string;

	private value: number;

	private readonly timeStart: number;

	private readonly maxValue: number;

	private readonly isTTY: boolean;

	private readonly stepCount: number;

	private lastStep: number;

	public constructor(msg: string, maxValue: number) {
		this.msg = msg;
		this.maxValue = maxValue;
		this.value = 0;
		this.timeStart = Date.now();
		this.isTTY = process.stderr.isTTY;
		this.stepCount = this.isTTY ? 100 : 5;
		this.lastStep = -100;
		this.render();
	}

	public update(value: number): void {
		this.value = value;
		this.render();
	}

	public increase(value: number = 1): void {
		this.value += value;
		this.render();
	}

	public finish(): void {
		this.value = this.maxValue;
		this.render();
		process.stderr.write('\n');
	}

	private render(): void {
		const step = Math.floor(this.stepCount * this.value / this.maxValue);
		if (step <= this.lastStep) return;
		this.lastStep = step;

		const progress = (100 * this.value / this.maxValue).toFixed(0);
		process.stderr.write([
			this.isTTY ? '\u001b[2K\r' : '',
			this.msg, ': ',
			progress, '%',
			this.getETA(),
			this.isTTY ? '' : '\n',
		].join(''));
	}

	private getETA(): string {
		if (this.value < this.maxValue / 100) return '';
		const timeLeft = (Date.now() - this.timeStart) * (this.maxValue - this.value) / this.value / 1000;
		return ` - ${Math.floor(timeLeft / 60)}:${(100 + Math.floor(timeLeft) % 60).toFixed(0).slice(1)}`;
	}
}
