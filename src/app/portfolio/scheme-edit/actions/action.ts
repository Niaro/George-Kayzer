export enum ActionType {
	newDotsPath = 'newDotsPath',
	dragDotsPath = 'dragDotsPath',
	addDot = 'addDot',
	removeDot = 'removeDot',
	changeDot = 'changeDot'
}

export class Action {
	constructor(
		public type: ActionType,
		public invoke: () => void,
		public revert: () => void
	) { }
}