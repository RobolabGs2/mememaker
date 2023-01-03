import * as HTML from "../../html";
import styles from "./ui.module.scss";
import { NumberInput } from "./number_input";
import { PatchData, ChangedData } from "../../patch";
import { ObjectInputComponent } from "./input_component";
import { ExperimentalSettings } from "../../text_style";

export class ExperimentalInput implements ObjectInputComponent<ExperimentalSettings> {
	inputs = {
		lineWidthCoefficient: new NumberInput(HTML.SetNumberInputRange(0, Infinity, 0.01)),
		lineSpacingCoefficient: new NumberInput(HTML.SetNumberInputRange(-Infinity, +Infinity, 0.25)),
		interpolationPoint: new NumberInput(HTML.SetNumberInputRange(-Infinity, +Infinity, 1)),
	};
	settingsContainer: HTMLElement = HTML.CreateElement(
		"section",
		HTML.Append(
			HTML.CreateElement(
				"section",
				HTML.AddClass(styles["text-settings__panel"]),
				HTML.Append(HTML.CreateElement("span", HTML.SetText("Толщина обводки: ")), this.inputs.lineWidthCoefficient)
			),
			HTML.CreateElement(
				"section",
				HTML.AddClass(styles["text-settings__panel"]),
				HTML.Append(
					HTML.CreateElement("span", HTML.SetText("Коэффициент для интервала: ")),
					this.inputs.lineSpacingCoefficient
				)
			),
			HTML.CreateElement(
				"section",
				HTML.AddClass(styles["text-settings__panel"]),
				HTML.Append(
					HTML.CreateElement("span", HTML.SetText("Точка интерполяции шрифта: ")),
					this.inputs.interpolationPoint
				)
			)
		)
	);
	element: HTMLElement;

	update(newState: ExperimentalSettings) {
		this.inputs.lineSpacingCoefficient.update(newState.lineSpacingCoefficient);
		this.inputs.lineWidthCoefficient.update(newState.lineWidthCoefficient);
		this.inputs.interpolationPoint.update(newState.interpolationPoint);
	}

	constructor(public onChange: (state: PatchData<ExperimentalSettings>) => void) {
		this.element = HTML.CreateElement(
			"article",
			HTML.AddClass(styles["text-settings__stack"]),
			HTML.Append(this.settingsContainer)
		);
		this.inputs.lineSpacingCoefficient.onChange = n => this.onChange?.(new ChangedData(["lineSpacingCoefficient"], n));
		this.inputs.lineWidthCoefficient.onChange = n => this.onChange?.(new ChangedData(["lineWidthCoefficient"], n));
		this.inputs.interpolationPoint.onChange = n => this.onChange?.(new ChangedData(["interpolationPoint"], n));
	}
}
