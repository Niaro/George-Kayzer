import { Component, Output, ElementRef, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { KEY, RtScheduler, AsyncVoidSubject } from 'rent';

export enum Command {
	undo = 'undo',
	redo = 'redo',
	renew = 'renew'
}

@Component({
	selector: 'rt-toolbar',
	templateUrl: 'toolbar.component.html',
	styleUrls: ['toolbar.component.less']
})
export class ToolbarComponent implements OnDestroy {
	@Output() command = new Subject<Command | keyof typeof Command>();

	isSnapToDots = true;
	isSnapToAxisMode = false;
	isSnapToAxisHotKey = false;
	get isSnapToAxis() { return this.isSnapToAxisHotKey ? !this.isSnapToAxisMode : this.isSnapToAxisMode; }

	hotkeyModifier = navigator.userAgent.toLowerCase().includes('mac os') ? 'Cmd' : 'Ctrl';

	get $host() { return this.host.nativeElement; }

	private unsubscriber$ = new AsyncVoidSubject();
	private pressed = new Set<number>();

	constructor(private host: ElementRef) {
		let $keyup = Observable
			.fromEvent<KeyboardEvent>(document, 'keyup')
			.subscribeOn(RtScheduler.outside);

		let $keydown = Observable
			.fromEvent<KeyboardEvent>(document, 'keydown')
			.subscribeOn(RtScheduler.outside);

		$keydown
			.filter(e => !this.pressed.has(e.keyCode))
			.do(e => this.pressed.add(e.keyCode))
			.observeOn(RtScheduler.runInAngularZone)
			.delay(0)
			.takeUntil(this.unsubscriber$)
			.subscribe(e => this.onKeyDown(e));

		$keyup
			.do(e => this.pressed.delete(e.keyCode))
			.observeOn(RtScheduler.runInAngularZone)
			.delay(0)
			.takeUntil(this.unsubscriber$)
			.subscribe(e => this.onKeyUp(e));
	}

	ngOnDestroy() {
		this.unsubscriber$.complete();
	}

	private onKeyDown(event: KeyboardEvent) {
		let cancel = false;
		switch (event.keyCode) {
			case KEY.SHIFT:
				this.isSnapToAxisHotKey = true;
				break;
			case KEY.Z:
				(event.ctrlKey || event.metaKey) && this.command.next(event.shiftKey ? Command.redo : Command.undo);
				cancel = true;
				break;
			case KEY.Y:
				(event.ctrlKey || event.metaKey) && this.command.next(Command.redo);
				cancel = true;
				break;
		}

		if (cancel) {
			event.preventDefault();
			event.stopPropagation();
		}
	}

	private onKeyUp(event: KeyboardEvent) {
		switch (event.keyCode) {
			case KEY.SHIFT:
				this.isSnapToAxisHotKey = false;
				break;
		}
	}
}