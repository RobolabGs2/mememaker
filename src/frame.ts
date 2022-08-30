import { DrawContext } from "./app";

export interface BrushPath {
	type: "color" | "pattern";
	name: string;
	patternSettings: {
		scale: "font" | { x: number; y: number };
		rotate: number;
		shift: { x: number; y: number };
	};
}

// interface Brush {
//		(ctx: CanvasRenderingContext2D, text?: string): void;
// }

// class MemeProject {
// frames: Frame[];
// brushes: Record<string, Record<string, Brush<unknown>>>;
// }

export function mapRecord<K extends string, T1, T2>(
	record: Record<K, T1>,
	map: (value: T1, key: K) => T2
): Record<K, T2> {
	return Object.fromEntries(
		Object.entries<T1>(record).map(([key, value]) => {
			return [key, map(value, key as K)];
		})
	) as Record<K, T2>;
}

export type RectangleSide = Record<"right" | "left" | "top" | "bottom" | "center" | "none", boolean>;

class Rectangle {
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

	draw(ctx: CanvasRenderingContext2D, color: string, colorSelected: string, lineWidth = 2): void {
		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.lineWidth = lineWidth;
		ctx.strokeRect(this.left, this.top, this.width, this.height);
		if (!this.selectedSides.none) {
			ctx.fillStyle = ctx.strokeStyle = colorSelected;
			ctx.lineWidth = lineWidth + 6;
			if (this.selectedSides.center) {
				this.updateCenter();
				ctx.fillRect(this.center.left, this.center.top, this.center.width, this.center.height);
			}
			if (this.selectedSides.top) {
				ctx.beginPath();
				ctx.moveTo(this.left, this.top);
				ctx.lineTo(this.right, this.top);
				ctx.stroke();
			}
			if (this.selectedSides.bottom) {
				ctx.beginPath();
				ctx.moveTo(this.left, this.bottom);
				ctx.lineTo(this.right, this.bottom);
				ctx.stroke();
			}
			if (this.selectedSides.left) {
				ctx.beginPath();
				ctx.moveTo(this.left, this.top);
				ctx.lineTo(this.left, this.bottom);
				ctx.stroke();
			}
			if (this.selectedSides.right) {
				ctx.beginPath();
				ctx.moveTo(this.right, this.top);
				ctx.lineTo(this.right, this.bottom);
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

export class BrushManager {
	constructor(ctx: CanvasRenderingContext2D, readonly patternsImages: Record<string, HTMLImageElement>) {
		this.patterns = mapRecord(patternsImages, img => ctx.createPattern(img, "repeat")!);
	}
	private patterns: Record<string, CanvasPattern>;
	setBrush(path: "fillStyle" | "strokeStyle", ctx: CanvasRenderingContext2D, brush: BrushPath, metrics: TextMetrics) {
		switch (brush.type) {
			case "color":
				ctx[path] = this.color(brush.name);
				break;
			case "pattern":
				ctx[path] = this.pattern(brush.name, brush.patternSettings, metrics);
				break;
			default:
				throw new Error(`Unknown brush type: ${brush.type} with name ${brush.name}`);
		}
	}
	color(name: string) {
		return name;
	}
	pattern(name: string, settings: BrushPath["patternSettings"], metrics: TextMetrics) {
		const pattern = this.patterns[name];
		const transform = new DOMMatrix();
		transform.translateSelf(settings.shift.x, settings.shift.y);
		transform.rotateSelf(0, 0, settings.rotate);
		if (settings.scale === "font")
			transform.scaleSelf(
				1,
				(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) / this.patternsImages[name].height
			);
		else transform.scaleSelf(settings.scale.x, settings.scale.y);
		pattern.setTransform(transform);
		return pattern;
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

function lineWidthByFontSize(fontSize: number): number {
	return Math.ceil((18 / 130) * fontSize);
}

export class TextContent {
	constructor(public box: ContentBox, public text: string, public style: TextStylePrototype, public main = false) {}
	draw(ctx: CanvasRenderingContext2D, brushManager: BrushManager): void {
		ctx.textAlign = "center";
		ctx.lineJoin = "round";
		ctx.miterLimit = 2;
		const text = textToCase(this.text, this.style.case).split("\n");
		const { lines, fontSize } = this.getTextCoords(ctx, text);
		const testString = "ЙДЁ";
		ctx.font = fontSettingsToCSS(this.style.font, fontSize);
		console.log(fontSize, text);
		const testParams = ctx.measureText(testString);
		ctx.lineWidth = lineWidthByFontSize(fontSize);
		brushManager.setBrush("fillStyle", ctx, this.style.fill, testParams);
		brushManager.setBrush("strokeStyle", ctx, this.style.stroke, testParams);
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

export type RecursivePartial<T> = {
	[P in keyof T]?: T[P] extends (infer U)[]
		? RecursivePartial<U>[]
		: T[P] extends object
		? RecursivePartial<T[P]>
		: T[P];
};
export type CaseType = "As is" | "UPPER" | "lower";

function textToCase(text: string, textCase: CaseType): string {
	switch (textCase) {
		case "As is":
			return text;
		case "UPPER":
			return text.toUpperCase();
		case "lower":
			return text.toLowerCase();
	}
	throw new Error(`Unsupported text case type: ${textCase}`);
}

export interface TextStylePrototype {
	name: string;
	font: FontSettings;
	case: CaseType;
	fill: BrushPath;
	stroke: BrushPath;
}

export class TextStyle implements TextStylePrototype {
	private _case?: CaseType;
	private _font: RecursivePartial<FontSettings> = {};
	private _fill: RecursivePartial<BrushPath> = {};
	private _stroke: RecursivePartial<BrushPath> = {};
	private _fontProxy = WrapPrototype(this.parent.font, this._font);
	private _fillProxy = WrapPrototype(this.parent.fill, this._fill);
	private _strokeProxy = WrapPrototype(this.parent.stroke, this._stroke);

	constructor(public name: string, private _parent: TextStyle) {}

	public get parent(): TextStyle {
		return this._parent;
	}
	public set parent(p: TextStyle) {
		this._parent = p;
		this._fontProxy.parent = p.font;
		this._fillProxy.parent = p.fill;
		this._strokeProxy.parent = p.stroke;
	}
	public get font(): FontSettings {
		return this._fontProxy.proxy;
	}
	public set font(value: FontSettings) {
		this._font = this._fontProxy.overrides = value;
	}
	public get fill(): BrushPath {
		return this._fillProxy.proxy;
	}
	public set fill(value: BrushPath) {
		this._fill = this._fillProxy.overrides = value;
	}
	public get stroke(): BrushPath {
		return this._strokeProxy.proxy;
	}
	public set stroke(value: BrushPath) {
		this._stroke = this._strokeProxy.overrides = value;
	}
	public get case(): CaseType {
		return this._case ? this._case : this.parent.case;
	}
	public set case(v: CaseType) {
		if (this.parent.case === v) {
			this._case = undefined;
		}
		this._case = v;
	}
}

function WrapPrototype<T extends object>(
	parent: T,
	overrides: RecursivePartial<T>
): { proxy: T; parent: T; overrides: RecursivePartial<T> } {
	const res = { parent, proxy: parent, overrides };
	res.proxy = new Proxy<T>(parent, {
		get(target, p) {
			if (Reflect.has(res.overrides, p)) {
				return Reflect.get(res.overrides, p);
			}
			return Reflect.get(res.parent, p);
		},
		set(target, p, value) {
			if (Reflect.has(res.parent, p)) {
				return Reflect.set(res.overrides, p, value);
			}
			throw new Error(`field ${p.toString()} cannot be set`);
		},
	});
	return res;
}

interface FontSettings {
	italic: boolean;
	smallCaps: boolean;
	bold: boolean;
	family: string;
}

function fontSettingsToCSS({ italic, smallCaps, bold, family }: FontSettings, size: number) {
	const style = italic ? "italic" : "normal";
	const variant = smallCaps ? "small-caps" : "normal";
	const weight = bold ? "bold" : "normal";
	return `${style} ${variant} ${weight} ${size}px ${family}`;
}

class FontSettings {
	constructor({ italic, smallCaps, bold, family }: FontSettings) {
		this.italic = italic;
		this.smallCaps = smallCaps;
		this.bold = bold;
		this.family = family;
	}
	italic: boolean;
	smallCaps: boolean;
	bold: boolean;
	family: string;
}

export function DefaultStyle(): TextStylePrototype {
	return {
		case: "UPPER",
		fill: {
			name: "#ffffff",
			type: "color",
			patternSettings: { rotate: 0, scale: { x: 1, y: 1 }, shift: { x: 0, y: 0 } },
		},
		stroke: {
			name: "#000000",
			type: "color",
			patternSettings: { rotate: 0, scale: { x: 1, y: 1 }, shift: { x: 0, y: 0 } },
		},
		name: "custom",
		font: {
			bold: false,
			family: "Impact",
			italic: false,
			smallCaps: false,
		},
	};
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
	public preview?: HTMLImageElement; // TODO: think about it again
	draw(ctx: DrawContext, brushManager: BrushManager) {
		const startDraw = performance.now();
		const { image: img } = this;
		ctx.width = img.width;
		ctx.height = img.height;
		ctx.main.drawImage(img, 0, 0);
		// TODO update on change text
		// this.textContent.box = new ContentBox(
		// 	this.image.width / 2,
		// 	this.image.height - (this.image.height * 0.34) / 2,
		// 	this.image.width * 0.97,
		// 	Math.min(this.image.height * 0.16 * this.text.split("\n").length, this.image.height * 0.34)
		// );
		this.textContent.forEach(t => t.draw(ctx.main, brushManager));
		const s2 = (performance.now() - startDraw) / 1000;
		console.debug("Draw ", s2, 1 / s2);
		// eslint-disable-next-line no-constant-condition
		if (this.preview) {
			const start = performance.now();
			this.preview.src = ctx.main.canvas.toDataURL();
			const s = (performance.now() - start) / 1000;
			console.debug("Image", s, 1 / s);
		}
		const s = (performance.now() - startDraw) / 1000;
		console.debug("Total", s, 1 / s);
	}
}

/*
// Вычисление размера content box
const initialFontSize = memeHeight * 0.1;
	const maxHeight = Math.min(memeHeight * 0.16, (memeHeight * 0.34) / lines.length);
*/

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
