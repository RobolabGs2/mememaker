import { BrushManager } from "./brush";
import { RectangleSprite } from "./graphics/sprite";
import {
	TextStylePrototype,
	textToCase,
	FontSettings,
	lineWidthByFontSize,
	fontSettingsToCSS,
	DefaultStyle,
	setupShadow,
	RecursivePartial,
	mergePartials,
} from "./text_style";
import { loadSettingsFromURL } from "./url_parser";

const globalSettings = loadSettingsFromURL({
	drawDebug: false,
});
const MAX_HEIGHT_TEXT_EXAMPLE =
	"AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZzАаБбВвГгДдЕеЁёЖжЗзИиЙйКкЛлМмНнОоПпРрСсТтУуФфХхЦцЧчШшЩщЪъЫыЬьЭэЮюЯя";

export type RectangleSide = Record<"right" | "left" | "top" | "bottom" | "center" | "none", boolean>;

export class Line {
	constructor(readonly p1: Point, readonly p2: Point) {}
}

interface Point {
	x: number;
	y: number;
}

export function resizeCanvas(canvas: HTMLCanvasElement, size: { width: number; height: number }) {
	if (canvas.width !== size.width) canvas.width = size.width;
	if (canvas.height !== size.height) canvas.height = size.height;
}

export class TextContent {
	public static defaultStyle = DefaultStyle();
	public style: TextStylePrototype;
	constructor(
		public box: RectangleSprite,
		public text: string,
		style: RecursivePartial<TextStylePrototype>,
		public main = false
	) {
		this.style = mergePartials(TextContent.defaultStyle, style);
	}
	draw(ctx: CanvasRenderingContext2D, brushManager: BrushManager): void {
		ctx.textAlign = "center";
		const text = textToCase(this.text, this.style.case).split("\n");
		const { lines, fontSize } = this.getTextCoords(ctx, text);
		brushManager.setupCtxForText(ctx, this.style, fontSize);
		setupShadow(ctx, this.style.shadow);
		if (!this.main) {
			ctx.translate(this.box.x, this.box.y);
			ctx.rotate(this.box.transform.rotate);
			ctx.translate(-this.box.x, -this.box.y);
		}
		text.forEach((line, i) => {
			const { x, y } = lines[i];
			ctx.strokeText(line, x, y);
			ctx.fillText(line, x, y);
			if (globalSettings.drawDebug) {
				drawBoundsOfText(ctx, x, y, line, fontSize, this.style);
				brushManager.setupCtxForText(ctx, this.style, fontSize);
			}
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
		const lineWidth = lineWidthByFontSize(fontSize, this.style);
		const testParams = ctx.measureText(MAX_HEIGHT_TEXT_EXAMPLE);
		const fullHeight =
			testParams.actualBoundingBoxAscent +
			testParams.actualBoundingBoxDescent +
			lineWidth * this.style.experimental.lineSpacingCoefficient;
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
		box: RectangleSprite
	): { lines: Point[]; fontSize: number } {
		const [fontSize, totalHeight] = calcFontSize(ctx, text, font, this.box, this.style);
		ctx.font = fontSettingsToCSS(font, fontSize);
		const lineWidth = lineWidthByFontSize(fontSize, this.style);
		const x = box.x - lineWidth / 2;
		let prevY = box.top + lineWidth / 2;
		if (totalHeight < box.height) {
			prevY += (box.height - totalHeight) / 2;
		}
		const exampleParams = ctx.measureText(MAX_HEIGHT_TEXT_EXAMPLE);
		const lines = text.map(t => {
			const params = ctx.measureText(t);
			const y = prevY + exampleParams.actualBoundingBoxAscent;
			prevY = y + exampleParams.actualBoundingBoxDescent + lineWidth * this.style.experimental.lineSpacingCoefficient;
			const textWidth = params.actualBoundingBoxLeft + params.actualBoundingBoxRight;
			const shiftX = textWidth / 2 - params.actualBoundingBoxLeft - lineWidth / 2;
			return { x: x - shiftX, y };
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
	style: TextStylePrototype
): [number, number] {
	let maxLine = lines[0];
	{
		let maxWidth = 0;
		lines.forEach(line => {
			const params = ctx.measureText(line);
			const width = params.actualBoundingBoxLeft + params.actualBoundingBoxRight;
			if (width > maxWidth) {
				maxLine = line;
				maxWidth = width;
			}
		});
	}
	const memeWidth = Math.abs(box.width);
	const memeHeight = Math.abs(box.height);
	if (memeHeight < 2 || memeWidth < 2) return [0, memeHeight];
	const dx = style.experimental.interpolationPoint;
	const maxLineWidth = lineWidthByFontSize(dx, style);
	ctx.font = fontSettingsToCSS(font, dx);
	const maxParam = ctx.measureText(maxLine);
	const maxExample = ctx.measureText(MAX_HEIGHT_TEXT_EXAMPLE);
	const dWidth = maxParam.actualBoundingBoxLeft + maxParam.actualBoundingBoxRight + maxLineWidth;
	const dHeight =
		(maxExample.actualBoundingBoxAscent +
			maxExample.actualBoundingBoxDescent +
			maxLineWidth * style.experimental.lineSpacingCoefficient) *
		lines.length;

	const kWidth = dWidth / dx;
	const kHeight = dHeight / dx;
	const xWidthCandidate = Math.round(memeWidth / kWidth);
	const xHeightCandidate = Math.round(memeHeight / kHeight);

	const fontSize = Math.min(xHeightCandidate, xWidthCandidate);
	const totalHeight = fontSize * kHeight;
	return [fontSize, totalHeight];
}

function drawBoundsOfText(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	line: string,
	fontSize: number,
	style: TextStylePrototype
) {
	const params = ctx.measureText(line);
	ctx.strokeStyle = "#FF0000";
	ctx.lineWidth = 1;
	ctx.strokeRect(
		x - params.actualBoundingBoxLeft,
		y - params.actualBoundingBoxAscent,
		params.actualBoundingBoxLeft + params.actualBoundingBoxRight,
		params.actualBoundingBoxAscent + params.actualBoundingBoxDescent
	);
	ctx.strokeStyle = "#00FF00";
	ctx.beginPath();
	ctx.moveTo(x - params.actualBoundingBoxLeft, y);
	ctx.lineTo(x + params.actualBoundingBoxRight, y);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x, y - params.actualBoundingBoxAscent);
	ctx.lineTo(x, y + params.actualBoundingBoxDescent);
	ctx.stroke();
	ctx.strokeStyle = "#FF00FF";
	ctx.lineWidth = 1;
	const w = lineWidthByFontSize(fontSize, style);
	ctx.strokeRect(
		x - params.actualBoundingBoxLeft - w / 2,
		y - params.actualBoundingBoxAscent - w / 2,
		params.actualBoundingBoxLeft + params.actualBoundingBoxRight + w,
		params.actualBoundingBoxAscent + params.actualBoundingBoxDescent + w
	);
}
