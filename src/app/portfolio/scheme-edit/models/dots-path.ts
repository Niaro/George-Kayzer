import { Subject } from 'rxjs';
import { Shape } from './shape';
import { Dot } from './dot';
import { Path } from './path';
import { PlanPosition } from 'rent';

export class DotsPath extends Shape<PlanPosition> {
	path = new Path().appendTo(this.element);
	closed: boolean;
	readonly dotsChange$ = new Subject<Dot[]>();
	readonly dots: Dot[] = [];

	get empty() { return _.isEmpty(this.dots); }
	get firstDot() { return _.first(this.dots); }
	get lastDot() { return _.last(this.dots); }

	constructor(dots?: Dot[]) {
		super('g', { class: 'dots-path' });
		dots && this.addDot(...dots);
	}

	protected paint(scale: number) {
		let path = '';
		if (this.dots.length) {
			this.dots.forEach((dot, i) => {
				let { x, y } = dot.position.applyScale(scale);
				path += i == 0 ? 'M' : ' L';
				path += `${x} ${y}`;
			});

			if (this.firstDot !== this.lastDot && this.firstDot.position.equal(this.lastDot.position)) {
				path += ' Z';
				this.closed = true;
				this.addClass('closed');
			} else {
				if (this.position) {
					let { x, y } = this.position.applyScale(scale);
					path += ` L${x} ${y}`; // add the line from the last set dot to the pointer
				}
				this.closed = false;
				this.removeClass('closed');
			}
		}
		this.path.drawAt(path, 1);
	}

	addDot(...dots: Dot[]) {
		if (_.isEmpty(dots)) return this;
		this.dots.push(...dots);

		this.dots.forEach(dot => dot.removeClass('first', 'last').appendTo(this.element));
		this.firstDot.addClass('first').remove().appendTo(this.element); // always be the last child in the svg document
		this.lastDot.addClass('last');

		this.dotsChange$.next(this.dots);
		return this;
	}

	removeDot(dot: Dot) {
		if (!this.dots.includes(dot)) return this;

		_.pull(this.dots, dot);
		dot.remove();
		this.closed = false;

		this.dotsChange$.next(this.dots);
		return this;
	}

	findDot(positionOrPredicate: PlanPosition | ((dot: Dot) => boolean)) {
		let findPredicate = positionOrPredicate instanceof PlanPosition ? (dot: Dot) => dot.position.equal(<PlanPosition>positionOrPredicate) : positionOrPredicate;
		return this.dots.find(findPredicate);
	}

	clear() {
		_.remove(this.dots);
		this.dotsChange$.next(this.dots);
		return this;
	}

	updateDots() {
		this.dotsChange$.next(this.dots);
		return this;
	}
}