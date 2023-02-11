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
		onMoveStart: (from: Point, keys: { readonly ctrl: boolean; readonly shift: boolean }) => boolean,
		onMoveFinish: (from: Point, to: Point, keys: { readonly ctrl: boolean; readonly shift: boolean }) => boolean
	) {
		canvas.addEventListener("touchmove", ev => {
			const scale = this.scale;
			const { x, y } = this.posFromTouchEvent(ev);
			this.position.x = x * scale;
			this.position.y = y * scale;
			this.ctrl = ev.ctrlKey;
			this.shift = ev.shiftKey;
			if (this.moveStart) ev.preventDefault();
		});
		canvas.addEventListener("mousemove", ev => {
			const scale = this.scale;
			this.position.x = ev.offsetX * scale;
			this.position.y = ev.offsetY * scale;
			this.ctrl = ev.ctrlKey;
			this.shift = ev.shiftKey;
		});
		canvas.addEventListener("touchstart", ev => {
			const scale = this.scale;
			const { x, y } = this.posFromTouchEvent(ev);
			this.position.x = x * scale;
			this.position.y = y * scale;
			if (!this.pressed) {
				this.moveStart = { ...this.position };
				if (onMoveStart(this.moveStart, this)) ev.preventDefault();
				else this.moveStart = undefined;
			}
			this.ctrl = ev.ctrlKey;
			this.shift = ev.shiftKey;
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
			this.shift = ev.shiftKey;
		});
		canvas.addEventListener("touchend", ev => {
			const scale = this.scale;
			const { x, y } = this.posFromTouchEvent(ev);
			this.position.x = x * scale;
			this.position.y = y * scale;
			this.ctrl = ev.ctrlKey;
			this.shift = ev.shiftKey;
			if (this.moveStart) {
				if (onMoveFinish(this.moveStart, this.position, this)) ev.preventDefault();
				this.moveStart = undefined;
			}
			ev.preventDefault();
		});
		canvas.addEventListener("mouseup", ev => {
			if (ev.button !== 0) return;
			const scale = this.scale;
			this.position.x = ev.offsetX * scale;
			this.position.y = ev.offsetY * scale;
			this.ctrl = ev.ctrlKey;
			this.shift = ev.shiftKey;
			if (this.moveStart) {
				onMoveFinish(this.moveStart, this.position, this);
				this.moveStart = undefined;
			}
		});
	}
	posFromTouchEvent(ev: TouchEvent) {
		return this.posFromTouch(ev.changedTouches[0]);
	}
	posFromTouch(t: Touch) {
		const canvasRect = this.canvas.getBoundingClientRect();
		const x = t.pageX - canvasRect.x;
		const y = t.pageY - canvasRect.y;
		return { x, y };
	}
}
