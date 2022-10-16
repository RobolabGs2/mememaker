import { Frame, TextContent } from "./frame";
import { PatchData, BatchPatchData } from "./patch";

export class State {
	constructor(frames: Frame[]) {
		this.frames = frames;
		this.activeFrame = frames[0];
		this.activeText = frames[0].textContent[0];
		this.appliedOperations.push({ diff: new SetFrames(frames), op: "do" });
	}
	frames: Frame[];
	activeFrame: Frame;
	activeText: TextContent;

	public appliedOperations = new Array<{ diff: StateDiff; op: "do" | "undo" | "redo" | "temporal" }>();
	private operations = new Array<{ do: StateDiff; undo: StateDiff }>();
	private lastOpIndex = -1;
	private temporalPatch?: StateDiff;

	undoTemporal() {
		if (!this.temporalPatch) return;
		this.temporalPatch.apply(this);
		this.temporalPatch = undefined;
	}
	applyTemporal(patch: StateDiff) {
		this.undoTemporal();
		const undo = patch.apply(this);
		if (undo === EmptyDiff) return;
		this.appliedOperations.push({ diff: patch, op: "temporal" });
		this.temporalPatch = undo;
	}
	apply(patch: StateDiff) {
		this.undoTemporal();
		const undo = patch.apply(this);
		if (undo === EmptyDiff) return;
		this.appliedOperations.push({ diff: patch, op: "do" });
		this.operations.length = this.lastOpIndex + 1;
		this.operations.push({ do: patch, undo });
		if (this.operations.length > 1250) this.operations.splice(0, 250);
		this.lastOpIndex = this.operations.length - 1;
	}
	undo() {
		this.undoTemporal();
		if (this.lastOpIndex === -1) return;
		const op = this.operations[this.lastOpIndex];
		this.lastOpIndex--;
		op.undo.apply(this);
		this.appliedOperations.push({ diff: op.undo, op: "undo" });
	}
	redo() {
		this.undoTemporal();
		if (this.lastOpIndex === this.operations.length - 1) return;
		const op = this.operations[this.lastOpIndex + 1];
		this.lastOpIndex++;
		op.do.apply(this);
		this.appliedOperations.push({ diff: op.do, op: "redo" });
	}
}

export type StateDiff = PatchData<State>;
export const EmptyDiff: PatchData<any> = {
	apply: function (): PatchData<any> {
		return EmptyDiff;
	},
};
export class SetActiveText implements StateDiff {
	constructor(readonly text: TextContent) {}
	apply(object: State): PatchData<State> {
		const currentText = object.activeText;
		object.activeText = this.text;
		return new SetActiveText(currentText);
	}
}

export class SetActiveFrame implements StateDiff {
	constructor(readonly frame: Frame, readonly text = frame.textContent[0]) {}
	apply(object: State): PatchData<State> {
		const currentFrame = object.activeFrame;
		const currentText = object.activeText;
		object.activeFrame = this.frame;
		object.activeText = this.text;
		return new SetActiveFrame(currentFrame, currentText);
	}
}

export class SetFrames implements StateDiff {
	constructor(readonly frames: Frame[]) {}
	apply(object: State): PatchData<State> {
		const currentFrames = object.frames;
		const currentFrame = object.activeFrame;
		const currentText = object.activeText;
		object.frames = this.frames;
		object.activeFrame = this.frames[0];
		object.activeText = this.frames[0].textContent[0];
		return new BatchPatchData(new SetFrames(currentFrames), new SetActiveFrame(currentFrame, currentText));
	}
}

export class ShiftFrame implements StateDiff {
	constructor(readonly frame: Frame, readonly shift: -1 | 1) {}

	apply(object: State): PatchData<State> {
		const i = object.frames.findIndex(v => v === this.frame);
		if (i === -1) throw new Error("Logic error: can't move frame in array if it has not contains");
		const j = i + this.shift;
		if (j === -1 || j === object.frames.length) return EmptyDiff;
		object.frames[i] = object.frames[j];
		object.frames[j] = this.frame;
		return new ShiftFrame(this.frame, this.shift === 1 ? -1 : 1);
	}
}

export class RemoveFrame implements StateDiff {
	constructor(readonly frame: Frame) {}
	apply(object: State): PatchData<State> {
		const index = object.frames.findIndex(v => v === this.frame);
		if (index === -1) throw new Error("Logic error: can't remove frame from array if it has not contains");
		object.frames.splice(index, 1);
		return new AddFrame(this.frame, index);
	}
}

export class AddFrame implements StateDiff {
	constructor(readonly frame: Frame, readonly where: number = -1) {}
	apply(object: State): PatchData<State> {
		if (this.where == -1) {
			object.frames.push(this.frame);
			return new RemoveFrame(this.frame);
		}
		object.frames.splice(this.where, 0, this.frame);
		return new RemoveFrame(this.frame);
	}
}

export class ShiftContent implements StateDiff {
	constructor(readonly content: TextContent, readonly shift: -1 | 1) {}

	apply(object: State): PatchData<State> {
		const i = object.activeFrame.textContent.findIndex(v => v === this.content);
		if (i === -1) throw new Error("Logic error: can't move frame in array if it has not contains");
		const j = i + this.shift;
		if (j === -1 || j === object.activeFrame.textContent.length) return EmptyDiff;
		object.activeFrame.textContent[i] = object.activeFrame.textContent[j];
		object.activeFrame.textContent[j] = this.content;
		return new ShiftContent(this.content, this.shift === 1 ? -1 : 1);
	}
}

export class RemoveContent implements StateDiff {
	constructor(readonly content: TextContent) {}
	apply(object: State): PatchData<State> {
		const index = object.activeFrame.textContent.findIndex(v => v === this.content);
		if (index === -1) throw new Error("Logic error: can't remove frame from array if it has not contains");
		object.activeFrame.textContent.splice(index, 1);
		return new AddContent(this.content, index);
	}
}

export class AddContent implements StateDiff {
	constructor(readonly content: TextContent, readonly where: number = -1) {}
	apply(object: State): PatchData<State> {
		if (this.where == -1) {
			object.activeFrame.textContent.push(this.content);
			return new RemoveContent(this.content);
		}
		object.activeFrame.textContent.splice(this.where, 0, this.content);
		return new RemoveContent(this.content);
	}
}

export type Constructor<T> = new (...args: any[]) => T;
export type ConstructorResult<C extends Constructor<unknown>> = C extends Constructor<infer T> ? T : never;

export class StateDiffListener<C extends Constructor<StateDiff> = Constructor<StateDiff>> {
	constructor(readonly on: readonly C[], readonly action: (diff: ConstructorResult<C>, cancel: boolean) => void) {}
}

export function makeDiffHandler(...listeners: StateDiffListener[]) {
	const map = new Map<Constructor<StateDiff>, ((diff: StateDiff, cancel: boolean) => void)[]>();
	listeners.forEach(({ on, action }) =>
		on.forEach(diffType => {
			const actions = map.get(diffType) || [];
			actions.push(action);
			map.set(diffType, actions);
		})
	);
	return (patch: StateDiff, cancel: boolean) => {
		map.forEach((actions, diffType) => {
			if (patch instanceof diffType) actions.forEach(action => action(patch, cancel));
		});
	};
}
