import { PlanPosition } from 'rent';
import { Shape } from './shape';

export class Line extends Shape<[PlanPosition, PlanPosition]> {
	constructor() {
		super('line');
	}

	protected paint(scale: number) {
		let p1 = this.position[0].applyScale(scale);
		let p2 = this.position[1].applyScale(scale);
		requestAnimationFrame(() => {
			this.element.setAttributeNS(null, 'x1', p1.x.toString());
			this.element.setAttributeNS(null, 'y1', p1.y.toString());

			this.element.setAttributeNS(null, 'x2', p2.x.toString());
			this.element.setAttributeNS(null, 'y2', p2.y.toString());
		});
	}
}