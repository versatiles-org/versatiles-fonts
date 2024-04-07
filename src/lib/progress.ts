
export class Progress {
	private readonly msg: string;
	private value: number;
	private timeStart: number;
	private readonly maxValue: number;

	constructor(msg: string, maxValue: number) {
		this.msg = msg;
		this.maxValue = maxValue;
		this.value = 0;
		this.timeStart = Date.now();
		this.render();
	}

	update(value: number) {
		this.value = value;
		this.render();
	}

	increase(value: number) {
		this.value += value;
		this.render();
	}

	finish() {
		this.value = this.maxValue;
		this.render();
		process.stdout.write('\n');
	}

	private render() {
		const timeLeft = (Date.now() - this.timeStart) * (this.maxValue - this.value) / this.value / 1000;
		const eta = [
			Math.floor(timeLeft / 60),
			(100 + Math.floor(timeLeft) % 60).toFixed(0).slice(1),
		].join(':')
		const progress = (100 * this.value / this.maxValue).toFixed(1);
		process.stdout.write(`\u001b[2K\r${this.msg}: ${progress} % - ${eta}`);
	}
}
