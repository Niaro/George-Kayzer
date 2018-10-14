import { PlanPosition } from 'rent';
import { Shape } from './shape';
import { Guide } from './guide';

export class Pointer extends Shape<PlanPosition> {
	verticalGuide = new Guide('vertical').appendTo(this.element);
	horizontalGuide = new Guide('horizontal').appendTo(this.element);

	constructor() {
		super('g', { class: 'pointer' });
	}

	protected paint(scale: number) {
		this.verticalGuide.drawAt(this.position, scale);
		this.horizontalGuide.drawAt(this.position, scale);
	}
}