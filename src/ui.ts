import { BrushPath, CaseType, TextStylePrototype } from "./frame";
import * as HTML from "./html";
import styles from "./ui.scss";

export function TextSettingsInput(
	value: TextStylePrototype,
	onChange: () => void,
	resetValueEvent: (listener: (newValue: TextStylePrototype) => void) => void
) {
	const elemUpdators: ((value: TextStylePrototype) => void)[] = [];
	resetValueEvent(newValue => {
		value = newValue;
		elemUpdators.forEach(u => u(value));
	});
	const fontFamilies = ["Impact", "Lobster", "Arial"];
	const textCases = ["As is", "UPPER", "lower"] as CaseType[];
	return HTML.CreateElement(
		"article",
		HTML.AddClass(styles["text-settings__panel"]),
		HTML.Append(
			SwitchButton(
				value.font.italic,
				state => {
					value.font.italic = state;
					onChange();
				},
				update => elemUpdators.push(value => update(value.font.italic)),
				HTML.SetText("I", "Italic"),
				HTML.SetStyles(s => (s.fontStyle = "italic"))
			),
			SwitchButton(
				value.font.bold,
				state => {
					value.font.bold = state;
					onChange();
				},
				update => elemUpdators.push(value => update(value.font.bold)),
				HTML.SetText("B", "Bold"),
				HTML.SetStyles(s => (s.fontWeight = "bold"))
			),
			SwitchButton(
				value.font.smallCaps,
				state => {
					value.font.smallCaps = state;
					onChange();
				},
				update => elemUpdators.push(value => update(value.font.smallCaps)),
				HTML.SetText("Small Caps", "Small caps"),
				HTML.SetStyles(s => (s.fontVariant = "small-caps"))
			),
			HTML.CreateSelector<string, string>(
				value.font.family,
				fontFamilies,
				font => {
					value.font.family = font;
					onChange();
				},
				sel => {
					elemUpdators.push(value => (sel.selectedIndex = fontFamilies.findIndex(x => x === value.font.family)));
				},
				HTML.ModifyChildren(el => {
					const op = el as HTMLOptionElement;
					op.style.fontFamily = op.text;
				})
			),
			HTML.CreateSelector(
				value.case,
				textCases,
				state => {
					value.case = state;
					onChange();
				},
				sel => {
					elemUpdators.push(value => (sel.selectedIndex = textCases.findIndex(x => x === value.case)));
				}
			)
		)
	);
}

function SwitchButton(
	defaultState: boolean,
	onChange: (newState: boolean) => void,
	updateStateEvent: (listener: (newState: boolean) => void) => void,
	...modify: ((t: HTMLButtonElement) => void)[]
) {
	let state = defaultState;

	const updateStateElement = (el: HTMLButtonElement): boolean =>
		el.classList.toggle(styles["switcher-button__button_enabled_true"], state);
	return HTML.CreateElement(
		"button",
		HTML.AddClass(styles["switcher-button__button"]),
		updateStateElement,
		el =>
			updateStateEvent(newState => {
				state = newState;
				updateStateElement(el);
			}),
		HTML.AddEventListener("click", function () {
			state = !state;
			onChange(state);
			this.classList.toggle(styles["switcher-button__button_enabled_true"], state);
		}),
		...modify
	);
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
					),
					HTML.CreateElement(
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
					)
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
