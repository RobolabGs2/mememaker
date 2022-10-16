import Point from "../geometry/point";
import { CanvasCursor } from "../ui/cursor";

export interface Sprite {
	contains(cursor: Point): boolean;
	readonly interactive: boolean;
	draw(ctx: CanvasRenderingContext2D, state: SpriteState): void;
}

export interface DragDropSystem {
	move(from: Point, to: Point, cursor: CanvasCursor): void;
	drop(from: Point, to: Point, cursor: CanvasCursor): void;
}

export type SpriteState = "default" | "hover" | "active";

export class SpriteSystem {
	readonly sprites = new Array<Sprite>();
	readonly cursor: CanvasCursor;
	constructor(
		canvas: HTMLCanvasElement,
		readonly dragDropSystemSource: (sprite: Sprite) => DragDropSystem | undefined
	) {
		this.cursor = new CanvasCursor(
			canvas,
			from => {
				if (this.dragAndDrop) return;
				if (!this.hoveredSprite) return;
				const system = this.dragDropSystemSource(this.hoveredSprite);
				if (!system) return;
				this.dragAndDrop = {
					sprite: this.hoveredSprite,
					system,
				};
			},
			(from, to) => {
				if (!this.dragAndDrop) return;
				this.dragAndDrop.system.drop(from, to, this.cursor);
				this.dragAndDrop = undefined;
			}
		);
	}
	dragAndDrop?: {
		sprite: Sprite;
		system: DragDropSystem;
	};
	hoveredSprite?: Sprite;
	add<T extends Sprite>(s: T) {
		this.sprites.push(s);
		return s;
	}
	clear() {
		this.dragAndDrop?.system.drop(this.cursor.moveStart!, this.cursor.position, this.cursor);
		this.dragAndDrop = undefined;
		this.hoveredSprite = undefined;
		this.sprites.length = 0;
	}
	update() {
		if (this.dragAndDrop) {
			this.dragAndDrop.system?.move(this.cursor.moveStart!, this.cursor.position, this.cursor);
			return;
		}
		if (this.hoveredSprite?.contains(this.cursor.position)) return;
		this.hoveredSprite = undefined;
		for (let i = this.sprites.length - 1; i >= 0; i--) {
			const sprite = this.sprites[i];
			if (sprite.interactive && sprite.contains(this.cursor.position)) {
				this.hoveredSprite = sprite;
				break;
			}
		}
	}
	draw(ctx: CanvasRenderingContext2D) {
		this.update();
		this.sprites.forEach(s => {
			ctx.save();
			s.draw(ctx, this.spriteState(s));
			ctx.restore();
		});
	}
	spriteState(sprite: Sprite): SpriteState {
		if (this.dragAndDrop?.sprite === sprite) return "active";
		if (this.hoveredSprite === sprite) return "hover";
		return "default";
	}
}
