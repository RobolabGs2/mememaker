import JSZip from "jszip";
import { BrushManager } from "./brush";
import { Frame, TextContent } from "./frame";
import { RectangleSprite } from "./graphics/sprite";
import { downloadImage } from "./http_helpers";

export class Meme {
	static fromFile(file: Blob): Promise<Frame[]> {
		const zip = new JSZip();
		return zip.loadAsync(file).then(zip => {
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
							if (version === "v0.0.3") {
								const textContent = frameJSON.textContent;
								frames[j] = new Frame(img, "If you see this, please, contact with parrots");
								frames[j].textContent = textContent.map((c: any) => {
									const box = c.box;
									const style = c.style;
									return new TextContent(
										new RectangleSprite(box.x, box.y, box.width, box.height, 0, {
											fill: {},
											stroke: { default: "#aaaa00 " },
										}),
										c.text,
										style,
										c.main
									);
								});
							} else if (version === "v0.0.4") {
								const textContent = frameJSON.textContent;
								frames[j] = new Frame(img, "If you see this, please, contact with parrots");
								frames[j].textContent = textContent.map((c: any) => {
									const box = c.box;
									const style = c.style;
									return new TextContent(
										new RectangleSprite(
											box.transform.x,
											box.transform.y,
											box._width,
											box._height,
											box.transform.rotate,
											{
												fill: {},
												stroke: { default: "#aaaa00 " },
											}
										),
										c.text,
										style,
										c.main
									);
								});
							} else {
								alert("UNKNOWN VERSION OF MEME PROJECT");
							}
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
		});
	}
	private static ctx = document.createElement("canvas").getContext("2d")!;
	static toFile(frames: Frame[]): Promise<Blob> {
		const zip = new JSZip();
		return Promise.all(
			frames.map((frame, index) => {
				const ctx = Meme.ctx;
				ctx.canvas.width = frame.image.width;
				ctx.canvas.height = frame.image.height;
				ctx.drawImage(frame.image, 0, 0);
				return getBlobFromCanvas(ctx.canvas).then(blob => {
					zip.file(`${index}.png`, blob, { binary: true });
				});
			})
		).then(() => {
			zip.file("text.json", JSON.stringify(frames), { comment: "v0.0.4" });
			return zip.generateAsync({ type: "blob" });
		});
	}
	static renderToZIP(frames: Frame[], brushManager: BrushManager): Promise<Blob> {
		const zip = new JSZip();
		const maxDigitsCount = frames.length.toString().length;
		return Promise.all(
			frames.map((frame, index) => {
				frame.draw(Meme.ctx, brushManager);
				return getBlobFromCanvas(Meme.ctx.canvas).then(blob => {
					zip.file(`${(index + 1).toString().padStart(maxDigitsCount, "0")}.png`, blob, { binary: true });
				});
			})
		).then(() => zip.generateAsync({ type: "blob" }));
	}
	static scriptCSV(frames: Frame[]): Promise<Blob> {
		return Promise.resolve(
			new Blob([frames.map(frame => `"${frame.textContent[0].text.replace(/"/g, '""')}"`).join("\n")], {
				type: "text/csv",
			})
		);
	}
}

function getBlobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
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
