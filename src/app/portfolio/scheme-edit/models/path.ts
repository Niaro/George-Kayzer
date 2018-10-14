import { Shape } from './shape';

export class Path extends Shape<string> {
	constructor() {
		super('path');
	}

	protected paint(scale: number) {
		requestAnimationFrame(() => {
			this.element.setAttributeNS(null, 'd', this.position);
		});
	}
}