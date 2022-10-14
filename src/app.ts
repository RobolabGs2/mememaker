import * as HTML from "./html";
import { downloadBlobAs, downloadImage, readBlobAsURL } from "./http_helpers";

import { Frame, resizeCanvas, TextContent } from "./frame";
import { TextSettingsForm } from "./ui/inputs/text_settings_input";
import { BrushInput } from "./ui/inputs/brush_input";
import { BatchPatchData, ChangedData, DelegatePatch, PatchData } from "./patch";
import {
	State,
	SetActiveFrame,
	SetActiveText,
	AddFrame,
	SetFrames,
	RemoveFrame,
	ShiftFrame,
	AddContent,
	ShiftContent,
	makeDiffHandler,
	StateDiffListener,
	RemoveContent,
} from "./state";
import { Meme } from "./meme";
import { FramePreview } from "./frame_preview";
import { ContentPreview } from "./content_preview";
import PreviewListContainer from "./ui/preview_container";
import { LoadingView } from "./loading_view";
import { CanvasCursor } from "./ui/cursor";
import TextInput from "./ui/inputs/text_input";
import FilesInput from "./ui/inputs/file_input";
import { Point } from "./ui/inputs/point_input";
import { BrushManager } from "./brush";
import { TextStylePrototype, DefaultStyle } from "./text_style";
import { Matrix } from "./geometry/matrix";
import {
	arrowPolygon,
	circleArrowPolygon,
	createRectangle,
	DragAndDropCalculatedPolygon,
	DragAndDropPolygon,
	DynamicTransform,
	RectangleSprite,
	Sprite,
	SpriteSystem,
	Transform,
} from "./graphics/sprite";
import * as PointUtils from "./geometry/point_utils";

export class DrawContext {
	constructor(
		readonly main: CanvasRenderingContext2D,
		readonly ui: CanvasRenderingContext2D,
		readonly offscreen: CanvasRenderingContext2D
	) {}
	public set width(w: number) {
		if (this.width === w) return;
		this.main.canvas.width = w;
		this.ui.canvas.width = w;
		// this.offscreen.canvas.width = w;
	}
	public get width(): number {
		return this.main.canvas.width;
	}

	public set height(h: number) {
		if (this.height === h) return;
		this.main.canvas.height = h;
		this.ui.canvas.height = h;
		// this.offscreen.canvas.height = h;
	}
	public get height(): number {
		return this.main.canvas.height;
	}
}

interface ContentModifier<T extends object> {
	select(content: T, cursor: CanvasCursor): boolean;
	draw(content: T, ctx: CanvasRenderingContext2D, cursor: CanvasCursor, active: boolean): void;
	patch(content: T, cursor: CanvasCursor): PatchData<T>;
	release(): void;
}

// class RotateContentBox implements ContentModifier<ContentBox> {
// 	constructor(readonly brushManager: BrushManager, readonly textStyle: TextStylePrototype) {}
// 	select(content: ContentBox, cursor: CanvasCursor): boolean {
// 		const dx = cursor.position.x - content.x;
// 		const dy = cursor.position.y - content.y;
// 		const ringSize = this.ringSize(cursor);
// 		const radius = this.radius(content);
// 		return Math.sqrt(radius - Math.sqrt(dx * dx + dy * dy)) <= ringSize;
// 	}
// 	ringSize(cursor: CanvasCursor) {
// 		return cursor.scale * 8;
// 	}
// 	radius(content: ContentBox): number {
// 		return Math.sqrt((content.width * content.width) / 4 + (content.height * content.height) / 4);
// 	}
// 	draw(content: ContentBox, ctx: CanvasRenderingContext2D, cursor: CanvasCursor, active: boolean): void {
// 		const box = content;
// 		const canvasScale = cursor.scale;
// 		const radius = this.radius(content);
// 		if (!active) {
// 			ctx.beginPath();
// 			ctx.arc(box.x, box.y, radius, 0, 2 * Math.PI);
// 			ctx.strokeStyle = this.select(content, cursor) ? "#FF0000" : "#FFAA44AA";
// 			ctx.lineWidth = this.ringSize(cursor);
// 			ctx.stroke();
// 			return;
// 		}
// 		ctx.strokeStyle = "#FF00AA";
// 		ctx.beginPath();
// 		ctx.moveTo(cursor.position.x, cursor.position.y);
// 		ctx.lineTo(box.x, box.y);
// 		ctx.lineTo(box.x + (box.width * 2) / 3, box.y);
// 		ctx.stroke();
// 		const angle = (360 - (angleByTwoPoints(box, cursor.position) / Math.PI) * 180) % 360;
// 		ctx.beginPath();
// 		ctx.arc(box.x, box.y, radius, 0, -(angle / 180) * Math.PI, true);
// 		ctx.strokeStyle = active ? "#FF0000AA" : "#FFAA44";
// 		ctx.stroke();
// 		this.brushManager.setupCtxForText(ctx, this.textStyle, 16 * canvasScale);
// 		ctx.strokeText(angle.toFixed(2), box.x, box.y);
// 		ctx.fillText(angle.toFixed(2), box.x, box.y);
// 	}
// 	patch(content: ContentBox, cursor: CanvasCursor): PatchData<ContentBox> {
// 		return contentBoxRotatePatch(content, cursor.position);
// 	}
// 	release(): void {
// 		return;
// 	}
// }

export class App {
	private state: State;
	private ctx: DrawContext;

	setActive(frame: Frame) {
		this.state.apply(new SetActiveFrame(frame));
	}
	setActiveText(text: TextContent) {
		this.state.apply(new SetActiveText(text));
	}

	drawFrame(frame: Frame) {
		frame.draw(this.ctx.main, this.brushManager);
		this.framesViews.updatePreview(frame);
	}

	cursor: CanvasCursor;
	private framesViews: PreviewListContainer<Frame>;
	private contentViews: PreviewListContainer<TextContent>;
	sprites: SpriteSystem;
	uiTextStyle: TextStylePrototype = {
		font: { bold: true, italic: false, smallCaps: false, family: "monoscape" },
		case: "As is",
		fill: { name: "#FFFFFF", type: "color", patternSettings: { rotate: 0, scale: "font", shift: { x: 0, y: 0 } } },
		stroke: { name: "#000000", type: "color", patternSettings: { rotate: 0, scale: "font", shift: { x: 0, y: 0 } } },
		name: "ui",
	};
	rotationM = Matrix.Rotation((Math.PI / 3600) * 2);
	uiDraw() {
		for (let i = 0; i < this.state.appliedOperations.length; i++) {
			const { diff: patch, op } = this.state.appliedOperations[i];
			this.drawPatchHandler(patch, op !== "do");
		}
		this.state.appliedOperations.length = 0;
		const canvas = this.ctx.ui.canvas;
		resizeCanvas(canvas, { width: this.ctx.main.canvas.clientWidth, height: this.ctx.main.canvas.clientHeight });
		const ctx = this.ctx.ui;
		const cursor = this.cursor;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.save();
		const scale = 1 / cursor.scale;
		ctx.scale(scale, scale);
		ctx.fillStyle = "#FF0000";
		// ctx.fillRect(cursor.position.x, cursor.position.y, 10, 10);
		if (cursor.moveStart) {
			ctx.fillStyle = "#FF00FF";
			// ctx.fillRect(cursor.moveStart.x, cursor.moveStart.y, 10, 10);
		}
		ctx.lineWidth = 2;

		this.sprites.draw(ctx);
		if (this.state.activeText.main) {
			ctx.restore();
			return;
		}
		ctx.restore();
	}
	private brushManager: BrushManager;
	onChangeActiveFrame = new Array<(app: App) => void>();
	private busyView = new LoadingView(this.placeholders["downloading"]);
	constructor(
		private placeholders: Record<"downloading" | "empty", HTMLImageElement[]>,
		patternsImages: Record<string, HTMLImageElement>,
		fontFamilies: string[],
		project?: Blob
	) {
		this.busyView.up("Loading...");
		setTimeout(() => this.busyView.down("Loading..."));
		this.state = new State([new Frame(randomFrom(placeholders.empty), `Hello meme! Write text here >>>>>>`)]);
		const animationFrame = () => {
			this.uiDraw();
			requestAnimationFrame(animationFrame);
		};
		requestAnimationFrame(animationFrame);
		const canvas = document.querySelector("canvas#main") as HTMLCanvasElement;
		const canvasUI = document.querySelector("canvas#ui") as HTMLCanvasElement;
		this.sprites = new SpriteSystem(canvas, sprite => {
			const getPatch = this.dragDropSystems.get(sprite);
			if (!getPatch) return;
			let lastPatch: PatchData<RectangleSprite> | undefined;
			const state = this.state;
			const box = state.activeText.box;
			return {
				move(from, to, cursor) {
					if (lastPatch) lastPatch.apply(box);
					const patch = getPatch(from, to, cursor, box);
					lastPatch = patch.apply(box);
				},
				drop(from, to, cursor) {
					if (lastPatch) lastPatch.apply(box);
					const patch = getPatch(from, to, cursor, box);
					state.apply(
						new DelegatePatch<State, ["activeText", ["box"]], RectangleSprite>(["activeText", ["box"]], patch)
					);
				},
			};
		});
		this.cursor = this.sprites.cursor;

		this.ctx = new DrawContext(
			canvas.getContext("2d")!,
			canvasUI.getContext("2d")!,
			document.createElement("canvas").getContext("2d")!
		);
		this.brushManager = new BrushManager(this.ctx.offscreen, patternsImages);
		this.framesViews = new PreviewListContainer(frame => this.createFrameView(frame), this.brushManager);
		this.contentViews = new PreviewListContainer(content => this.createContentView(content), this.brushManager);
		const framesContainer = document.querySelector("section#frames") as HTMLElement;
		framesContainer.append(this.framesViews.element);
		addButton("Add frame", () => this.addFrame(), framesContainer);
		const textsContainer = document.querySelector("section#current-frame") as HTMLElement;
		textsContainer.append(this.contentViews.element);
		addButton("Add text", () => this.addText(), textsContainer);

		const properties = document.querySelector("section#properties") as HTMLElement;
		const urlInput = new FilesInput("image/*", files => {
			const image = files.find(file => file.type?.match(/^image/));
			if (image) this.busyView.await("Upload image from file...", this.downloadAndSetImage(image));
		});
		const applyPatch = (patch: PatchData<TextStylePrototype>) =>
			this.state.apply(
				new DelegatePatch<State, ["activeText", ["style"]], TextStylePrototype>(["activeText", ["style"]], patch)
			);
		const textSettingsInput = TextSettingsForm(fontFamilies, applyPatch);
		const patternsKeys = Object.keys(patternsImages);
		const fillBrushInput = new BrushInput(
			brushPatch => applyPatch(new DelegatePatch(["fill"], brushPatch)),
			patternsKeys,
			"#FFFFFF"
		);
		const strokeBrushInput = new BrushInput(
			brushPatch => applyPatch(new DelegatePatch(["stroke"], brushPatch)),
			patternsKeys,
			"#000000"
		);
		const textInput = new TextInput(newValue =>
			this.state.apply(new ChangedData<State, ["activeText", ["text"]]>(["activeText", ["text"]], newValue))
		);
		this.onChangeActiveFrame.push(app => {
			textSettingsInput.update(app.state.activeText.style);
			fillBrushInput.update(app.state.activeText.style.fill);
			strokeBrushInput.update(app.state.activeText.style.stroke);
			textInput.update(app.state.activeText.text);
		});
		properties.append(
			"Image (or Ctrl+V, or drop file):",
			urlInput.element,
			"Fill:",
			fillBrushInput.element,
			"Stroke: ",
			strokeBrushInput.element,
			"Text:",
			textSettingsInput.element,
			textInput.element
		);
		document.addEventListener("paste", event => {
			const items = event.clipboardData?.items;
			if (!items) return;
			for (let index = 0; index < items.length; index++) {
				const item = items[index];
				if (!item.type?.match(/^image/)) continue;
				this.busyView.await(
					"Pasting image...",
					new Promise<File>((resolve, reject) => {
						const file = item.getAsFile();
						if (file) resolve(file);
						else reject("Failed to get file from clipboard");
					}).then(this.downloadAndSetImage)
				);
				return;
			}
		});
		document.addEventListener("drop", ev => {
			ev.preventDefault();
			const items = ev.dataTransfer?.files;
			if (!items) return;
			for (let index = 0; index < items.length; index++) {
				const file = items[index];
				if (!file.type?.match(/^image/)) continue;
				this.busyView.await("Dropping image to meme...", this.downloadAndSetImage(file));
				return;
			}
		});
		document.addEventListener("dragover", ev => ev.preventDefault());
		framesContainer.addEventListener("drop", ev => {
			ev.preventDefault();
			ev.stopPropagation();
			const items = ev.dataTransfer?.files;
			if (!items) return;
			const frames = Promise.all(
				Array.from(items)
					.filter(file => file.type?.match(/^image/))
					.map(file => readBlobAsURL(file).then(downloadImage))
			)
				.then(images => new BatchPatchData(...images.map(img => new AddFrame(new Frame(img, "")))))
				.then(patch => this.state.apply(patch));
			this.busyView.await("Creating new frames...", frames);
		});
		addButton(
			"Download rendered meme",
			() =>
				this.busyView.await(
					"Rendering...",
					Meme.renderToZIP(this.state.frames, this.brushManager).then(downloadBlobAs("meme.zip"))
				),
			properties
		);
		addButton(
			"Download csv script",
			() =>
				this.busyView.await("Preparing script...", Meme.scriptCSV(this.state.frames).then(downloadBlobAs("meme.csv"))),
			properties
		);
		addButton(
			"Download meme project",
			() => this.busyView.await("Packing project...", Meme.toFile(this.state.frames).then(downloadBlobAs("meme.meme"))),
			properties
		);

		const memeInput = new FilesInput(".meme", files => {
			const file = files[0];
			this.busyView.await(
				"Open project...",
				Meme.fromFile(file).then(frames => this.state.apply(new SetFrames(frames)))
			);
		});
		properties.append("Open meme project:", memeInput.element);

		document.addEventListener("keydown", ev => {
			if (ev.ctrlKey && ev.code === "KeyZ") {
				ev.preventDefault();
				if (ev.shiftKey) this.state.redo();
				else this.state.undo();
			}
			if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) {
				return;
			}
			if (ev.code === "ArrowRight") {
				const current = this.state.activeFrame;
				const next =
					this.state.frames[(this.state.frames.findIndex(x => x === current) + 1) % this.state.frames.length];
				this.setActive(next);
				return;
			}
			if (ev.code === "ArrowLeft") {
				const current = this.state.activeFrame;
				const next =
					this.state.frames[
						(this.state.frames.findIndex(x => x === current) + this.state.frames.length - 1) % this.state.frames.length
					];
				this.setActive(next);
				return;
			}
		});
		if (project)
			this.busyView.await(
				"Opening...",
				Meme.fromFile(project).then(frames => this.state.apply(new SetFrames(frames)))
			);
	}
	private drawPatchHandler = makeDiffHandler(
		new StateDiffListener([BatchPatchData], (diff, cancel) =>
			diff.patches.forEach(patch => this.drawPatchHandler(patch, cancel))
		),
		new StateDiffListener([ChangedData, DelegatePatch], (_, cancel) => {
			if (cancel) this.onChangeActiveFrame.forEach(v => v(this));
			this.contentViews.updatePreview(this.state.activeText);
		}),
		new StateDiffListener([AddFrame], diff => this.framesViews.add(diff.frame)),
		new StateDiffListener([AddContent], diff => this.contentViews.add(diff.content)),
		new StateDiffListener([RemoveFrame], diff => this.framesViews.remove(diff.frame)),
		new StateDiffListener([RemoveContent], diff => this.contentViews.remove(diff.content)),
		new StateDiffListener([AddFrame, ShiftFrame], () => this.framesViews.updateIndexes(this.state.frames)),
		new StateDiffListener([AddContent, ShiftContent], () =>
			this.contentViews.updateIndexes(this.state.activeFrame.textContent)
		),
		new StateDiffListener([SetFrames], diff => this.framesViews.reset(diff.frames)),
		new StateDiffListener([SetFrames, SetActiveFrame], () =>
			this.contentViews.reset(this.state.activeFrame.textContent)
		),
		new StateDiffListener(
			[SetFrames, SetActiveFrame, ShiftContent, AddContent, RemoveContent, ChangedData, DelegatePatch],
			() => {
				this.drawFrame(this.state.activeFrame);
			}
		),
		new StateDiffListener([SetFrames, SetActiveFrame, SetActiveText], () => {
			this.onChangeActiveFrame.forEach(v => v(this));
			this.framesViews.focus(this.state.activeFrame);
			this.contentViews.focus(this.state.activeText);
			this.sprites.clear();
			this.dragDropSystems.clear();
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
			const arrX = this.sprites.add(
				new DragAndDropPolygon(array, new Transform(0, 0, 0, reverseOnCtrl), true, alphaGradient("#0000ff"))
			);
			const arrY = this.sprites.add(
				new DragAndDropPolygon(array, new Transform(0, 0, -Math.PI / 2, reverseOnCtrl), true, alphaGradient("#ff0000"))
			);
			function makeSystem(arrow: DragAndDropPolygon) {
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
			this.dragDropSystems.set(arrX, makeSystem(arrX));
			this.dragDropSystems.set(arrY, makeSystem(arrY));
			this.dragDropSystems.set(
				this.sprites.add(
					new DragAndDropPolygon(
						createRectangle(uiUnit * 2, uiUnit * 2),
						new Transform(0, 0, 0, r.transform),
						true,
						alphaGradient("#ff00ff")
					)
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
			const arrRotate = this.sprites.add(
				new DragAndDropPolygon(
					circleArrowPolygon(4 * uiUnit, Math.PI * 1.5, uiUnit * 1.5),
					new Transform(0, 0, -Math.PI / 4, r.transform),
					true,
					alphaGradient("#00ff00")
				)
			);
			this.dragDropSystems.set(arrRotate, (from: Point, to: Point, cursor: CanvasCursor, box: RectangleSprite) => {
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
			});

			this.dragDropSystems.set(
				this.sprites.add(
					new DragAndDropCalculatedPolygon(
						() => createRectangle(uiUnit, this.state.activeText.box.height - uiUnit),
						new DynamicTransform(
							() => this.state.activeText.box.width / 2,
							() => 0,
							() => 0,
							r.transform
						),
						true,
						alphaGradient("#ff9900")
					)
				),
				sideResizePatchByUI("width", { x: 1, y: 0 })
			);
			this.dragDropSystems.set(
				this.sprites.add(
					new DragAndDropCalculatedPolygon(
						() => createRectangle(uiUnit, this.state.activeText.box.height - uiUnit),
						new DynamicTransform(
							() => -this.state.activeText.box.width / 2,
							() => 0,
							() => 0,
							r.transform
						),
						true,
						alphaGradient("#ff9900")
					)
				),
				sideResizePatchByUI("width", { x: -1, y: 0 })
			);
			this.dragDropSystems.set(
				this.sprites.add(
					new DragAndDropCalculatedPolygon(
						() => createRectangle(this.state.activeText.box.width - uiUnit, uiUnit),
						new DynamicTransform(
							() => 0,
							() => this.state.activeText.box.height / 2,
							() => 0,
							r.transform
						),
						true,
						alphaGradient("#ff9900")
					)
				),
				sideResizePatchByUI("height", { x: 0, y: 1 })
			);
			this.dragDropSystems.set(
				this.sprites.add(
					new DragAndDropCalculatedPolygon(
						() => createRectangle(this.state.activeText.box.width - uiUnit, uiUnit),
						new DynamicTransform(
							() => 0,
							() => -this.state.activeText.box.height / 2,
							() => 0,
							r.transform
						),
						true,
						alphaGradient("#ff9900")
					)
				),
				sideResizePatchByUI("height", { x: 0, y: -1 })
			);
			[
				{ x: 1, y: 1 },
				{ x: -1, y: 1 },
				{ x: -1, y: -1 },
				{ x: 1, y: -1 },
			].forEach(dir => {
				this.dragDropSystems.set(
					this.sprites.add(
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
						)
					),
					resizePatchByUI(dir)
				);
			});
		})
	);
	dragDropSystems = new Map<
		Sprite,
		(from: Point, to: Point, cursor: CanvasCursor, box: RectangleSprite) => PatchData<RectangleSprite>
	>();
	addFrame(img: HTMLImageElement = randomFrom(this.placeholders.empty)) {
		const newFrame = new Frame(img, "");
		this.state.apply(new AddFrame(newFrame));
		this.setActive(newFrame);
	}
	addText() {
		const frame = this.state.activeFrame;
		const newText = new TextContent(
			new RectangleSprite(
				frame.image.width / 2,
				frame.image.height / 2,
				frame.image.width / 2,
				frame.image.height / 2,
				0,
				{ fill: {}, stroke: { default: "#aaaa00 " } }
			),
			"New text",
			DefaultStyle()
		);
		this.state.apply(new AddContent(newText));
		this.setActiveText(newText);
	}
	setFrames(frames: Frame[]) {
		this.state.apply(new SetFrames(frames));
	}
	createFrameView(frame: Frame): FramePreview {
		return new FramePreview(frame, patch => {
			if (patch instanceof RemoveFrame) {
				if (this.state.frames.length === 1) this.addFrame();
				if (this.state.activeFrame === frame) this.setActive(this.state.frames.find(v => v !== frame)!);
			}
			this.state.apply(patch);
		});
	}
	createContentView(content: TextContent): ContentPreview {
		return new ContentPreview(content, patch => {
			if (patch instanceof RemoveContent) {
				if (this.state.activeText === content)
					this.setActiveText(this.state.activeFrame.textContent.find(v => v !== content)!);
			}
			this.state.apply(patch);
		});
	}
	downloadAndSetImage = (file: File) => {
		return readBlobAsURL(file)
			.then(downloadImage)
			.then(img => {
				this.state.apply(new ChangedData<State, ["activeFrame", ["image"]]>(["activeFrame", ["image"]], img));
			});
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
			lv = lh = Math.min(lv, lh);
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

export function randomFrom<T>(arr: T[]): T {
	return arr[Math.floor(arr.length * Math.random())];
}
function addButton(text: string, action: () => void, destination: HTMLElement) {
	HTML.CreateElement("button", HTML.SetText(text), HTML.AddEventListener("click", action), HTML.AppendTo(destination));
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
