import { PlanPosition } from 'rent';
import { Shape } from './shape';

export class Dot extends Shape<PlanPosition> {
	constructor(radius = 3) {
		super('circle', { r: radius, class: 'dot' });
	}

	protected paint(scale: number) {
		let { x, y } = this.position.applyScale(scale);
		requestAnimationFrame(() => {
			this.element.setAttributeNS(null, 'cx', x.toString());
			this.element.setAttributeNS(null, 'cy', y.toString());
		});
	}
}