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
import TextInput from "./ui/inputs/text_input";
import FilesInput from "./ui/inputs/file_input";
import { BrushManager } from "./brush";
import { TextStylePrototype, DefaultStyle } from "./text_style";
import { RectangleSprite } from "./graphics/sprite";
import BoxEditor from "./box_editor";

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

	private framesViews: PreviewListContainer<Frame>;
	private contentViews: PreviewListContainer<TextContent>;
	boxEditor: BoxEditor;
	uiDraw() {
		for (let i = 0; i < this.state.appliedOperations.length; i++) {
			const { diff: patch, op } = this.state.appliedOperations[i];
			this.drawPatchHandler(patch, op !== "do");
		}
		this.state.appliedOperations.length = 0;
		this.boxEditor.draw();
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

		this.ctx = new DrawContext(
			canvas.getContext("2d")!,
			canvasUI.getContext("2d")!,
			document.createElement("canvas").getContext("2d")!
		);
		this.boxEditor = new BoxEditor(this.ctx, this.state);

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
			this.boxEditor.setup();
		})
	);
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

export function randomFrom<T>(arr: T[]): T {
	return arr[Math.floor(arr.length * Math.random())];
}
function addButton(text: string, action: () => void, destination: HTMLElement) {
	HTML.CreateElement("button", HTML.SetText(text), HTML.AddEventListener("click", action), HTML.AppendTo(destination));
}
