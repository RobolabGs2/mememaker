import * as HTML from "./html";
import { downloadImage } from "./http_helpers";

import JSZip from "jszip";
import { BrushManager, ContentBox, DefaultStyle, Frame, TextContent } from "./frame";
import { BrushInput, TextSettingsInput } from "./ui";

class PatternsManager {}

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
	private frames: Frame[];
	private activeFrame: Frame;
	private activeText: TextContent;
	private ctx: DrawContext;

	setActive(frame: Frame) {
		this.drawFrame(frame);
		this.activeFrame = frame;
		this.activeText = frame.textContent[0];
		this.textInput.value = this.activeText.text;
		this.onChangeActiveFrame.forEach(l => l(this));
		this.setTexts(frame.textContent);
	}
	setActiveText(text: TextContent) {
		this.activeText = text;
		this.textInput.value = this.activeText.text;
		this.drawFrame(this.activeFrame);
		this.onChangeActiveFrame.forEach(l => l(this));
	}

	drawFrame(frame: Frame) {
		frame.draw(this.ctx, this.brushManager);
	}

	cursorPosition: { x: number; y: number } = { x: 0, y: 0 };
	cursorDown = false;
	uiDraw() {
		this.ctx.ui.clearRect(0, 0, this.ctx.width, this.ctx.height);
		const box = this.activeText.box;
		const state = this.cursorState;
		if (this.activeText.main) return;
		if (!this.cursorDown)
			this.cursorState = this.activeText.box.checkPoint(this.cursorPosition.x, this.cursorPosition.y);
		if (state && this.cursorDown) {
			if (state.center) {
				box.x = this.cursorPosition.x;
				box.y = this.cursorPosition.y;
			}
			if (state.bottom) box.bottom = this.cursorPosition.y;
			if (state.top) box.top = this.cursorPosition.y;
			if (state.left) box.left = this.cursorPosition.x;
			if (state.right) box.right = this.cursorPosition.x;
		}
		box.draw(this.ctx.ui, "#FF00AA", this.cursorDown ? "#FFAA44" : "#FF0000AA", 3);
	}
	private brushManager: BrushManager;
	onChangeActiveFrame = new Array<(app: App) => void>();
	private textInput: HTMLTextAreaElement;
	private framesListContainer: HTMLElement;
	private textsListContainer: HTMLElement;
	cursorState?: ReturnType<ContentBox["checkPoint"]>;
	constructor(
		private placeholders: Record<"downloading" | "empty", HTMLImageElement[]>,
		patternsImages: Record<string, HTMLImageElement>
	) {
		this.activeFrame = new Frame(randomFrom(placeholders.empty), `Hello meme! Write text here >>>>>>`);
		this.activeText = this.activeFrame.textContent[0];
		this.frames = [this.activeFrame];
		setTimeout(() => this.setFrames(this.frames));
		const animationFrame = () => {
			this.uiDraw();
			requestAnimationFrame(animationFrame);
		};
		requestAnimationFrame(animationFrame);
		const canvas = document.querySelector("canvas#main") as HTMLCanvasElement;
		const canvasUI = document.querySelector("canvas#ui") as HTMLCanvasElement;
		canvas.addEventListener("mousemove", ev => {
			const scaleX = canvas.width / canvas.clientWidth;
			const scaleY = canvas.height / canvas.clientHeight;
			this.cursorPosition.x = ev.offsetX * scaleX;
			this.cursorPosition.y = ev.offsetY * scaleY;
		});

		canvas.addEventListener("mousedown", ev => {
			if (ev.button !== 0) return;
			const scaleX = canvas.width / canvas.clientWidth;
			const scaleY = canvas.height / canvas.clientHeight;
			this.cursorPosition.x = ev.offsetX * scaleX;
			this.cursorPosition.y = ev.offsetY * scaleY;
			this.cursorDown = true;
		});
		canvas.addEventListener("mouseup", ev => {
			if (ev.button !== 0) return;
			const scaleX = canvas.width / canvas.clientWidth;
			const scaleY = canvas.height / canvas.clientHeight;
			this.cursorPosition.x = ev.offsetX * scaleX;
			this.cursorPosition.y = ev.offsetY * scaleY;
			this.cursorDown = false;
			requestAnimationFrame(() => this.drawFrame(this.activeFrame));
		});
		const zipCanvas = document.createElement("canvas");
		this.ctx = new DrawContext(canvas.getContext("2d")!, canvasUI.getContext("2d")!, zipCanvas.getContext("2d")!);
		this.brushManager = new BrushManager(this.ctx.offscreen, patternsImages);
		const framesContainer = document.querySelector("section#frames") as HTMLElement;
		const textsContainer = document.querySelector("section#current-frame") as HTMLElement;
		this.framesListContainer = HTML.CreateElement("article", HTML.AddClass("list"));
		this.textsListContainer = HTML.CreateElement("article", HTML.AddClass("list"));
		const addFrameButton = HTML.CreateElement(
			"button",
			HTML.SetText("Add frame"),
			HTML.AddEventListener("click", () => {
				this.addFrame();
			})
		);
		const addTextButton = HTML.CreateElement(
			"button",
			HTML.SetText("Add text"),
			HTML.AddEventListener("click", () => {
				this.addText();
			})
		);
		framesContainer.append(this.framesListContainer, addFrameButton);
		textsContainer.append(this.textsListContainer, addTextButton);
		const properties = document.querySelector("section#properties") as HTMLElement;
		const textInput = (this.textInput = HTML.CreateElement("textarea"));
		textInput.rows = 15;
		const urlInput = HTML.CreateElement("input", HTML.SetInputType("file"));
		this.setActive(this.activeFrame);
		const onChange = () => this.drawFrame(this.activeFrame);
		const textSettingsInput = TextSettingsInput(this.activeText.style, onChange, listener =>
			this.onChangeActiveFrame.push(app => listener(app.activeText.style))
		);
		const patternsKeys = Object.keys(patternsImages);
		const fillBrushInput = BrushInput(
			this.activeText.style.fill,
			onChange,
			listener => this.onChangeActiveFrame.push(app => listener(app.activeText.style.fill)),
			patternsKeys
		);
		const strokeBrushInput = BrushInput(
			this.activeText.style.stroke,
			onChange,
			listener => this.onChangeActiveFrame.push(app => listener(app.activeText.style.stroke)),
			patternsKeys
		);
		properties.append(
			"Image (or Ctrl+V, or drop file):",
			urlInput,
			"Fill:",
			fillBrushInput,
			"Stroke: ",
			strokeBrushInput,
			"Text:",
			textSettingsInput,
			textInput
		);
		// properties.append(
		// 	HTML.CreateSelector(
		// 		"fire",
		// 		mapRecord(patterns, (_, key) => key),
		// 		key => (this.styles.fill = patterns[key])
		// 	)
		// );
		let updateTimer = -1;
		textInput.addEventListener("input", () => {
			if (updateTimer > 0) cancelAnimationFrame(updateTimer);
			updateTimer = requestAnimationFrame(() => {
				this.activeText.text = textInput.value;
				this.drawFrame(this.activeFrame);
				updateTimer = -1;
			});
		});
		urlInput.accept = "image/*";
		urlInput.addEventListener("change", ev => {
			const items = urlInput.files;
			if (!items) return;
			for (let index = 0; index < items.length; index++) {
				const file = items[index];
				if (!file.type?.match(/^image/)) {
					continue;
				}
				const reader = new FileReader();
				const frame = this.activeFrame;
				frame.image = randomFrom(placeholders.downloading);
				this.drawFrame(frame);
				reader.addEventListener("load", ev => {
					downloadImage(reader.result as string).then(img => {
						frame.image = img;
						this.drawFrame(frame);
					});
				});
				reader.readAsDataURL(file);
				return;
			}
		});
		document.addEventListener("paste", event => {
			const items = event.clipboardData?.items;
			if (!items) return;
			for (let index = 0; index < items.length; index++) {
				const item = items[index];
				if (!item.type?.match(/^image/)) {
					continue;
				}
				const file = item.getAsFile()!;
				const reader = new FileReader();
				const frame = this.activeFrame;
				frame.image = randomFrom(placeholders.downloading);
				this.drawFrame(frame);
				reader.addEventListener("load", ev => {
					downloadImage(reader.result as string).then(img => {
						frame.image = img;
						this.drawFrame(frame);
					});
				});
				reader.readAsDataURL(file);
				return;
			}
		});
		document.addEventListener("dragover", function (ev) {
			ev.preventDefault();
		});
		framesContainer.addEventListener("drop", ev => {
			ev.preventDefault();
			ev.stopPropagation();
			const items = ev.dataTransfer?.files;
			if (!items) return;
			for (let index = 0; index < items.length; index++) {
				const file = items[index];
				if (!file.type?.match(/^image/)) {
					continue;
				}
				const reader = new FileReader();
				this.addFrame(randomFrom(placeholders.downloading));
				const frame = this.frames[this.frames.length - 1];
				reader.addEventListener("load", ev => {
					downloadImage(reader.result as string).then(img => {
						frame.image = img;
						this.drawFrame(frame);
					});
				});
				reader.readAsDataURL(file);
			}
		});
		document.addEventListener("drop", ev => {
			ev.preventDefault();
			const items = ev.dataTransfer?.files;
			if (!items) return;
			for (let index = 0; index < items.length; index++) {
				const file = items[index];
				if (!file.type?.match(/^image/)) {
					continue;
				}
				const reader = new FileReader();
				const frame = this.activeFrame;
				frame.image = randomFrom(placeholders.downloading);
				this.drawFrame(frame);
				reader.addEventListener("load", () => {
					downloadImage(reader.result as string).then(img => {
						frame.image = img;
						this.drawFrame(frame);
					});
				});
				reader.readAsDataURL(file);
				return;
			}
		});

		HTML.CreateElement(
			"button",
			HTML.SetText("Download rendered meme"),
			HTML.AddEventListener("click", () => {
				this.getRenderedZIP();
			}),
			HTML.AppendTo(properties)
		);

		HTML.CreateElement(
			"button",
			HTML.SetText("Download csv script"),
			HTML.AddEventListener("click", () => {
				this.getScriptCSV();
			}),
			HTML.AppendTo(properties)
		);
		HTML.CreateElement(
			"button",
			HTML.SetText("Download meme project"),
			HTML.AddEventListener("click", () => {
				this.getMemeProject(zipCanvas);
			}),
			HTML.AppendTo(properties)
		);

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		properties.append("Open meme project:");
		HTML.CreateElement(
			"input",
			HTML.SetInputType("file"),
			input => (input.accept = ".meme"),
			HTML.AddEventListener("change", function () {
				const files = (this as HTMLInputElement).files;
				if (!files || files.length === 0) return;
				const file = files[0];
				const zip = new JSZip();
				zip
					.loadAsync(file)
					.then(zip => {
						const jsonFile = zip.file("text.json")!;
						const version = jsonFile.comment;
						return jsonFile.async("string").then(text => {
							const texts = JSON.parse(text) as (string | Record<string, any>)[];
							const images = zip.file(/.*\.png/);
							const frames = new Array<Frame>(texts.length);
							return Promise.all(
								images.map(x => x.async("base64").then(base64 => downloadImage(`data:image/png;base64,${base64}`)))
							).then(base64Images => {
								base64Images.forEach((img, i) => {
									const j = Number(images[i].name.substring(0, images[i].name.length - ".png".length));
									const frameJSON = texts[j] as any;
									if (version) {
										if (version !== "v0.0.3") alert("UNKNOWN VERSION OF MEME PROJECT");
										const textContent = frameJSON.textContent;
										frames[j] = new Frame(img, "If you see this, please, contact with parrots");
										frames[j].textContent = textContent.map((c: any) => {
											const box = c.box;
											const style = c.style;
											return new TextContent(
												new ContentBox(box.x, box.y, box.width, box.height),
												c.text,
												style,
												c.main
											);
										});
									} else {
										frames[j] = new Frame(img, typeof frameJSON === "string" ? frameJSON : frameJSON.text);
										if (typeof frameJSON !== "string") {
											frames[j].textContent[0].style = frameJSON.textContent.style;
										}
									}
								});
								return frames;
							});
						});
					})
					.then(frames => {
						(this as HTMLInputElement).value = "";
						setTimeout(self.setFrames.bind(self), 0, frames);
					});
			}),
			HTML.SetText("Open meme project"),
			HTML.AppendTo(properties)
		);

		document.addEventListener("keydown", ev => {
			if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) {
				return;
			}
			if (ev.code === "ArrowRight") {
				const current = this.activeFrame;
				const next = this.frames[(this.frames.findIndex(x => x === current) + 1) % this.frames.length];
				this.setActive(next);
				return;
			}
			if (ev.code === "ArrowLeft") {
				const current = this.activeFrame;
				const next =
					this.frames[(this.frames.findIndex(x => x === current) + this.frames.length - 1) % this.frames.length];
				this.setActive(next);
				return;
			}
		});
	}
	private getMemeProject(zipCanvas: HTMLCanvasElement) {
		const zip = new JSZip();
		Promise.all(
			this.frames.map((frame, index) => {
				zipCanvas.width = frame.image.width;
				zipCanvas.height = frame.image.height;
				this.ctx.offscreen.drawImage(frame.image, 0, 0);
				return getBlobFromCanvas(this.ctx.offscreen.canvas).then(blob => {
					zip.file(`${index}.png`, blob, { binary: true });
				});
			})
		).then(() => {
			zip.file("text.json", JSON.stringify(this.frames), { comment: "v0.0.3" });
			zip.generateAsync({ type: "blob" }).then(blob => {
				const a = document.createElement("a");
				a.download = "meme.meme";
				a.href = URL.createObjectURL(blob);
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
			});
		});
	}

	private getScriptCSV() {
		const blob = new Blob([this.frames.map(frame => `"${frame.textContent[0].text.replace(/"/g, '""')}"`).join("\n")], {
			type: "text/csv",
		});
		const a = document.createElement("a");
		a.download = "meme.csv";
		a.href = URL.createObjectURL(blob);
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	private getRenderedZIP() {
		const zip = new JSZip();
		const maxDigitsCount = this.frames.length.toString().length;
		Promise.all(
			this.frames.map((frame, index) => {
				frame.draw(this.ctx, this.brushManager, true);
				return getBlobFromCanvas(this.ctx.offscreen.canvas).then(blob => {
					zip.file(`${(index + 1).toString().padStart(maxDigitsCount, "0")}.png`, blob, { binary: true });
				});
			})
		).then(() => {
			zip.generateAsync({ type: "blob" }).then(blob => {
				const a = document.createElement("a");
				a.download = "meme.zip";
				a.href = URL.createObjectURL(blob);
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
			});
		});
	}

	addFrame(img: HTMLImageElement = randomFrom(this.placeholders.empty)): HTMLElement {
		const newFrame = new Frame(img, "");
		this.frames.push(newFrame);
		const elem = this.createFrameView(newFrame);
		this.framesListContainer.append(elem);
		this.setActive(newFrame);
		return elem;
	}
	addText() {
		const frame = this.activeFrame;
		const newText = new TextContent(
			new ContentBox(frame.image.width / 2, frame.image.height / 2, frame.image.width / 2, frame.image.height / 2),
			"New text",
			DefaultStyle()
		);
		this.activeFrame.textContent.push(newText);
		this.textsListContainer.append(this.createTextView(newText));
		this.setActiveText(newText);
	}
	setFrames(frames: Frame[]) {
		this.frames = frames;
		this.framesListContainer.innerHTML = "";
		this.framesListContainer.append(...this.frames.map(this.createFrameView.bind(this)));
		this.setActive(frames[0]);
	}
	setTexts(texts: TextContent[]) {
		this.textsListContainer.innerHTML = "";
		this.textsListContainer.append(...texts.map(this.createTextView.bind(this)));
	}
	createFrameView(frame: Frame) {
		const image = HTML.CreateElement("canvas", HTML.AddEventListener("click", this.setActive.bind(this, frame)));
		frame.preview = image.getContext("2d") || undefined;
		setTimeout(() => frame.draw(this.ctx, this.brushManager, true));

		const container = HTML.CreateElement(
			"article",
			HTML.AddClass("frame-preview"),
			HTML.Append(
				image,
				HTML.CreateElement(
					"footer",
					HTML.Append(
						HTML.CreateElement(
							"button",
							HTML.SetText("Remove"),
							HTML.AddEventListener("click", () => {
								const i = this.frames.findIndex(v => v === frame);
								container.remove();
								if (i === -1) return;
								this.frames.splice(i, 1);
								if (this.frames.length === 0) this.addFrame();
								if (this.activeFrame === frame) this.setActive(this.frames[0]);
							})
						),
						HTML.CreateElement(
							"button",
							HTML.SetText("Up"),
							HTML.AddEventListener("click", () => {
								const i = this.frames.findIndex(v => v === frame);
								if (i === -1 || i === 0) return;
								this.frames[i] = this.frames[i - 1];
								this.frames[i - 1] = frame;
								this.framesListContainer.insertBefore(container, container.previousElementSibling);
							})
						),
						HTML.CreateElement(
							"button",
							HTML.SetText("Down"),
							HTML.AddEventListener("click", () => {
								const i = this.frames.findIndex(v => v === frame);
								if (i === -1 || i === this.frames.length - 1) return;
								this.frames[i] = this.frames[i + 1];
								this.frames[i + 1] = frame;
								this.framesListContainer.insertBefore(container, container.nextElementSibling!.nextElementSibling);
							})
						)
					)
				)
			)
		);
		return container;
	}
	crutchCounter = 0;
	createTextView(text: TextContent) {
		const textView = HTML.CreateElement(
			"div",
			HTML.AddEventListener("click", this.setActiveText.bind(this, text)),
			HTML.SetText(text.main ? "Main" : `Text block ${this.crutchCounter++}`)
		);
		const container = HTML.CreateElement(
			"article",
			HTML.AddClass("frame-preview"),
			HTML.Append(
				textView,
				HTML.CreateElement(
					"footer",
					HTML.Append(
						...(text.main
							? []
							: [
									HTML.CreateElement(
										"button",
										HTML.SetText("Remove"),
										HTML.AddEventListener("click", () => {
											const i = this.activeFrame.textContent.findIndex(v => v === text);
											container.remove();
											if (i === -1) return;
											this.activeFrame.textContent.splice(i, 1);
											if (this.activeFrame.textContent.length === 0) this.addText();
											if (this.activeText === text) this.setActiveText(this.activeFrame.textContent[0]);
											this.drawFrame(this.activeFrame);
										})
									),
							  ]),
						HTML.CreateElement(
							"button",
							HTML.SetText("Up"),
							HTML.AddEventListener("click", () => {
								const i = this.activeFrame.textContent.findIndex(v => v === text);
								if (i === -1 || i === this.activeFrame.textContent.length - 1) return;
								this.activeFrame.textContent[i] = this.activeFrame.textContent[i + 1];
								this.activeFrame.textContent[i + 1] = text;
								this.textsListContainer.insertBefore(container, container.nextElementSibling!.nextElementSibling);
								this.drawFrame(this.activeFrame);
							})
						),
						HTML.CreateElement(
							"button",
							HTML.SetText("Down"),
							HTML.AddEventListener("click", () => {
								const i = this.activeFrame.textContent.findIndex(v => v === text);
								if (i === -1 || i === 0) return;
								this.activeFrame.textContent[i] = this.activeFrame.textContent[i - 1];
								this.activeFrame.textContent[i - 1] = text;
								this.textsListContainer.insertBefore(container, container.previousElementSibling);
								this.drawFrame(this.activeFrame);
							})
						)
					)
				)
			)
		);
		return container;
	}
}

function randomFrom<T>(arr: T[]): T {
	return arr[Math.floor(arr.length * Math.random())];
}

function getBlobFromCanvas(canvas: HTMLCanvasElement) {
	return new Promise((resolve, reject) => {
		canvas.toBlob(blob => {
			if (!blob) {
				reject(new Error(`Failed get blob`));
				return;
			}
			resolve(blob);
		});
	});
}
