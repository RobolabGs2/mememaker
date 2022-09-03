import { BrushPath, TextStylePrototype } from "./frame";
import * as HTML from "./html";
import styles from "./ui.scss";

export function TextSettingsForm(
	fontFamilies: string[],
	onChange: (patch: ChangedData<TextStylePrototype>) => void
): ObjectInputComponent<TextStylePrototype> {
	const inputs: Input<TextStylePrototype>[] = [
		new Input(
			["font", "italic"],
			new SwitchButton(
				HTML.SetText("I", "Italic"),
				HTML.SetStyles(s => (s.fontStyle = "italic"))
			)
		),
		new Input(
			["font", "bold"],
			new SwitchButton(
				HTML.SetText("B", "Bold"),
				HTML.SetStyles(s => (s.fontWeight = "bold"))
			)
		),
		new Input(
			["font", "smallCaps"],
			new SwitchButton(
				HTML.SetText("Small Caps", "Small caps"),
				HTML.SetStyles(s => (s.fontVariant = "small-caps"))
			)
		),
		new Input(
			["font", "family"],
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
	onChange?: (patch: ChangedData<T>) => void;
	readonly element: HTMLElement;
}

export class ChangedData<T extends object, P extends PathInObject<T> = PathInObject<T>> {
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
	if (!Array.isArray(path)) throw new Error(`Logic error: expected array path, actual: ${typeof path}, ${path}`);
	const head = path[0] as keyof T;
	const currentValue = obj[head];
	if (currentValue instanceof Object)
		setValueByPath(path.slice(1) as PathInObject<object>, value as never, currentValue as unknown as object);
	else obj[head] = value as T[keyof T];
}

function getValueByPath<T extends object, P extends PathInObject<T>>(path: P, obj: T): TypeOfField<T, P> {
	if (!Array.isArray(path)) throw new Error(`Logic error: expected array path, actual: ${typeof path}, ${path}`);
	const head = path[0] as keyof T;
	const currentValue = obj[head];
	if (currentValue instanceof Object)
		return getValueByPath(path.slice(1) as PathInObject<object>, currentValue as unknown as object);
	return currentValue as TypeOfField<T, P>;
}

type PathInObject<O extends object, P extends keyof O = keyof O> = P extends string
	? O[P] extends object
		? PathInObject<O[P]> extends unknown[]
			? [P, ...PathInObject<O[P]>]
			: never
		: [P]
	: unknown;

type TypeOfField<O extends object, Path extends PathInObject<O>> = Path extends [infer Head, ...infer Tail]
	? Head extends keyof O
		? O[Head] extends object
			? Tail extends PathInObject<O[Head]>
				? TypeOfField<O[Head], Tail>
				: never
			: O[Head]
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

export function BrushInput(
	value: BrushPath,
	onChange: () => void,
	resetValueEvent: (listener: (newValue: BrushPath) => void) => void,
	patterns: string[]
) {
	console.log(patterns);
	let scaleEnabled = typeof value.patternSettings.scale !== "string";
	let scale = scaleEnabled ? (value.patternSettings.scale as { x: number; y: number }) : { x: 1, y: 1 };
	resetValueEvent(newValue => {
		value = newValue;
		scaleEnabled = typeof value.patternSettings.scale !== "string";
		scale = !scaleEnabled ? { x: 1, y: 1 } : (value.patternSettings.scale as { x: number; y: number });
		scaleUpdate.forEach(l => l(scale, scaleEnabled));
	});
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	const scaleUpdate: ((scale: { x: number; y: number }, enable: boolean) => void)[] = [];
	const onTypeChange = new Array<(newType: "color" | "pattern") => void>();
	let lastPattern = patterns[0];
	let lastColor = value.name;
	setTimeout(() => onTypeChange.forEach(l => l(value.type)));
	return HTML.CreateElement(
		"article",
		HTML.AddClass(styles["text-settings__stack"]),
		HTML.Append(
			HTML.CreateSelector(
				value.type,
				["color", "pattern"],
				newType => {
					value.type = newType;
					if (newType === "pattern") {
						value.name = lastPattern;
					} else {
						value.name = lastColor;
					}
					onTypeChange.forEach(l => l(newType));
					onChange();
				},
				el => {
					resetValueEvent(newValue => {
						onTypeChange.forEach(l => l(newValue.type));
						el.selectedIndex = newValue.type === "color" ? 0 : 1;
					});
				}
			),
			HTML.CreateElement(
				"section",
				el => {
					onTypeChange.push(state => {
						el.hidden = state !== "color";
					});
				},
				HTML.Append(
					HTML.CreateElement(
						"input",
						HTML.SetInputType("color"),
						HTML.SetStyles(s => (s.width = "100%")),
						el => {
							if (typeof value.name !== "string") return;
							el.value = value.name;
							resetValueEvent(newValue => {
								value = newValue;
								if (value.type !== "color") return;
								lastColor = el.value = value.name;
							});
						},
						HTML.AddEventListener("change", function () {
							value.type = "color";
							lastColor = value.name = (this as HTMLInputElement).value;
							onChange();
						})
					)
				)
			),
			HTML.CreateElement(
				"section",
				el => {
					onTypeChange.push(state => {
						el.hidden = state !== "pattern";
					});
				},
				HTML.Append(
					HTML.CreateElement(
						"section",
						HTML.AddClass(styles["text-settings__panel"]),
						HTML.Append(
							HTML.CreateElement("span", HTML.SetText("Pattern: ")),
							HTML.CreateSelector(lastPattern, patterns, option => {
								value.type = "pattern";
								lastPattern = value.name = option;
								onChange();
							})
						)
					),
					HTML.CreateElement(
						"section",
						HTML.AddClass(styles["text-settings__panel"]),
						HTML.Append(
							HTML.CreateElement("span", HTML.SetText("Rotate (degrees): ")),
							HTML.CreateElement(
								"input",
								HTML.SetInputType("number"),
								HTML.SetNumberInputRange(0, 360, 0.5),
								el => {
									el.valueAsNumber = value.patternSettings.rotate;
									resetValueEvent(() => {
										el.valueAsNumber = value.patternSettings.rotate;
									});
								},
								HTML.AddEventListener("change", function () {
									const input = this as HTMLInputElement;
									value.patternSettings.rotate = input.valueAsNumber;
									onChange();
								})
							)
						)
					),
					HTML.CreateElement(
						"section",
						HTML.AddClass(styles["text-settings__panel"]),
						HTML.Append(
							HTML.CreateElement("span", HTML.SetText("Shift: ")),
							PointInput(
								value.patternSettings.shift,
								onChange,
								listener => {
									resetValueEvent(newValue => {
										listener(newValue.patternSettings.shift, true);
									});
								},
								true
							)
						)
					)
					/*HTML.CreateElement(
						"section",
						HTML.AddClass(styles["text-settings__panel"]),
						HTML.Append(
							HTML.CreateElement("span", HTML.SetText("Scale: ")),
							SwitchButton(
								!scaleEnabled,
								newState => {
									if (newState) {
										scaleEnabled = false;
										value.patternSettings.scale = "font";
									} else {
										scaleEnabled = true;
										value.patternSettings.scale = scale;
									}
									scaleUpdate.forEach(l => l(scale, scaleEnabled));
									onChange();
								},
								listener => {
									resetValueEvent(() => listener(!scaleEnabled));
								},
								HTML.SetText("By font", "Auto scale by font size")
							),
							PointInput(
								scale,
								onChange,
								listener => {
									scaleUpdate.push(listener);
								},
								scaleEnabled
							)
						)
					)*/
				)
			)
		)
	);
}

function PointInput(
	value: { x: number; y: number },
	onChange: () => void,
	resetValueEvent: (listener: (newValue: { x: number; y: number }, enabled: boolean) => void) => void,
	enabled = true
) {
	return HTML.CreateElement(
		"article",
		HTML.AddClass(styles["point-input__container"]),
		HTML.Append(
			HTML.CreateElement("span", HTML.SetText("X:")),
			HTML.CreateElement(
				"input",
				HTML.SetInputType("number"),
				HTML.AddClass(styles["point-input__input"]),
				HTML.AddEventListener("change", function () {
					const input = this as HTMLInputElement;
					value.x = input.valueAsNumber;
					onChange();
				}),
				el => {
					el.valueAsNumber = value.x;
					el.disabled = !enabled;
					resetValueEvent((newValue, enabled) => {
						value = newValue;
						el.valueAsNumber = value.x;
						el.disabled = !enabled;
					});
				}
			),
			HTML.CreateElement("span", HTML.SetText("Y:")),
			HTML.CreateElement(
				"input",
				HTML.SetInputType("number"),
				HTML.AddClass(styles["point-input__input"]),
				HTML.AddEventListener("change", function () {
					const input = this as HTMLInputElement;
					value.y = input.valueAsNumber;
					onChange();
				}),
				el => {
					el.valueAsNumber = value.y;
					el.disabled = !enabled;
					resetValueEvent((newValue, enabled) => {
						value = newValue;
						el.valueAsNumber = value.y;
						el.disabled = !enabled;
					});
				}
			)
		)
	);
}
