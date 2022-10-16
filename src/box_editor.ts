import { Matrix } from "./geometry/matrix";
import Point from "./geometry/point";
import {
	arrowPolygon,
	circleArrowPolygon,
	createRectangle,
	DragAndDropCalculatedPolygon,
	DragAndDropPolygon,
	DynamicTransform,
	RectangleSprite,
	Transform,
} from "./graphics/sprite";
import { BatchPatchData, ChangedData, DelegatePatch, PatchData } from "./patch";
import { State } from "./state";
import { CanvasCursor } from "./ui/cursor";
import * as PointUtils from "./geometry/point_utils";
import { DrawContext } from "./app";
import { resizeCanvas } from "./frame";
import { SpriteSystem, Sprite } from "./graphics/sprite_system";

export default class BoxEditor {
	private sprites: SpriteSystem;
	private get cursor() {
		return this.sprites.cursor;
	}
	constructor(readonly ctx: DrawContext, readonly state: State) {
		this.sprites = new SpriteSystem(ctx.main.canvas, sprite => {
			const getPatch = this.handlers.get(sprite);
			if (!getPatch) return;
			const state = this.state;
			const box = state.activeText.box;
			return {
				move(from, to, cursor) {
					state.undoTemporal();
					const patch = getPatch(from, to, cursor, box);
					state.applyTemporal(
						new DelegatePatch<State, ["activeText", ["box"]], RectangleSprite>(["activeText", ["box"]], patch)
					);
				},
				drop(from, to, cursor) {
					state.undoTemporal();
					const patch = getPatch(from, to, cursor, box);
					state.apply(
						new DelegatePatch<State, ["activeText", ["box"]], RectangleSprite>(["activeText", ["box"]], patch)
					);
				},
			};
		});
	}
	handlers = new Map<
		Sprite,
		(from: Point, to: Point, cursor: CanvasCursor, box: RectangleSprite) => PatchData<RectangleSprite>
	>();
	draw() {
		const ctx = this.ctx.ui;
		const cursor = this.sprites.cursor;
		const canvas = ctx.canvas;
		resizeCanvas(canvas, { width: this.ctx.main.canvas.clientWidth, height: this.ctx.main.canvas.clientHeight });
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.save();
		const scale = 1 / cursor.scale;
		ctx.scale(scale, scale);
		ctx.lineWidth = 2;
		this.sprites.draw(ctx);
		ctx.restore();
	}
	private add(
		sprite: Sprite,
		handler: (from: Point, to: Point, cursor: CanvasCursor, box: RectangleSprite) => PatchData<RectangleSprite>
	) {
		this.handlers.set(this.sprites.add(sprite), handler);
	}
	setup() {
		this.sprites.clear();
		this.handlers.clear();
		if (this.state.activeText.main) return;
		const r = this.sprites.add(this.state.activeText.box);
		const uiUnit = 18 * this.cursor.scale;
		const array = arrowPolygon(uiUnit * 7, uiUnit * 1.4);
		const reverseOnCtrl = new DynamicTransform(
			() => 0,
			() => 0,
			() => (this.cursor.ctrl ? -r.transform.rotation() : 0),
			r.transform
		);
		const arrX = new DragAndDropPolygon(array, new Transform(0, 0, 0, reverseOnCtrl), true, alphaGradient("#0000ff"));
		const arrY = new DragAndDropPolygon(
			array,
			new Transform(0, 0, -Math.PI / 2, reverseOnCtrl),
			true,
			alphaGradient("#ff0000")
		);
		this.add(arrX, moveAlong(arrX));
		this.add(arrY, moveAlong(arrY));
		this.add(
			new DragAndDropPolygon(
				createRectangle(uiUnit * 2, uiUnit * 2),
				new Transform(0, 0, 0, r.transform),
				true,
				alphaGradient("#ff00ff")
			),
			(from: Point, to: Point, cursor: CanvasCursor, box: RectangleSprite) => {
				const dx = to.x - from.x;
				const dy = to.y - from.y;
				const { x, y } = box.transform;
				return new BatchPatchData<RectangleSprite>(
					new ChangedData(["transform", ["x"]], x + dx),
					new ChangedData(["transform", ["y"]], y + dy)
				);
			}
		);
		const arrRotate = new DragAndDropPolygon(
			circleArrowPolygon(4 * uiUnit, Math.PI * 1.5, uiUnit * 1.5),
			new Transform(0, 0, -Math.PI / 4, r.transform),
			true,
			alphaGradient("#00ff00")
		);
		this.add(arrRotate, rotationPatch);
		[
			{ dim: "width" as const, dir: { x: 1, y: 0 } },
			{ dim: "width" as const, dir: { x: -1, y: 0 } },
			{ dim: "height" as const, dir: { x: 0, y: 1 } },
			{ dim: "height" as const, dir: { x: 0, y: -1 } },
		].forEach(({ dim, dir }) => {
			const rectangle =
				dim === "height"
					? () => createRectangle(this.state.activeText.box.width - uiUnit, uiUnit)
					: () => createRectangle(uiUnit, this.state.activeText.box.height - uiUnit);
			this.add(
				new DragAndDropCalculatedPolygon(
					rectangle,
					new DynamicTransform(
						() => (dir.x * this.state.activeText.box.width) / 2,
						() => (dir.y * this.state.activeText.box.height) / 2,
						() => 0,
						r.transform
					),
					true,
					alphaGradient("#ff9900")
				),
				sideResizePatchByUI(dim, dir)
			);
		});
		[
			{ x: 1, y: 1 },
			{ x: -1, y: 1 },
			{ x: -1, y: -1 },
			{ x: 1, y: -1 },
		].forEach(dir => {
			this.add(
				new DragAndDropPolygon(
					createRectangle(uiUnit, uiUnit),
					new DynamicTransform(
						() => (dir.x * this.state.activeText.box.width) / 2,
						() => (dir.y * this.state.activeText.box.height) / 2,
						() => 0,
						r.transform
					),
					true,
					alphaGradient("#ff99ff")
				),
				resizePatchByUI(dir)
			);
		});
	}
}

function rotationPatch(from: Point, to: Point, cursor: CanvasCursor, box: RectangleSprite): PatchData<RectangleSprite> {
	const { rotate } = box.transform;
	const center = box.transform.matrix().Transform({ x: 0, y: 0 });
	const v1 = PointUtils.vector(center, from);
	const v2 = PointUtils.vector(center, to);
	const a1 = Math.atan2(v1.y, v1.x);
	const a2 = Math.atan2(v2.y, v2.x);
	const delta = (Math.PI / 180) * 1;
	let dRotate = Math.round((a2 - a1) / delta) * delta;
	const step = Math.PI / 4;
	if (cursor.shift) dRotate = ((dRotate / step) | 0) * step;
	return new ChangedData<RectangleSprite>(["transform", ["rotate"]], cursor.ctrl ? dRotate : rotate + dRotate);
}

function alphaGradient(color: string) {
	return {
		fill: {
			default: `${color}44`,
			hover: `${color}99`,
			active: `${color}`,
		},
		stroke: {
			default: `${color}44`,
			hover: `${color}99`,
			active: `${color}`,
		},
	};
}

function sideResizePatchByUI(
	side: "width" | "height",
	dir: Point
): (from: Point, to: Point, cursor: CanvasCursor, box: RectangleSprite) => PatchData<RectangleSprite> {
	return (from: Point, to: Point, cursor: CanvasCursor, box: RectangleSprite) => {
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const v = Matrix.Rotation(box.transform.rotation()).Transform(dir);
		let l = dx * v.x + dy * v.y;
		if (cursor.shift) l = ((l / 10) | 0) * 10;
		if (!cursor.ctrl) return new ChangedData([side], box[side] + 2 * l);
		return new BatchPatchData<RectangleSprite>(
			new ChangedData(["transform", ["x"]], box.transform.x + (v.x * l) / 2),
			new ChangedData(["transform", ["y"]], box.transform.y + (v.y * l) / 2),
			new ChangedData([side], box[side] + l)
		);
	};
}

function resizePatchByUI(
	dir: Point
): (from: Point, to: Point, cursor: CanvasCursor, box: RectangleSprite) => PatchData<RectangleSprite> {
	return (from: Point, to: Point, cursor: CanvasCursor, box: RectangleSprite) => {
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const vv = Matrix.Rotation(box.transform.rotation()).Transform({ x: 0, y: dir.y });
		const vh = Matrix.Rotation(box.transform.rotation()).Transform({ x: dir.x, y: 0 });
		let lv = dx * vv.x + dy * vv.y;
		let lh = dx * vh.x + dy * vh.y;
		if (cursor.shift) {
			lv = lh = Math.max(lv, lh);
		}
		if (!cursor.ctrl)
			return new BatchPatchData<RectangleSprite>(
				new ChangedData(["height"], box.height + 2 * lv),
				new ChangedData(["width"], box.width + 2 * lh)
			);
		return new BatchPatchData<RectangleSprite>(
			new ChangedData(["transform", ["x"]], box.transform.x + (vv.x * lv) / 2 + (vh.x * lh) / 2),
			new ChangedData(["transform", ["y"]], box.transform.y + (vv.y * lv) / 2 + (vh.y * lh) / 2),
			new ChangedData(["height"], box.height + lv),
			new ChangedData(["width"], box.width + lh)
		);
	};
}

function moveAlong(arrow: DragAndDropPolygon) {
	return (from: Point, to: Point, cursor: CanvasCursor, box: RectangleSprite) => {
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const { x, y } = box.transform;
		const v = Matrix.Rotation(arrow.transform.rotation()).Transform({ x: 1, y: 0 });
		let l = dx * v.x + dy * v.y;
		if (cursor.shift) l = ((l / 10) | 0) * 10;
		return new BatchPatchData<RectangleSprite>(
			new ChangedData(["transform", ["x"]], x + v.x * l),
			new ChangedData(["transform", ["y"]], y + v.y * l)
		);
	};
}
