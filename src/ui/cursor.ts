import { Point } from "./inputs/point_input";

export class CanvasCursor {
	position: Point = { x: 0, y: 0 };
	get pressed(): boolean {
		return this.moveStart !== undefined;
	}
	moveStart?: Point;
	constructor(canvas: HTMLCanvasElement, onMoveFinish: (from: Point, to: Point) => void) {
		canvas.addEventListener("mousemove", ev => {
			const scaleX = canvas.width / canvas.clientWidth;
			const scaleY = canvas.height / canvas.clientHeight;
			this.position.x = ev.offsetX * scaleX;
			this.position.y = ev.offsetY * scaleY;
		});
		canvas.addEventListener("mousedown", ev => {
			if (ev.button !== 0) return;
			const scaleX = canvas.width / canvas.clientWidth;
			const scaleY = canvas.height / canvas.clientHeight;
			this.position.x = ev.offsetX * scaleX;
			this.position.y = ev.offsetY * scaleY;
			if (!this.pressed) this.moveStart = { ...this.position };
		});
		canvas.addEventListener("mouseup", ev => {
			if (ev.button !== 0) return;
			const scaleX = canvas.width / canvas.clientWidth;
			const scaleY = canvas.height / canvas.clientHeight;
			this.position.x = ev.offsetX * scaleX;
			this.position.y = ev.offsetY * scaleY;
			if (this.moveStart) {
				onMoveFinish(this.moveStart, this.position);
				this.moveStart = undefined;
			}
		});
	}
}
