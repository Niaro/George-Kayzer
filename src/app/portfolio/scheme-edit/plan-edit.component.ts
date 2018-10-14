import {
	Component, OnInit, OnChanges, SimpleChanges, Input, ViewChild, AfterViewInit, ElementRef,
	ChangeDetectorRef, OnDestroy, Renderer2
} from '@angular/core';
import { Observable, BehaviorSubject, Subscription } from 'rxjs';
import * as octicons from 'octicons';

import { Command, ToolbarComponent } from './toolbar.component';
import { Pointer, Dot, DotsPath, Line } from './models';
import { ActionType, Action, ActionManager } from './actions';
import { Plan, PlanRoom, AsyncVoidSubject, PlanComponent, PlanPosition, RtScheduler, $, FADE_IN, NgZoneBehaviorSubject } from 'rent';
import { RoomsApiService } from 'shared';

@Component({
	selector: 'rt-plan-edit',
	templateUrl: 'plan-edit.component.html',
	styleUrls: ['plan-edit.component.less'],
	animations: [FADE_IN]
})
export class PlanEditComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
	@Input() plan: Plan;
	@Input() room: PlanRoom;

	get isEditing() { return this.dotEditing$.value || this.dotsPath && !this.dotsPath.closed; }
	get dotsPath() { return this.dotsPath$.value; }

	pending$ = new BehaviorSubject(false);
	dotEditing$ = new NgZoneBehaviorSubject(false);
	dotsPathMoving$ = new NgZoneBehaviorSubject(false);

	viewInit$ = new AsyncVoidSubject();
	@ViewChild(PlanComponent) planView: PlanComponent;
	@ViewChild(ToolbarComponent) toolbar: ToolbarComponent;

	get $host(): HTMLElement { return this.host.nativeElement; }

	@ViewChild('$viewport') viewportRef: ElementRef;
	get $viewport(): HTMLElement { return this.viewportRef && this.viewportRef.nativeElement; }

	@ViewChild('$canvas') private canvasRef: ElementRef;
	private get $canvas(): SVGElement { return this.canvasRef.nativeElement; }

	@ViewChild('$lockIcon') private lockIconRef: ElementRef;
	private get $lockIcon(): SVGGElement { return this.lockIconRef.nativeElement; }

	private get scale() { return this.planView.scale; }
	private actionsManager = new ActionManager();
	private pointer: Pointer;
	private snapGuide: Line;
	private lastMousePosition: PlanPosition;
	private dotsPath$ = new BehaviorSubject<DotsPath>(null);
	private planViewReadySubscription: Subscription;

	private mouseDown$ = Observable
		.defer(() => this.planView.ready$
			.filter(v => v)
			.concatMapTo(Observable
				.fromEvent<MouseEvent>(this.$canvas, 'mousedown')
				.subscribeOn(RtScheduler.outside)
			)
		)
		.share();

	private mouseUp$ = Observable
		.defer(() => this.planView.ready$
			.filter(v => v)
			.concatMapTo(Observable
				.fromEvent<MouseEvent>(this.$canvas, 'mouseup')
				.subscribeOn(RtScheduler.outside)
			)
		)
		.share();

	private mouseMove$ = Observable
		.defer(() => this.planView.ready$
			.filter(v => v)
			.concatMapTo(Observable
				.fromEvent<MouseEvent>(this.$canvas, 'mousemove')
				.subscribeOn(RtScheduler.outside)
			)
		)
		.share();

	private viewportScroll$ = Observable
		.defer(() => this.planView.ready$
			.filter(v => v)
			.concatMapTo(Observable
				.fromEvent<Event>(this.$viewport, 'scroll')
				.subscribeOn(RtScheduler.outside)
			)
			.startWith(null)
		)
		.share();

	private mousePlanMove$ = this.mouseMove$
		.combineLatest(this.viewportScroll$, mouse => mouse)
		.map(e => this.getMousePosition(e))
		.share();

	private destroyed$ = new AsyncVoidSubject();

	constructor(
		private host: ElementRef,
		private renderer: Renderer2,
		private cdr: ChangeDetectorRef,
		private roomsApi: RoomsApiService
	) {
		this.dotsPath$
			.pairwise()
			.subscribe(([prev, curr]) => {
				prev && prev.remove();
				curr.insertBefore(this.$canvas, this.$canvas.firstChild);
			});
	}

	ngOnChanges({ room }: SimpleChanges) {
		if (room && this.room) {
			this.planViewReadySubscription && this.planViewReadySubscription.unsubscribe();
			this.planViewReadySubscription = this.planView.ready$
				.filter(v => v)
				.subscribe(() => {
					this.room.updateScaled(this.scale);
					let dots = this.room.points && this.room.points.map(p => new Dot().drawAt(p, this.scale)) || [];
					let dotsPath = new DotsPath(dots).drawAt(null, this.scale);
					this.dotsPath$.next(dotsPath);
				});
		}
	}

	ngOnInit() {
		this.$lockIcon.innerHTML = octicons.lock.path;
	}

	ngAfterViewInit() {
		this.pointer = new Pointer().appendTo(this.$canvas);
		this.snapGuide = new Line().appendTo(this.$canvas).addClass('guide', 'snap');

		// disable context menu
		Observable
			.fromEvent<MouseEvent>(this.$canvas, 'contextmenu')
			.filter(() => this.isEditing)
			.subscribe(e => e.preventDefault());

		let roomPoints$ = this.dotsPath$
			.filter(dotsPath => !!dotsPath && !!this.room)
			.switchMap(dotsPath => dotsPath.dotsChange$)
			.map(dots => dots.map(dot => dot.position))
			.share();

		// update the room on the room plan points change
		roomPoints$
			.subscribe(points => {
				this.room.points = points;
				this.room.markAsDirty();
			});

		roomPoints$
			.delay(0) // wait till the dotspath is painted only afterwards we will now whether the path is closed or not
			.filter(() => this.dotsPath.closed)
			.observeOn(RtScheduler.runInAngularZone)
			.switchMap(points => this.roomsApi.getPlanTextCenter(points).pending(this.pending$))
			.subscribe(({ x, y }) => {
				this.room.textCenter = new PlanPosition({ x, y });
				this.room.updateScaled(this.scale);
			});

		// update scale on resize
		Observable
			.fromEvent(window, 'resize')
			.takeUntil(this.destroyed$)
			.filter(() => !!this.dotsPath)
			.subscribe(() => this.dotsPath.drawAt(this.lastMousePosition, this.scale));

		// draw the pointer and the line from the last dot to the pointer center
		Observable
			.combineLatest(
				this.mousePlanMove$,
				this.actionsManager.action$.startWith(null),
				mouse => mouse
			)
			.takeUntil(this.destroyed$)
			.let(stream => this.modify(stream))
			.subscribe(position => {
				this.showLockIconOnFirstDot(position);
				this.pointer.drawAt(position, this.scale);
				this.dotsPath.drawAt(position, this.scale);
				this.lastMousePosition = position;
			});

		// actions on drag
		// change the dots position by dragging if the dots path is closed
		let dragStart$ = this.mouseDown$
			.switchMap(eDown => this.mouseMove$
				.filter(eMove => eDown.pageX !== eMove.pageX || eDown.pageY !== eMove.pageY)
				.first()
				.takeUntil(this.mouseUp$)
				.map(() => eDown)
			)
			.filter(e => this.dotsPath.closed && e.button == 0)
			.map(e => <[IDotSnap, boolean]>[
				this.trySnapToDot(this.getMousePosition(e)),
				this.dotsPath.element.contains(<Element>e.target)
			])
			.filter(([snap, isOverPath]) => !!snap.dot || isOverPath)
			.map(([snap]) => snap)
			.share();

		dragStart$
			.switchMap(snap => Observable.if(
				() => !!snap.dot,
				this.dragDot(snap.dot),
				this.dragDotsPath(snap.position)
			))
			.subscribe();

		// actions on click
		this.mouseDown$
			.filter(e => e.button == 0) // left btn
			.flatMap(() => this.mouseUp$.first().takeUntil(dragStart$)) // emit only if drag not started
			.subscribe(() => this.dotsPath.closed ? this.tryRemoveLastDot(this.lastMousePosition) : this.createDot(this.lastMousePosition));

		this.cdr.detectChanges();

		this.planView.ready$
			.filter(v => v)
			.subscribe(() => this.viewInit$.complete());
	}

	ngOnDestroy() {
		this.destroyed$.complete();
	}

	onCommand(command: Command) {
		switch (command) {
			case Command.undo:
				this.actionsManager.undo();
				break;
			case Command.redo:
				this.actionsManager.redo();
				break;
			case Command.renew:
				let oldDotsPath = this.dotsPath;
				let newDotsPath = new DotsPath();
				this.actionsManager.do(new Action(ActionType.newDotsPath,
					() => {
						this.dotsPath$.next(newDotsPath);
						newDotsPath.updateDots();
					},
					() => {
						this.dotsPath$.next(oldDotsPath);
						oldDotsPath.updateDots();
					}
				));
				break;
		}
	}

	private getMousePosition(e: MouseEvent) {
		let offsetY = this.$viewport && this.$viewport.scrollTop > 0
			? $.offset(this.$viewport).top - this.$viewport.scrollTop
			: this.planView.offset.top;
		return new PlanPosition({
			x: e.pageX - this.planView.offset.left,
			y: e.pageY - offsetY
		}).applyScale(1 / this.scale);
	}

	private createDot(position: PlanPosition) {
		let dot = new Dot().drawAt(position, this.scale);
		this.actionsManager.do(new Action(ActionType.addDot, () => this.dotsPath.addDot(dot), () => this.dotsPath.removeDot(dot)));
	}

	private tryRemoveLastDot(position: PlanPosition) {
		if (this.trySnapToDot(position).dot !== this.dotsPath.firstDot) return;
		let dot = this.dotsPath.lastDot;
		this.actionsManager.do(new Action(ActionType.removeDot, () => this.dotsPath.removeDot(dot), () => this.dotsPath.addDot(dot)));
	}

	private dragDot(draggingDot: Dot) {
		return (draggingDot === this.dotsPath.firstDot
			? Observable.of(draggingDot, this.dotsPath.lastDot) // simultaneously redraw the first and the last dot on mouse move
			: Observable.of(draggingDot)
		)
			.map(dot => ({ dot, position: dot.position }))
			.do(() => this.dotEditing$.next(true))
			.flatMap(({ dot, position: startPosition }) => this.mousePlanMove$
				.takeUntil(this.mouseUp$
					.map(e => this.getMousePosition(e))
					.map(endPosition => new Action(ActionType.changeDot,
						() => {
							dot.drawAt(endPosition, this.scale);
							this.dotsPath.updateDots();
						},
						() => {
							dot.drawAt(startPosition, this.scale);
							this.dotsPath.updateDots();
						}
					))
					.do(() => this.dotEditing$.next(false))
					.do(action => this.actionsManager.do(action))
				)
				.map(position => ({ dot, position }))
			)
			.do(({ dot, position }) => {
				dot.drawAt(position, this.scale);
				this.dotsPath.redraw(this.scale);
			});
	}

	private dragDotsPath(startPosition: PlanPosition) {
		let startPositions = this.dotsPath.dots.map(dot => ({ dot, position: dot.position }));
		return this.mousePlanMove$
			.map(({ x, y }) => ({ dx: x - startPosition.x, dy: y - startPosition.y }))
			.do(offset => {
				this.dotsPath.dots.forEach((dot, index) => dot.drawAt(startPositions[index].position.add(offset), this.scale));
				this.dotsPath.redraw(this.scale);
				this.dotsPathMoving$.next(true);
			})
			.takeUntil(this.mouseUp$
				.map(() => this.dotsPath.dots.map(dot => ({ dot, position: dot.position })))
				.map(endPositions => new Action(ActionType.dragDotsPath,
					() => {
						endPositions.forEach(({ dot, position }) => dot.drawAt(position, this.scale));
						this.dotsPath.updateDots();
					},
					() => {
						startPositions.forEach(({ dot, position }) => dot.drawAt(position, this.scale));
						this.dotsPath.updateDots();
					}
				))
				.do(action => {
					this.actionsManager.do(action);
					this.dotsPathMoving$.next(false);
				})
			);
	}

	private modify(position$: Observable<PlanPosition>) {
		return position$
			.map(position => {
				position = this.dotsPath.closed || this.toolbar.isSnapToDots
					? this.trySnapToDot(position, !this.dotsPath.closed).position
					: position;

				position = this.toolbar.isSnapToAxis ? this.trySnapToAxis(position) : position;

				if (this.toolbar.isSnapToDots && this.toolbar.isSnapToAxis && !this.dotsPath.closed) {
					let snap = this.trySnapToDotPerpendicular(position);
					this.updateSnapGuide(snap);
					return snap.position;
				}

				this.updateSnapGuide(null);
				return position;
			});
	}

	private trySnapToDot(position: PlanPosition, onlyFirst = false): IDotSnap {
		if (_.isEmpty(this.dotsPath.dots)) return { position };

		let snapDot = onlyFirst
			? this.checkIsInSnapArea(position, this.dotsPath.dots[0].position) && this.dotsPath.dots[0]
			: this.dotsPath.findDot(dot => this.checkIsInSnapArea(position, dot.position));
		this.setClass(this.$canvas, 'snapped-dot', !!snapDot);
		return { dot: snapDot, position: snapDot && snapDot.position.clone() || position };
	}

	private trySnapToAxis(position: PlanPosition): PlanPosition {
		let { lastDot } = this.dotsPath;
		if (!lastDot) return position;

		let { x, y } = lastDot.position;
		let angel = this.calculateAngleBetweenTwoPoints(x, y, position.x, position.y);
		let res = position.clone();

		// snap to x axis
		if ((-145 > angel || angel > 145) || (-45 < angel && angel < 45)) {
			res.y = y;
			res.guiding = 'x';
		}
		// snap to y axis
		else if ((-145 < angel && angel < -45) || (145 > angel && angel > 45)) {
			res.x = x;
			res.guiding = 'y';
		}

		return res;
	}

	private trySnapToDotPerpendicular(position: PlanPosition): IDotSnap {
		if (!position.guiding || this.dotsPath.dots.length < 3) return { position };

		let guideAxis = position.guiding;
		let dot = this.dotsPath.dots[0];
		let snapDot = this.checkIsInSnapArea(position, dot.position, guideAxis) && dot;
		if (!snapDot) return { position };

		let res = position.clone();
		res[guideAxis] = snapDot.position[guideAxis];
		return { dot: snapDot, position: res };
	}

	private updateSnapGuide(snap: IDotSnap) {
		if (snap && snap.dot) {
			this.snapGuide.drawAt([snap.position, snap.dot.position], this.scale);
			this.snapGuide.addClass('show');
		}
		else
			this.snapGuide.removeClass('show');
	}

	private checkIsInSnapArea(position: PlanPosition, snapTargetPosition: PlanPosition, axle?: 'x' | 'y') {
		const SnapRadius = 20;
		let { x, y } = snapTargetPosition;
		let axis = axle && [axle] || ['x', 'y'];

		let dn = {
			x: x - SnapRadius,
			y: y - SnapRadius
		};

		let dp = {
			x: x + SnapRadius,
			y: y + SnapRadius
		};

		return axis.every(axi => dn[axi] < position[axi] && position[axi] < dp[axi]);
	}

	private calculateAngleBetweenTwoPoints(cx, cy, ex, ey) {
		let dy = ey - cy;
		let dx = ex - cx;
		let theta = Math.atan2(dy, dx); // range (-PI, PI]
		theta *= 180 / Math.PI; // rads to degs, range (-180, 180)
		return theta;
	}

	private showLockIconOnFirstDot(position: PlanPosition) {
		if (_.isEmpty(this.dotsPath.dots)) return;

		requestAnimationFrame(() => {
			if (this.dotsPath.firstDot.position.equal(position)) {
				let { x, y } = position.applyScale(this.scale);
				let bbox = this.$lockIcon.getBBox();
				let iconMargin = 5;

				let iconX = x - bbox.width - iconMargin;
				iconX = iconX > 0 ? iconX : x + iconMargin;

				let iconY = y - bbox.height - iconMargin;
				iconY = iconY > 0 ? iconY : y + iconMargin;

				this.renderer.setAttribute(this.$lockIcon, 'transform', `translate(${iconX},${iconY})`);
				this.setClass(this.$lockIcon, 'show', true);
			} else
				this.setClass(this.$lockIcon, 'show', false);
		});
	}

	private setClass(el: any, name: string, isAdd: boolean) {
		isAdd ? this.renderer.addClass(el, name) : this.renderer.removeClass(el, name);
	}
}

interface IDotSnap {
	dot?: Dot;
	position: PlanPosition;
}