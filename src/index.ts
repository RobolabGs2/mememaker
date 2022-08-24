import * as HTML from "./html";
import placeholderURL from "../assets/placeholder.png";
import downloadingURL from "../assets/downloading.png";
import { downloadImage, downloadImages } from "./http_helpers";
import JSZip from "jszip";

class App {
	private frames: Frame[];
	private activeFrame: Frame;
	private ctx: CanvasRenderingContext2D;

	setActive(frame: Frame) {
		frame.draw(this.ctx);
		this.activeFrame = frame;
		this.textInput.value = frame.text;
	}
	private textInput: HTMLTextAreaElement;
	private framesListContainer: HTMLElement;
	constructor(private placeholders: Record<"downloading" | "empty", HTMLImageElement>) {
		this.activeFrame = new Frame(placeholders.empty, "Hello memes! WRITE TEXT ========>", "Impact");
		this.frames = [this.activeFrame];
		setTimeout(() => this.setFrames(this.frames));
		const canvas = document.querySelector("canvas")!;
		this.ctx = canvas.getContext("2d")!;

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
		textInput.rows = 30;

		const urlInput = HTML.CreateElement("input", HTML.SetInputType("file"));
		this.setActive(this.activeFrame);
		properties.append("Image (or Ctrl+V, or drop file):", urlInput, "Text:", textInput);
		let updateTimer = -1;
		textInput.addEventListener("input", () => {
			if (updateTimer > 0) clearTimeout(updateTimer);
			updateTimer = setTimeout(() => {
				this.activeFrame.text = textInput.value;
				this.activeFrame.draw(this.ctx);
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
				frame.image = placeholders.downloading;
				frame.draw(this.ctx);
				reader.addEventListener("load", ev => {
					downloadImage(reader.result as string).then(img => {
						frame.image = img;
						frame.draw(this.ctx);
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
				frame.image = placeholders.downloading;
				frame.draw(this.ctx);
				reader.addEventListener("load", ev => {
					downloadImage(reader.result as string).then(img => {
						frame.image = img;
						frame.draw(this.ctx);
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
				this.addFrame(placeholders.downloading);
				const frame = this.frames[this.frames.length - 1];
				reader.addEventListener("load", ev => {
					downloadImage(reader.result as string).then(img => {
						frame.image = img;
						frame.draw(this.ctx);
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
				frame.image = placeholders.downloading;
				frame.draw(this.ctx);
				reader.addEventListener("load", ev => {
					downloadImage(reader.result as string).then(img => {
						frame.image = img;
						frame.draw(this.ctx);
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
			HTML.AddEventListener("click", () => {
				const zip = new JSZip();
				this.frames.forEach((frame, index) => {
					const src = frame.preview!.src;
					const b = src.substring(src.indexOf("base64,") + 7);
					zip.file(`${index}.png`, b, { base64: true });
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
			HTML.SetText("Download rendered meme"),
			HTML.AppendTo(properties)
		);

		HTML.CreateElement(
			"button",
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
			HTML.SetText("Download csv script"),
			HTML.AppendTo(properties)
		);
		HTML.CreateElement(
			"button",
			HTML.AddEventListener("click", () => {
				const zip = new JSZip();
				const text = new Array<string>();
				this.frames.forEach((frame, index) => {
					zipCanvas.width = frame.image.width;
					zipCanvas.height = frame.image.height;
					zipCtx?.drawImage(frame.image, 0, 0);
					const src = zipCanvas.toDataURL();
					const b = src.substring(src.indexOf("base64,") + 7);
					zip.file(`${index}.png`, b, { base64: true });
					text.push(frame.text);
				});
				zip.file("text.json", JSON.stringify(text));
				zip.generateAsync({ type: "blob" }).then(blob => {
					const a = document.createElement("a");
					a.download = "meme.meme";
					a.href = URL.createObjectURL(blob);
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
				});
			}),
			HTML.SetText("Download meme project"),
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
							const texts = JSON.parse(text) as string[];
							const images = zip.file(/.*\.png/);
							const frames = new Array<Frame>(texts.length);
							Promise.all(images.map(x => x.async("base64"))).then(base64Images => {
								base64Images.forEach((base64, i) => {
									const j = Number(images[i].name.substring(0, images[i].name.length - ".png".length));
									frames[j] = new Frame(
										HTML.CreateElement("img", el => (el.src = `data:image/png;base64,${base64}`)),
										texts[j],
										"Impact"
									);
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
	}
	addFrame(img: HTMLImageElement = this.placeholders.empty): HTMLElement {
		const newFrame = new Frame(img, "", "Impact");
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
		frame.draw(this.ctx);

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

downloadImages({
	placeholder: placeholderURL,
	downloadingPlaceholder: downloadingURL,
}).then(({ placeholder, downloadingPlaceholder }) => {
	const app = new App({ downloading: downloadingPlaceholder, empty: placeholder });
});

class Frame {
	constructor(public image: HTMLImageElement, public text: string, public font: string) {}
	public preview?: HTMLImageElement; // TODO: think about it again
	draw(ctx: CanvasRenderingContext2D) {
		const { image: img, text, font } = this;
		ctx.canvas.width = img.width;
		ctx.canvas.height = img.height;
		ctx.drawImage(img, 0, 0);
		ctx.fillStyle = "#FFFFFF";
		ctx.strokeStyle = "#000000";
		ctx.textAlign = "center";
		const x = img.width / 2;
		ctx.lineWidth = 12;
		ctx.lineJoin = "round";
		ctx.miterLimit = 2;
		const fontSize = calcTextWidth(ctx, text, font);
		const y = img.height - fontSize / 1.5;
		ctx.strokeText(text, x, y);
		ctx.fillText(text, x, y);
		if (this.preview) {
			this.preview.src = ctx.canvas.toDataURL();
		}
	}
}

function calcTextWidth(ctx: CanvasRenderingContext2D, txt: string, font: string): number {
	const memeWidth = ctx.canvas.width;
	const memeHeight = ctx.canvas.height;
	const initialFontSize = memeHeight * 0.1;
	const maxHeight = memeHeight * 0.3;
	let fontSize = initialFontSize;
	// TODO: optimization
	for (let i = 0; i < 500; i++) {
		ctx.font = `${fontSize}px ${font}`;
		const { width: textWidth } = ctx.measureText(txt);
		const percent = textWidth / memeWidth;
		// console.log(memeWidth, textWidth, percent, fontSize);
		if (percent > 0.95) {
			fontSize -= 1;
			continue;
		}
		if (percent < 0.9 && fontSize < maxHeight) {
			fontSize += 1;
			continue;
		}
		return fontSize;
	}
	return fontSize;
}
