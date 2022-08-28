import * as HTML from "./html";
import { downloadImage } from "./http_helpers";

import JSZip from "jszip";
import { BrushManager, Frame } from "./frame";
import { BrushInput, TextSettingsInput } from "./ui";

class PatternsManager {}

export class App {
	private frames: Frame[];
	private activeFrame: Frame;
	private ctx: CanvasRenderingContext2D;

	setActive(frame: Frame) {
		this.drawFrame(frame);
		this.activeFrame = frame;
		this.textInput.value = frame.text;
		this.onChangeActiveFrame.forEach(l => l(this));
	}

	drawFrame(frame: Frame) {
		frame.draw(this.ctx, this.brushManager);
	}
	private brushManager: BrushManager;
	onChangeActiveFrame = new Array<(app: App) => void>();
	private textInput: HTMLTextAreaElement;
	private framesListContainer: HTMLElement;
	constructor(
		private placeholders: Record<"downloading" | "empty", HTMLImageElement[]>,
		patternsImages: Record<string, HTMLImageElement>
	) {
		this.activeFrame = new Frame(randomFrom(placeholders.empty), `Hello memes. Write text here >>>>>>`);
		this.frames = [this.activeFrame];
		setTimeout(() => this.setFrames(this.frames));
		const canvas = document.querySelector("canvas")!;
		this.ctx = canvas.getContext("2d")!;
		this.brushManager = new BrushManager(this.ctx, patternsImages);
		const framesContainer = document.querySelector("section#frames") as HTMLElement;
		this.framesListContainer = HTML.CreateElement("article", HTML.SetId("list"));
		const addFrameButton = HTML.CreateElement(
			"button",
			HTML.SetText("Add frame"),
			HTML.AddEventListener("click", () => {
				this.addFrame();
			})
		);
		framesContainer.append(this.framesListContainer, addFrameButton);
		const properties = document.querySelector("section#properties") as HTMLElement;
		const textInput = (this.textInput = HTML.CreateElement("textarea"));
		textInput.rows = 15;

		const urlInput = HTML.CreateElement("input", HTML.SetInputType("file"));
		this.setActive(this.activeFrame);
		const onChange = () => this.drawFrame(this.activeFrame);
		const textSettingsInput = TextSettingsInput(this.activeFrame.textContent.style, onChange, listener =>
			this.onChangeActiveFrame.push(app => listener(app.activeFrame.textContent.style))
		);
		const patternsKeys = Object.keys(patternsImages);
		const fillBrushInput = BrushInput(
			this.activeFrame.textContent.style.fill,
			onChange,
			listener => this.onChangeActiveFrame.push(app => listener(app.activeFrame.textContent.style.fill)),
			patternsKeys
		);
		const strokeBrushInput = BrushInput(
			this.activeFrame.textContent.style.stroke,
			onChange,
			listener => this.onChangeActiveFrame.push(app => listener(app.activeFrame.textContent.style.stroke)),
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
			if (updateTimer > 0) clearTimeout(updateTimer);
			updateTimer = setTimeout(() => {
				this.activeFrame.text = textInput.value;
				this.drawFrame(this.activeFrame);
			}, 500);
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
		const zipCanvas = document.createElement("canvas");
		const zipCtx = zipCanvas.getContext("2d");
		HTML.CreateElement(
			"button",
			HTML.SetText("Download rendered meme"),
			HTML.AddEventListener("click", () => {
				const zip = new JSZip();
				const maxDigitsCount = this.frames.length.toString().length;
				this.frames.forEach((frame, index) => {
					const src = frame.preview!.src;
					const b = src.substring(src.indexOf("base64,") + 7);
					zip.file(`${(index + 1).toString().padStart(maxDigitsCount, "0")}.png`, b, { base64: true });
				});
				zip.generateAsync({ type: "blob" }).then(blob => {
					const a = document.createElement("a");
					a.download = "meme.zip";
					a.href = URL.createObjectURL(blob);
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
				});
			}),
			HTML.AppendTo(properties)
		);

		HTML.CreateElement(
			"button",
			HTML.SetText("Download csv script"),
			HTML.AddEventListener("click", () => {
				const blob = new Blob([this.frames.map(frame => `"${frame.text.replace(/"/g, '""')}"`).join("\n")], {
					type: "text/csv",
				});
				const a = document.createElement("a");
				a.download = "meme.csv";
				a.href = URL.createObjectURL(blob);
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
			}),
			HTML.AppendTo(properties)
		);
		HTML.CreateElement(
			"button",
			HTML.SetText("Download meme project"),
			HTML.AddEventListener("click", () => {
				const zip = new JSZip();
				this.frames.forEach((frame, index) => {
					zipCanvas.width = frame.image.width;
					zipCanvas.height = frame.image.height;
					zipCtx?.drawImage(frame.image, 0, 0);
					const src = zipCanvas.toDataURL();
					const b = src.substring(src.indexOf("base64,") + 7);
					zip.file(`${index}.png`, b, { base64: true });
				});
				zip.file("text.json", JSON.stringify(this.frames));
				zip.generateAsync({ type: "blob" }).then(blob => {
					const a = document.createElement("a");
					a.download = "meme.meme";
					a.href = URL.createObjectURL(blob);
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
				});
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
				zip.loadAsync(file).then(zip => {
					zip
						.file("text.json")!
						.async("string")
						.then(text => {
							const texts = JSON.parse(text) as (string | Record<string, any>)[];
							const images = zip.file(/.*\.png/);
							const frames = new Array<Frame>(texts.length);
							Promise.all(
								images.map(x => x.async("base64").then(base64 => downloadImage(`data:image/png;base64,${base64}`)))
							).then(base64Images => {
								base64Images.forEach((img, i) => {
									const j = Number(images[i].name.substring(0, images[i].name.length - ".png".length));
									const frameJSON = texts[j] as any;
									frames[j] = new Frame(img, typeof frameJSON === "string" ? frameJSON : frameJSON.text);
									if (typeof frameJSON !== "string") {
										frames[j].textContent.style = frameJSON.textContent.style;
									}
								});
								(this as HTMLInputElement).value = "";
								setTimeout(self.setFrames.bind(self), 0, frames);
							});
						});
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
	addFrame(img: HTMLImageElement = randomFrom(this.placeholders.empty)): HTMLElement {
		const newFrame = new Frame(img, "");
		this.frames.push(newFrame);
		const elem = this.createFrameView(newFrame);
		this.framesListContainer.append(elem);
		this.setActive(newFrame);
		return elem;
	}
	setFrames(frames: Frame[]) {
		this.frames = frames;
		this.framesListContainer.innerHTML = "";
		this.framesListContainer.append(...this.frames.map(this.createFrameView.bind(this)));
		this.setActive(frames[0]);
	}
	createFrameView(frame: Frame) {
		const image = HTML.CreateElement("img", HTML.AddEventListener("click", this.setActive.bind(this, frame)));
		frame.preview = image;
		this.drawFrame(frame);

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
}

function randomFrom<T>(arr: T[]): T {
	return arr[Math.floor(arr.length * Math.random())];
}
