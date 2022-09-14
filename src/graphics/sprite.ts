import { Matrix } from "../geometry/matrix";
import Point from "../geometry/point";
import Polygon from "../geometry/polygon";
import Observable from "../observable";
import { CanvasCursor } from "../ui/cursor";

export default class Sprite {
	readonly events = new Observable<SpriteEvents>();
	constructor(readonly polygon: Polygon) {}
}

function makePath(ctx: CanvasRenderingContext2D, p: Polygon) {
	ctx.beginPath();
	ctx.moveTo(p.points[0].x, p.points[0].y);
	p.points.forEach(p => ctx.lineTo(p.x, p.y));
	ctx.closePath();
}

interface SpriteEvents {
	drag: Point;
}

export class SpriteSystem {
	readonly sprites = new Array<Sprite>();
	readonly cursor: CanvasCursor;
	constructor(canvas: HTMLCanvasElement) {
		this.cursor = new CanvasCursor(
			canvas,
			from => {
				const s = this.sprites.find(sprite => sprite.polygon.contains(from));
				if (!s) return;
				this.activeSprite = s;
			},
			(from, to) => {
				if (!this.activeSprite) return;
				this.activeSprite.polygon.transform(this.move(to, from));
				this.activeSprite = undefined;
			}
		);
	}
	activeSprite?: Sprite;
	private move(to: Point, from: Point): Matrix {
		return Matrix.Translate({ x: to.x - from.x, y: to.y - from.y });
	}

	add(s: Sprite) {
		this.sprites.push(s);
	}
	draw(ctx: CanvasRenderingContext2D) {
		const active = "#FF0000";
		const hover = "#FFAA00";
		const enabled = "#AAAA00";
		this.sprites.forEach(s => {
			if (this.activeSprite === s) {
				const sprite = s.polygon.transformCopy(this.move(this.cursor.position, this.cursor.moveStart!));
				makePath(ctx, sprite);
				ctx.strokeStyle = active;
				ctx.stroke();
				return;
			}
			ctx.fillStyle = hover;
			ctx.strokeStyle = enabled;
			makePath(ctx, s.polygon);
			ctx.stroke();
			if (s.polygon.contains(this.cursor.position)) ctx.fill();
		});
	}
}
