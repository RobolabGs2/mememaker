import { BrushPath } from "./brush";

export type RecursivePartial<T> = {
	[P in keyof T]?: T[P] extends (infer U)[]
		? RecursivePartial<U>[]
		: T[P] extends object
		? RecursivePartial<T[P]>
		: T[P];
};
export type CaseType = "As is" | "UPPER" | "lower";

export function textToCase(text: string, textCase: CaseType): string {
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

export interface FontSettings {
	italic: boolean;
	smallCaps: boolean;
	bold: boolean;
	family: string;
}

export function fontSettingsToCSS({ italic, smallCaps, bold, family }: FontSettings, size: number) {
	const style = italic ? "italic" : "normal";
	const variant = smallCaps ? "small-caps" : "normal";
	const weight = bold ? "bold" : "normal";
	return `${style} ${variant} ${weight} ${size}px ${family}`;
}

export class FontSettings {
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

export function lineWidthByFontSize(fontSize: number): number {
	return Math.ceil((18 / 130) * fontSize);
}
