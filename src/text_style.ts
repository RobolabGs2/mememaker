import { BrushPath } from "./brush";
import Point from "./geometry/point";

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
	shadow: ShadowSettings;
	experimental: ExperimentalSettings;
}

export interface ExperimentalSettings {
	lineWidthCoefficient: number;
	lineSpacingCoefficient: number;
	interpolationPoint: number;
}

export interface ShadowSettings {
	enabled?: boolean;
	blur: number; // 0 <= blur
	color: string;
	offset: Point;
}

export function setupShadow(ctx: CanvasRenderingContext2D, settings: ShadowSettings) {
	const { enabled, blur, color, offset } = settings;
	ctx.shadowBlur = enabled ? blur : 0;
	ctx.shadowColor = enabled ? color : "#00000000";
	if (enabled) {
		ctx.shadowOffsetX = offset.x;
		ctx.shadowOffsetY = offset.y;
	}
}

function isObject(a: unknown): a is object {
	return a !== null && typeof a === "object";
}

export function mergePartials<T extends object>(defaults: T, overrides: RecursivePartial<T>): T {
	for (const x in defaults) {
		const actual = overrides[x];
		const defaultValue = defaults[x];
		if (isObject(defaultValue)) {
			overrides[x] = mergePartials(defaultValue, actual || {}) as any;
		} else if (actual === undefined) {
			overrides[x] = defaultValue as any;
		}
	}
	return overrides as T;
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
		shadow: {
			enabled: false,
			color: "#000000",
			blur: 10,
			offset: { x: 0, y: 0 },
		},
		experimental: {
			lineSpacingCoefficient: 0.5,
			lineWidthCoefficient: 0.1385,
			interpolationPoint: 100,
		},
	};
}

export function lineWidthByFontSize(fontSize: number, style: TextStylePrototype): number {
	return Math.ceil(style.experimental.lineWidthCoefficient * fontSize);
}
