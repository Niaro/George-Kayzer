import { PlanPosition } from 'rent';
import { Shape } from './shape';

export class Guide extends Shape<PlanPosition> {

	constructor(public type: 'horizontal' | 'vertical') {
		super('line', { class: `guide ${type}` });
	}

	protected paint(scale: number) {
		let { viewportElement } = this.element ;
		if (!viewportElement) return;

		let viewport = viewportElement.getBoundingClientRect();
		let viewbox = (viewportElement as any as SVGFitToViewBox).viewBox.baseVal;
		let { x, y } = this.position.applyScale(scale);

		requestAnimationFrame(() => {
			switch (this.type) {
				case 'horizontal':
					this.element.setAttributeNS(null, 'x1', ((viewbox.width - viewport.width) / 2).toString());
					this.element.setAttributeNS(null, 'x2', Math.round(viewport.width).toString());
					this.element.setAttributeNS(null, 'y1', y.toString());
					this.element.setAttributeNS(null, 'y2', y.toString());
					break;
				case 'vertical':
					this.element.setAttributeNS(null, 'y1', ((viewbox.height - viewport.height) / 2).toString());
					this.element.setAttributeNS(null, 'y2', Math.round(viewport.height).toString());
					this.element.setAttributeNS(null, 'x1', x.toString());
					this.element.setAttributeNS(null, 'x2', x.toString());
					break;
			}
		});
	}
}