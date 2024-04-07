
export class Progress {
	private readonly msg:string;
	private value:number;
	private readonly maxValue:number;
	
	constructor (msg:string, maxValue:number) {
		this.msg = msg;
		this.maxValue = maxValue;
		this.value = 0;
		this.render();
	}

	update(value:number) {
		this.value = value;
		this.render();
	}

	increase(value:number) {
		this.value += value;
		this.render();
	}

	finish() {
		this.value = this.maxValue;
		this.render();
		process.stdout.write('\n');
	}

	private render() {
		const progress = (100 * this.value / this.maxValue).toFixed(1) + '%';
		process.stdout.write(`\u001b[2K\r${this.msg}: ${progress}`);
	}
}
