import { TextStylePrototype } from "../../frame";
import * as HTML from "../../html";
import { PatchData, ChangedData, getValueByPath } from "../../patch";
import { ObjectInputComponent, Input } from "./input_component";
import { Selector } from "./selector";
import { SwitchButton } from "./switch_button";
import styles from "./ui.module.scss";

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
