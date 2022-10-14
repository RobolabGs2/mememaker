import { TextStylePrototype, fontSettingsToCSS, lineWidthByFontSize } from "./text_style";

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
	setupCtxForText(ctx: CanvasRenderingContext2D, style: TextStylePrototype, fontSize: number) {
		ctx.textAlign = "center";
		ctx.lineJoin = "round";
		ctx.miterLimit = 2;
		const testString = "ЙДЁ";
		ctx.font = fontSettingsToCSS(style.font, fontSize);
		const testParams = ctx.measureText(testString);
		ctx.lineWidth = lineWidthByFontSize(fontSize);
		this.setBrush("fillStyle", ctx, style.fill, testParams);
		this.setBrush("strokeStyle", ctx, style.stroke, testParams);
	}
}

export interface BrushPath {
	type: "color" | "pattern";
	name: string;
	patternSettings: {
		scale: "font" | { x: number; y: number };
		rotate: number;
		shift: { x: number; y: number };
	};
}

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
