// interface Brush {
//		(ctx: CanvasRenderingContext2D, text?: string): void;
// }

import { BrushManager } from "./brush";
import { RectangleSprite, Transform } from "./graphics/sprite";
import {
	TextStylePrototype,
	textToCase,
	FontSettings,
	lineWidthByFontSize,
	fontSettingsToCSS,
	DefaultStyle,
} from "./text_style";

// class MemeProject {
// frames: Frame[];
// brushes: Record<string, Record<string, Brush<unknown>>>;
// }

export type RectangleSide = Record<"right" | "left" | "top" | "bottom" | "center" | "none", boolean>;

export class Line {
	constructor(readonly p1: Point, readonly p2: Point) {}
}

interface Point {
	x: number;
	y: number;
}
interface PositionStrategy {
	text(ctx: CanvasRenderingContext2D, text: string): { lines: Point[]; fontSize: number };
	debugDraw(ctx: CanvasRenderingContext2D): void;
}

export function resizeCanvas(canvas: HTMLCanvasElement, size: { width: number; height: number }) {
	if (canvas.width !== size.width) canvas.width = size.width;
	if (canvas.height !== size.height) canvas.height = size.height;
}

export class TextContent {
	constructor(
		public box: RectangleSprite,
		public text: string,
		public style: TextStylePrototype,
		public main = false
	) {}
	draw(ctx: CanvasRenderingContext2D, brushManager: BrushManager): void {
		const text = textToCase(this.text, this.style.case).split("\n");
		const { lines, fontSize } = this.getTextCoords(ctx, text);
		brushManager.setupCtxForText(ctx, this.style, fontSize);
		if (!this.main) {
			ctx.translate(this.box.x, this.box.y);
			ctx.rotate(this.box.transform.rotate);
			ctx.translate(-this.box.x, -this.box.y);
		}
		text.forEach((line, i) => {
			const { x, y } = lines[i];
			ctx.strokeText(line, x, y);
			ctx.fillText(line, x, y);
			/*
			const params = ctx.measureText(line);
			ctx.strokeStyle = "#FF0000";
			ctx.strokeRect(
				x - params.actualBoundingBoxLeft,
				y - params.actualBoundingBoxAscent,
				params.actualBoundingBoxLeft + params.actualBoundingBoxRight,
				params.actualBoundingBoxAscent + params.actualBoundingBoxDescent
			);
			*/
		});
	}
	mainText(ctx: CanvasRenderingContext2D, font: FontSettings, text: string[]): { lines: Point[]; fontSize: number } {
		let maxLine = text[0];
		let maxWidth = 0;
		text.forEach(line => {
			const width = ctx.measureText(line).width;
			if (width > maxWidth) {
				maxLine = line;
				maxWidth = width;
			}
		});
		const x = ctx.canvas.width / 2;
		const fontSize = calcTextWidthOld(ctx, maxLine, font, text.length);
		const testString = "ЙДЁ";
		const testParams = ctx.measureText(testString);
		const fullHeight = testParams.actualBoundingBoxAscent + testParams.actualBoundingBoxDescent;
		const y = ctx.canvas.height - fontSize / (1.5 + text.length * 0.5);
		const lines = text.map((_, i) => {
			const ly = y - (text.length - i - 1) * fullHeight;
			return { x, y: ly };
		});
		return { lines, fontSize };
	}
	cache = 0;
	textInBox(
		ctx: CanvasRenderingContext2D,
		font: FontSettings,
		text: string[],
		box: RectangleSprite
	): { lines: Point[]; fontSize: number } {
		const [fontSize, totalHeight] = calcFontSize(ctx, text, font, this.box, this.cache);
		this.cache = fontSize;
		const x = box.x;
		const lineWidth = lineWidthByFontSize(fontSize);
		let prevY = box.top + lineWidth;
		if (totalHeight < box.height) {
			prevY += (box.height - totalHeight) / 2;
		}
		const lines = text.map(t => {
			const params = ctx.measureText(t);
			const y = prevY + params.actualBoundingBoxAscent;
			prevY = y + params.actualBoundingBoxDescent + lineWidth;
			return { x, y };
		});
		return { lines, fontSize };
	}
	getTextCoords(ctx: CanvasRenderingContext2D, text: string[]) {
		if (this.main) return this.mainText(ctx, this.style.font, text);
		return this.textInBox(ctx, this.style.font, text, this.box);
	}
}

function calcTextWidthOld(ctx: CanvasRenderingContext2D, txt: string, font: FontSettings, linesCount: number): number {
	const memeWidth = ctx.canvas.width;
	const memeHeight = ctx.canvas.height;
	const initialFontSize = memeHeight * 0.1;
	const maxHeight = Math.min(memeHeight * 0.16, (memeHeight * 0.34) / linesCount);
	// const maxHeight = memeHeight * 0.16;
	let fontSize = initialFontSize;
	// TODO: optimization
	for (let i = 0; i < 500; i++) {
		ctx.font = fontSettingsToCSS(font, fontSize);
		const { width: textWidth } = ctx.measureText(txt);
		const percent = textWidth / memeWidth;
		if (percent > 0.97) {
			fontSize -= 1;
			continue;
		}
		if (percent < 0.96 && fontSize < maxHeight) {
			fontSize += 1;
			continue;
		}
		return fontSize;
	}
	return fontSize;
}

export class Frame {
	constructor(public image: HTMLImageElement, text: string) {
		this.textContent.push(
			new TextContent(
				new RectangleSprite(
					this.image.width / 2,
					this.image.height - (this.image.height * 0.34) / 2,
					this.image.width * 0.97,
					this.image.height * 0.34,
					0,
					{ fill: {}, stroke: {} }
				),
				text,
				DefaultStyle(),
				true
			)
		);
	}
	public textContent = new Array<TextContent>();
	draw(ctx: CanvasRenderingContext2D, brushManager: BrushManager) {
		// const startDraw = performance.now();
		const { image: img } = this;
		resizeCanvas(ctx.canvas, img);
		const main = ctx;
		main.drawImage(img, 0, 0);
		this.textContent.forEach(t => {
			main.save();
			t.draw(main, brushManager);
			main.restore();
		});
		// const s2 = (performance.now() - startDraw) / 1000;
		// console.debug("Draw ", s2, 1 / s2);
	}
}

function calcFontSize(
	ctx: CanvasRenderingContext2D,
	lines: string[],
	font: FontSettings,
	box: RectangleSprite,
	cached = 0
): [number, number] {
	let maxLine = lines[0];
	let maxWidth = 0;
	lines.forEach(line => {
		const width = ctx.measureText(line).width;
		if (width > maxWidth) {
			maxLine = line;
			maxWidth = width;
		}
	});
	const memeWidth = box.width;
	const memeHeight = box.height;
	let fontSize = cached || memeHeight / lines.length;
	let totalHeight = 0;
	// TODO: optimization
	for (let i = 0; i < 500; i++) {
		ctx.font = fontSettingsToCSS(font, fontSize);
		const params = ctx.measureText(maxLine);
		const textWidth = params.width;
		const textHeight = lines.reduce((sum, l) => {
			const params = ctx.measureText(l);
			return sum + (params.actualBoundingBoxAscent + params.actualBoundingBoxDescent) + lineWidthByFontSize(fontSize);
		}, 0);
		totalHeight = textHeight;
		const percentW = textWidth / memeWidth;
		const percentH = textHeight / memeHeight;
		// console.log(memeWidth, textWidth, percent, fontSize);
		if (percentW > 1 || percentH > 1) {
			fontSize -= 1;
			continue;
		}
		if (percentW < 0.98 && percentH < 0.98) {
			fontSize += 1;
			continue;
		}
		break;
	}
	return [fontSize, totalHeight];
}
