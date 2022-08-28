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

class ContentBox {
	constructor(public x: number, public y: number, public width: number, public height: number) {}
	public get left(): number {
		return this.x - this.width / 2;
	}
	public get right(): number {
		return this.x + this.width / 2;
	}
	public get top(): number {
		return this.y - this.height / 2;
	}
	public get bottom(): number {
		return this.y + this.height / 2;
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

export class TextContent {
	constructor(public box: ContentBox, public text: string, public style: TextStylePrototype) {}
	draw(ctx: CanvasRenderingContext2D, brushManager: BrushManager): void {
		ctx.textAlign = "center";
		ctx.lineJoin = "round";
		ctx.miterLimit = 2;
		ctx.lineWidth = 14;
		const text = textToCase(this.text, this.style.case).split("\n");
		const fontSize = calcFontSize(ctx, text, this.style.font, this.box);
		console.log(fontSize);
		const testString = "ЙДЁ";
		const testParams = ctx.measureText(testString);
		const fullHeight = testParams.actualBoundingBoxAscent + testParams.actualBoundingBoxDescent;
		const y = this.box.bottom - fontSize / (1.8 + text.length * 0.5);
		const x = this.box.x;
		// console.log(x, y, text);
		// console.log(ctx.canvas.width, ctx.canvas.height);
		// console.log(this.box.left, this.box.top, this.box.width, this.box.height);
		// ctx.strokeRect(this.box.left, this.box.top, this.box.width, this.box.height);
		brushManager.setBrush("fillStyle", ctx, this.style.fill, testParams);
		brushManager.setBrush("strokeStyle", ctx, this.style.stroke, testParams);
		text.forEach((line, i) => {
			const ly = text.length == 1 ? y + fontSize / 3 : y - (text.length - i - 1) * fullHeight;
			ctx.strokeText(line, x, ly);
			ctx.fillText(line, x, ly);
		});
	}
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

export class Frame {
	constructor(public image: HTMLImageElement, public text: string) {}
	public textContent = new TextContent(
		new ContentBox(
			this.image.width / 2,
			this.image.height - (this.image.height * 0.34) / 2,
			this.image.width * 0.97,
			this.image.height * 0.34
		),
		this.text,
		{
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
		}
	);
	public preview?: HTMLImageElement; // TODO: think about it again
	draw(ctx: CanvasRenderingContext2D, brushManager: BrushManager) {
		const { image: img } = this;
		ctx.canvas.getClientRects();
		ctx.canvas.width = img.width;
		ctx.canvas.height = img.height;
		ctx.drawImage(img, 0, 0);
		// TODO update on change text
		this.textContent.text = this.text;
		this.textContent.box = new ContentBox(
			this.image.width / 2,
			this.image.height - (this.image.height * 0.34) / 2,
			this.image.width * 0.97,
			Math.min(this.image.height * 0.16 * this.text.split("\n").length, this.image.height * 0.34)
		);
		this.textContent.draw(ctx, brushManager);
		if (this.preview) {
			this.preview.src = ctx.canvas.toDataURL();
		}
	}
}

/*
// Вычисление размера content box
const initialFontSize = memeHeight * 0.1;
	const maxHeight = Math.min(memeHeight * 0.16, (memeHeight * 0.34) / lines.length);
*/

function calcFontSize(ctx: CanvasRenderingContext2D, lines: string[], font: FontSettings, box: ContentBox): number {
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
	const initialFontSize = memeHeight / lines.length;
	const maxHeight = memeHeight / lines.length;
	// const maxHeight = memeHeight * 0.16;
	let fontSize = initialFontSize;
	// TODO: optimization
	for (let i = 0; i < 500; i++) {
		ctx.font = fontSettingsToCSS(font, fontSize);
		const { width: textWidth } = ctx.measureText(maxLine);
		const percent = textWidth / memeWidth;
		// console.log(memeWidth, textWidth, percent, fontSize);
		if (percent > 1) {
			fontSize -= 1;
			continue;
		}
		if (percent < 0.98 && fontSize < maxHeight) {
			fontSize += 1;
			continue;
		}
		return fontSize;
	}
	return fontSize;
}
