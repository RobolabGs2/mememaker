import { Point } from "./inputs/point_input";

export class CanvasCursor {
	position: Point = { x: 0, y: 0 };
	get pressed(): boolean {
		return this.moveStart !== undefined;
	}
	moveStart?: Point;
	ctrl = false;
	shift = false;
	get scale(): number {
		const canvas = this.canvas;
		return canvas.width / canvas.clientWidth;
	}
	constructor(
		private canvas: HTMLCanvasElement,
		onMoveStart: (from: Point, keys: { readonly ctrl: boolean; readonly shift: boolean }) => void,
		onMoveFinish: (from: Point, to: Point, keys: { readonly ctrl: boolean; readonly shift: boolean }) => void
	) {
		canvas.addEventListener("mousemove", ev => {
			const scale = this.scale;
			this.position.x = ev.offsetX * scale;
			this.position.y = ev.offsetY * scale;
			this.ctrl = ev.ctrlKey;
			this.shift = ev.ctrlKey;
		});
		canvas.addEventListener("mousedown", ev => {
			if (ev.button !== 0) return;
			const scale = this.scale;
			this.position.x = ev.offsetX * scale;
			this.position.y = ev.offsetY * scale;
			if (!this.pressed) {
				this.moveStart = { ...this.position };
				onMoveStart(this.moveStart, this);
			}
			this.ctrl = ev.ctrlKey;
			this.shift = ev.ctrlKey;
		});
		canvas.addEventListener("mouseup", ev => {
			if (ev.button !== 0) return;
			const scale = this.scale;
			this.position.x = ev.offsetX * scale;
			this.position.y = ev.offsetY * scale;
			this.ctrl = ev.ctrlKey;
			this.shift = ev.ctrlKey;
			if (this.moveStart) {
				onMoveFinish(this.moveStart, this.position, this);
				this.moveStart = undefined;
			}
		});
	}
}
