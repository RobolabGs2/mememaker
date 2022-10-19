import * as HTML from "../../html";
import { PointInput } from "./point_input";
import { SwitchButton } from "./switch_button";
import styles from "./ui.module.scss";
import { ColorInput } from "./color_input";
import { NumberInput } from "./number_input";
import { PatchData, BatchPatchData, ChangedData, DelegatePatch } from "../../patch";
import { ObjectInputComponent } from "./input_component";
import { ShadowSettings } from "../../text_style";

export class ShadowInput implements ObjectInputComponent<ShadowSettings> {
	inputs = {
		enabled: new SwitchButton(HTML.SetText("Shadow", "Shadow")),
		blur: new NumberInput(HTML.SetNumberInputRange(0)),
		color: new ColorInput(HTML.SetStyles(s => (s.width = "100%"))),
		offset: new PointInput({ x: 0, y: 0 }),
	};
	settingsContainer: HTMLElement = HTML.CreateElement(
		"section",
		HTML.Append(
			HTML.CreateElement(
				"section",
				HTML.AddClass(styles["text-settings__panel"]),
				HTML.Append(HTML.CreateElement("span", HTML.SetText("Color: ")), this.inputs.color)
			),
			HTML.CreateElement(
				"section",
				HTML.AddClass(styles["text-settings__panel"]),
				HTML.Append(HTML.CreateElement("span", HTML.SetText("Offset: ")), this.inputs.offset)
			),
			HTML.CreateElement(
				"section",
				HTML.AddClass(styles["text-settings__panel"]),
				HTML.Append(HTML.CreateElement("span", HTML.SetText("Blur: ")), this.inputs.blur)
			)
		)
	);
	element: HTMLElement;

	update(newState: ShadowSettings) {
		this.inputs.enabled.update(newState.enabled == true);
		this.settingsContainer.hidden = !newState.enabled;
		this.inputs.blur.update(newState.blur);
		this.inputs.color.update(newState.color);
		this.inputs.offset.update(newState.offset);
	}

	constructor(public onChange: (state: PatchData<ShadowSettings>) => void) {
		this.element = HTML.CreateElement(
			"article",
			HTML.AddClass(styles["text-settings__stack"]),
			HTML.Append(this.inputs.enabled, this.settingsContainer)
		);
		this.inputs.enabled.onChange = enabled => {
			this.onChange?.(new BatchPatchData(new ChangedData(["enabled"], enabled)));
			this.settingsContainer.hidden = !enabled;
		};
		this.inputs.color.onChange = n => this.onChange?.(new ChangedData(["color"], n));
		this.inputs.blur.onChange = n => this.onChange?.(new ChangedData(["blur"], n));
		this.inputs.offset.onChange = n => this.onChange?.(new DelegatePatch(["offset"], n));
	}
}
