import { BrushPath, TextStylePrototype } from "./frame";
import * as HTML from "./html";
import styles from "./ui.scss";

export function TextSettingsForm(
	fontFamilies: string[],
	onChange: (patch: PatchData<TextStylePrototype>) => void
): ObjectInputComponent<TextStylePrototype> {
	const inputs: Input<TextStylePrototype>[] = [
		new Input(
			["font", ["italic"]],
			new SwitchButton(
				HTML.SetText("I", "Italic"),
				HTML.SetStyles(s => (s.fontStyle = "italic"))
			)
		),
		new Input(
			["font", ["bold"]],
			new SwitchButton(
				HTML.SetText("B", "Bold"),
				HTML.SetStyles(s => (s.fontWeight = "bold"))
			)
		),
		new Input(
			["font", ["smallCaps"]],
			new SwitchButton(
				HTML.SetText("Small Caps", "Small caps"),
				HTML.SetStyles(s => (s.fontVariant = "small-caps"))
			)
		),
		new Input(
			["font", ["family"]],
			new Selector(
				fontFamilies,
				HTML.ModifyChildren(el => {
					const op = el as HTMLOptionElement;
					op.style.fontFamily = op.text;
				})
			)
		),
		new Input(["case"], new Selector(["UPPER", "lower", "As is"])),
	];
	inputs.forEach(value => (value.input.onChange = newValue => onChange(new ChangedData(value.path, newValue))));
	const update = (value: TextStylePrototype) =>
		inputs.forEach(input => input.input.update(getValueByPath(input.path, value)));
	const element = HTML.CreateElement(
		"article",
		HTML.AddClass(styles["text-settings__panel"]),
		HTML.Append(inputs.map(x => x.input.element))
	);
	return { element, update, onChange };
}

interface InputComponent<T, HTML extends HTMLElement = HTMLElement> {
	update(value: T): void;
	onChange?: (newValue: T) => void;
	readonly element: HTML;
}

interface ObjectInputComponent<T extends object> {
	update(value: T): void;
	onChange?: (patch: PatchData<T>) => void;
	readonly element: HTMLElement;
}

export interface PatchData<T extends object> {
	apply(object: T): void;
}

export class BatchPatchData<T extends object> implements PatchData<T> {
	private readonly patches: PatchData<T>[];
	constructor(...patches: PatchData<T>[]) {
		this.patches = patches;
	}
	apply(object: T): void {
		this.patches.forEach(p => p.apply(object));
	}
}

export class DelegatePatch<P extends object, Path extends PathInObject<P>, C extends object & TypeOfField<P, Path>>
	implements PatchData<P>
{
	constructor(readonly path: Path, readonly patch: PatchData<C>) {}
	apply(object: P): void {
		this.patch.apply(getValueByPath(this.path, object) as C);
	}
}

export class ChangedData<T extends object, P extends PathInObject<T> = PathInObject<T>> implements PatchData<T> {
	constructor(readonly path: P, readonly value: TypeOfField<T, P>) {}
	apply(object: T) {
		setValueByPath(this.path, this.value, object);
	}
}

class Input<T extends object, P extends PathInObject<T> = PathInObject<T>> {
	constructor(
		readonly path: P,
		readonly input: InputComponent<TypeOfField<T, P>>,
		onChange?: (patch: ChangedData<T, P>) => void
	) {
		if (onChange) input.onChange = value => onChange(new ChangedData(path, value));
	}
}

function setValueByPath<T extends object, P extends PathInObject<T>>(path: P, value: TypeOfField<T, P>, obj: T) {
	const head = path[0] as keyof T;
	if (path.length === 1) {
		obj[head] = value as T[keyof T];
		return;
	}
	const currentValue = obj[head];
	setValueByPath(path[1] as PathInObject<object>, value as never, currentValue as unknown as object);
}

function getValueByPath<T extends object, P extends PathInObject<T>>(path: P, obj: T): TypeOfField<T, P> {
	const head = path[0] as keyof T;
	const currentValue = obj[head];
	if (path.length === 1) {
		return obj[head] as TypeOfField<T, P>;
	}
	return getValueByPath(path[1] as PathInObject<object>, currentValue as unknown as object);
}

type PathInObject<O extends object, P extends keyof O = keyof O> = P extends string
	? O[P] extends object
		? [P, PathInObject<O[P]>] | [P]
		: [P]
	: never;

type TypeOfField<O extends object, Path extends PathInObject<O>> = Path extends [keyof O]
	? O[Path[0]]
	: Path extends [infer Head, infer Tail]
	? Head extends keyof O
		? O[Head] extends object
			? Tail extends PathInObject<O[Head]>
				? TypeOfField<O[Head], Tail>
				: never
			: never
		: never
	: never;

class SwitchButton implements InputComponent<boolean> {
	element: HTMLElement;
	constructor(...modify: ((t: HTMLButtonElement) => void)[]) {
		this.element = HTML.CreateElement(
			"button",
			HTML.AddClass(styles["switcher-button__button"]),
			HTML.AddEventListener("click", () => {
				this.update(!this.value);
				this.onChange?.(this.value);
			}),
			...modify
		);
	}
	onChange?: (newValue: boolean) => void;
	private value = false;
	update(newState: boolean) {
		this.element.classList.toggle(styles["switcher-button__button_enabled_true"], newState);
		this.value = newState;
	}
}

class Selector<T extends string> implements InputComponent<T, HTMLSelectElement> {
	constructor(readonly states: T[], ...modify: ((t: HTMLSelectElement) => void)[]) {
		this.element = HTML.CreateSelector(
			states[0],
			states,
			newValue => {
				this.onChange?.(newValue);
			},
			...modify
		);
	}
	update(value: T): void {
		this.element.selectedIndex = this.states.findIndex(v => v === value);
	}
	onChange?: ((newValue: T) => void) | undefined;
	element: HTMLSelectElement;
}

export class BrushInput implements ObjectInputComponent<BrushPath> {
	inputs = {
		type: new Selector(["color", "pattern"]),
		pattern: new Selector(this.patterns),
		color: new ColorInput(HTML.SetStyles(s => (s.width = "100%"))),
		patternSettings: {
			scaleByFont: new SwitchButton(HTML.SetText("By font", "Auto scale by font size")),
			scale: new PointInput({ x: 1, y: 1 }),
			rotate: new NumberInput(HTML.SetNumberInputRange(0, 360, 0.5)),
			shift: new PointInput(),
		},
	};
	patternSettingsContainer: HTMLElement = HTML.CreateElement(
		"section",
		HTML.Append(
			HTML.CreateElement(
				"section",
				HTML.AddClass(styles["text-settings__panel"]),
				HTML.Append(HTML.CreateElement("span", HTML.SetText("Pattern: ")), this.inputs.pattern)
			),
			HTML.CreateElement(
				"section",
				HTML.AddClass(styles["text-settings__panel"]),
				HTML.Append(HTML.CreateElement("span", HTML.SetText("Rotate (degrees): ")), this.inputs.patternSettings.rotate)
			),
			HTML.CreateElement(
				"section",
				HTML.AddClass(styles["text-settings__panel"]),
				HTML.Append(HTML.CreateElement("span", HTML.SetText("Shift: ")), this.inputs.patternSettings.shift)
			),
			HTML.CreateElement(
				"section",
				HTML.AddClass(styles["text-settings__panel"]),
				HTML.Append(
					HTML.CreateElement("span", HTML.SetText("Scale: ")),
					this.inputs.patternSettings.scaleByFont,
					this.inputs.patternSettings.scale
				)
			)
		)
	);
	colorSettingsContainer: HTMLElement = HTML.CreateElement("section", HTML.Append(this.inputs.color));
	element: HTMLElement;

	set activeType(value: "color" | "pattern") {
		this.inputs.type.update(value);
		if (value === "color") {
			this.colorSettingsContainer.hidden = false;
			this.patternSettingsContainer.hidden = true;
			return;
		}
		this.colorSettingsContainer.hidden = true;
		this.patternSettingsContainer.hidden = false;
	}
	update(newState: BrushPath) {
		this.activeType = newState.type;
		if (newState.type === "color") {
			this.inputs.color.update(newState.name);
		} else {
			this.inputs.pattern.update(newState.name);
		}
		this.updateScale(newState.patternSettings.scale);
		this.inputs.patternSettings.rotate.update(newState.patternSettings.rotate);
		this.inputs.patternSettings.shift.update(newState.patternSettings.shift);
	}

	constructor(
		public onChange: (state: PatchData<BrushPath>) => void,
		readonly patterns: string[],
		defaultColor: string
	) {
		this.element = HTML.CreateElement(
			"article",
			HTML.AddClass(styles["text-settings__stack"]),
			HTML.Append(this.inputs.type, this.colorSettingsContainer, this.patternSettingsContainer)
		);
		this.inputs.type.onChange = newType => {
			this.activeType = newType;
			if (newType === "color") {
				this.onChange?.(
					new BatchPatchData(new ChangedData(["type"], newType), new ChangedData(["name"], defaultColor))
				);
				this.inputs.color.update(defaultColor);
				return;
			}
			this.onChange?.(new BatchPatchData(new ChangedData(["type"], newType), new ChangedData(["name"], patterns[0])));
			this.inputs.pattern.update(patterns[0]);
		};
		this.inputs.color.onChange = n => this.onChange?.(new ChangedData(["name"], n));
		this.inputs.pattern.onChange = n => this.onChange?.(new ChangedData(["name"], n));
		this.inputs.patternSettings.scaleByFont.onChange = scaleByFont => {
			if (scaleByFont) {
				this.updateScale("font");
				this.onChange?.(new ChangedData(["patternSettings", ["scale"]], "font"));
				return;
			}
			const point = { x: 1, y: 1 };
			this.updateScale(point);
			this.onChange?.(new ChangedData(["patternSettings", ["scale"]], point));
		};
		this.inputs.patternSettings.rotate.onChange = n =>
			this.onChange?.(new ChangedData(["patternSettings", ["rotate"]], n));
		this.inputs.patternSettings.shift.onChange = n =>
			this.onChange?.(new DelegatePatch(["patternSettings", ["shift"]], n));
		this.inputs.patternSettings.scale.onChange = n =>
			this.onChange?.(new DelegatePatch(["patternSettings", ["scale"]], n));
	}

	private updateScale(newScale: "font" | { x: number; y: number }) {
		const scaleByFont = newScale === "font";
		this.inputs.patternSettings.scaleByFont.update(scaleByFont);
		this.inputs.patternSettings.scale.disabled = scaleByFont;
		this.inputs.patternSettings.scale.update(scaleByFont ? { x: 1, y: 1 } : newScale);
	}
}

class NumberInput implements InputComponent<number> {
	constructor(...modifications: ((el: HTMLInputElement) => void)[]) {
		this.element = HTML.CreateElement(
			"input",
			HTML.SetInputType("number"),
			HTML.AddEventListener("change", () => {
				this.onChange?.(this.element.valueAsNumber);
			}),
			...modifications
		);
	}
	update(value: number): void {
		this.element.valueAsNumber = value;
	}
	onChange?: ((newValue: number) => void) | undefined;
	element: HTMLInputElement;
	set disabled(value: boolean) {
		this.element.disabled = value;
	}
	get disabled(): boolean {
		return this.element.disabled;
	}
}

class ColorInput implements InputComponent<string> {
	constructor(...modifications: ((el: HTMLInputElement) => void)[]) {
		this.element = HTML.CreateElement(
			"input",
			HTML.SetInputType("color"),
			HTML.AddEventListener("change", () => {
				this.onChange?.(this.element.value);
			}),
			...modifications
		);
	}
	update(value: string): void {
		this.element.value = value;
	}
	onChange?: ((newValue: string) => void) | undefined;
	element: HTMLInputElement;
	set disabled(value: boolean) {
		this.element.disabled = value;
	}
	get disabled(): boolean {
		return this.element.disabled;
	}
}

interface Point {
	x: number;
	y: number;
}

class PointInput implements ObjectInputComponent<Point> {
	constructor(defaults = { x: 0, y: 0 }) {
		this.update(defaults);
		this.element = HTML.CreateElement(
			"article",
			HTML.AddClass(styles["point-input__container"]),
			HTML.Append(
				HTML.CreateElement("span", HTML.SetText("X:")),
				this.xInput.element,
				HTML.CreateElement("span", HTML.SetText("Y:")),
				this.yInput.element
			)
		);
		const xKey = ["x"] as ["x"];
		const yKey = ["y"] as ["y"];
		this.xInput.onChange = x => this.onChange?.(new ChangedData(xKey, x));
		this.yInput.onChange = y => this.onChange?.(new ChangedData(yKey, y));
	}
	update(value: Point): void {
		this.xInput.update(value.x);
		this.yInput.update(value.y);
	}
	onChange?: ((patch: PatchData<Point>) => void) | undefined;
	element: HTMLElement;
	xInput = new NumberInput(HTML.AddClass(styles["point-input__input"]));
	yInput = new NumberInput(HTML.AddClass(styles["point-input__input"]));
	set disabled(value: boolean) {
		this.xInput.disabled = value;
		this.yInput.disabled = value;
	}
	get disabled(): boolean {
		return this.xInput.disabled;
	}
}
