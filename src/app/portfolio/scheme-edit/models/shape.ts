import { $ } from 'rent';

export abstract class Shape<T> {
	static createSvgElement(tagName, attrs: { [attrName: string]: any } = {}): SVGElement {
		let element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
		attrs['class'] = attrs['class'] && attrs['class'].split(' ').concat('shape').join(' ') || 'shape';
		_.forOwn(attrs, (value, key) => element.setAttributeNS(null, key, value));
		return element;
	}

	readonly element: SVGElement;
	container: SVGElement;
	position: T;

	constructor(svgName, attrs?: { [attrName: string]: any }) {
		if (_.isEmpty(svgName) || !_.isString(svgName)) throw 'For creating a specific shape you should to specify a corresponded svg tag name';

		this.element = Shape.createSvgElement(svgName, attrs);
	}

	drawAt(position: T, scale: number) {
		this.position = position;
		this.paint(scale);
		return this;
	}

	redraw(scale: number) {
		this.paint(scale);
		return this;
	}

	appendTo(container: SVGElement) {
		this.isDifferentContainer(container) && container.appendChild(this.element);
		return this;
	}

	insertBefore(container: SVGElement, refNode: Node) {
		this.isDifferentContainer(container) && container.insertBefore(this.element, refNode);
		return this;
	}

	remove() {
		if (!this.container) return;
		this.container.removeChild(this.element);
		this.container = undefined;
		return this;
	}

	addClass(...classes: string[]) {
		requestAnimationFrame(() => $.addClass(this.element, ...classes));
		return this;
	}

	removeClass(...classes: string[]) {
		requestAnimationFrame(() => $.removeClass(this.element, ...classes));
		return this;
	}

	protected abstract paint(scale: number);

	protected isDifferentContainer(container: SVGElement) {
		if (this.container === container)
			return false;
		else if (this.container)
			this.remove();

		this.container = container;
		return true;
	}
}