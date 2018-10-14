import { Subject } from 'rxjs';
import { Action } from './action';

export class ActionManager {
	action$ = new Subject<Action>();

	private history: Action[] = [];
	private lastActionIndex = -1;

	constructor() { }

	do(action: Action) {
		if (this.lastActionIndex != -1)
			this.history = _.take(this.history, this.lastActionIndex + 1);

		action.invoke();
		this.history.push(action);
		this.lastActionIndex = this.history.length - 1;
		this.action$.next(action);
	}

	undo() {
		if (this.lastActionIndex != -1) {
			let lastAction = this.history[this.lastActionIndex];
			lastAction.revert();
			this.action$.next(lastAction);
			this.lastActionIndex--;
		}
	}

	redo() {
		let nextIndex = this.lastActionIndex + 1;
		if (nextIndex < this.history.length) {
			let nextAction = this.history[nextIndex];
			nextAction.invoke();
			this.action$.next(nextAction);
			this.lastActionIndex++;
		}
	}
}