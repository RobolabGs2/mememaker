// interface Brush {
//		(ctx: CanvasRenderingContext2D, text?: string): void;
// }

import { BrushManager } from "./brush";
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

export class Rectangle {
	constructor(public x: number, public y: number, public width: number, public height: number) {}
	public get left(): number {
		return this.x - this.width / 2;
	}
	public set left(n: number) {
		this.width = Math.abs((this.x - n) * 2);
	}
	public get right(): number {
		return this.x + this.width / 2;
	}
	public set right(n: number) {
		this.width = Math.abs((n - this.x) * 2);
	}
	public get top(): number {
		return this.y - this.height / 2;
	}
	public set top(n: number) {
		this.height = Math.abs((this.y - n) * 2);
	}
	public get bottom(): number {
		return this.y + this.height / 2;
	}
	public set bottom(n: number) {
		this.height = Math.abs((n - this.y) * 2);
	}
	public contains(x: number, y: number) {
		return !(x < this.left || this.right < x || y < this.top || y > this.bottom);
	}
}

export class ContentBox extends Rectangle {
	constructor(x: number, y: number, width: number, height: number) {
		super(x, y, width, height);
	}
	public rotation = Math.PI / 4;
	draw(ctx: CanvasRenderingContext2D, color: string, colorSelected: string, lineWidth = 2): void {
		ctx.translate(this.x, this.y);
		ctx.rotate(this.rotation);
		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.lineWidth = lineWidth;
		const left = -this.width / 2;
		const right = this.width / 2;
		const top = -this.height / 2;
		const bottom = this.height / 2;
		ctx.strokeRect(left, top, this.width, this.height);
		if (!this.selectedSides.none) {
			ctx.fillStyle = ctx.strokeStyle = colorSelected;
			ctx.lineWidth = lineWidth + 6;
			if (this.selectedSides.center) {
				this.updateCenter();
				ctx.fillRect(-this.center.width / 2, -this.center.height / 2, this.center.width, this.center.height);
			}
			if (this.selectedSides.top) {
				ctx.beginPath();
				ctx.moveTo(left, top);
				ctx.lineTo(right, top);
				ctx.stroke();
			}
			if (this.selectedSides.bottom) {
				ctx.beginPath();
				ctx.moveTo(left, bottom);
				ctx.lineTo(right, bottom);
				ctx.stroke();
			}
			if (this.selectedSides.left) {
				ctx.beginPath();
				ctx.moveTo(left, top);
				ctx.lineTo(left, bottom);
				ctx.stroke();
			}
			if (this.selectedSides.right) {
				ctx.beginPath();
				ctx.moveTo(right, top);
				ctx.lineTo(right, bottom);
				ctx.stroke();
			}
		}
	}
	private center = new Rectangle(0, 0, 0, 0);
	private selectedSides: RectangleSide = {
		bottom: false,
		left: false,
		right: false,
		top: false,
		center: false,
		none: true,
	};
	private updateCenter() {
		this.center.x = this.x;
		this.center.y = this.y;
		this.center.height = this.height / 2;
		this.center.width = this.width / 2;
	}
	checkPoint(x: number, y: number): RectangleSide {
		if ((this.selectedSides.none = !this.contains(x, y))) return this.selectedSides;
		this.updateCenter();
		this.selectedSides.center = this.center.contains(x, y);
		this.selectedSides.top = this.center.top > y;
		this.selectedSides.bottom = this.center.bottom < y;
		this.selectedSides.left = this.center.left > x;
		this.selectedSides.right = this.center.right < x;
		return this.selectedSides;
	}
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
	constructor(public box: ContentBox, public text: string, public style: TextStylePrototype, public main = false) {}
	draw(ctx: CanvasRenderingContext2D, brushManager: BrushManager): void {
		const text = textToCase(this.text, this.style.case).split("\n");
		const { lines, fontSize } = this.getTextCoords(ctx, text);
		brushManager.setupCtxForText(ctx, this.style, fontSize);
		if (!this.main) {
			ctx.translate(this.box.x, this.box.y);
			ctx.rotate(this.box.rotation);
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
	textInBox(
		ctx: CanvasRenderingContext2D,
		font: FontSettings,
		text: string[],
		box: ContentBox
	): { lines: Point[]; fontSize: number } {
		const [fontSize, totalHeight] = calcFontSize(ctx, text, font, this.box);
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
				new ContentBox(
					this.image.width / 2,
					this.image.height - (this.image.height * 0.34) / 2,
					this.image.width * 0.97,
					this.image.height * 0.34
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
	box: ContentBox
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
	let fontSize = memeHeight / lines.length;
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
