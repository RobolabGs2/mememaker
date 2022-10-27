import * as HTML from "../../html";
import { PointInput } from "./point_input";
import { Selector } from "./selector";
import { SwitchButton } from "./switch_button";
import styles from "./ui.module.scss";
import { ColorInput } from "./color_input";
import { NumberInput } from "./number_input";
import { PatchData, BatchPatchData, ChangedData, DelegatePatch } from "../../patch";
import { ObjectInputComponent } from "./input_component";
import { BrushPath, BrushType } from "../../brush";

export class BrushInput implements ObjectInputComponent<BrushPath> {
	inputs = {
		type: new Selector({
			Цвет: "color",
			Паттерн: "pattern",
			Выключить: "none",
		}),
		pattern: new Selector(this.patterns),
		color: new ColorInput(HTML.SetStyles(s => (s.width = "100%"))),
		patternSettings: {
			scaleByFont: new SwitchButton(HTML.SetText("Авто", "Масштабирование по размеру текста")),
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
				HTML.Append(HTML.CreateElement("span", HTML.SetText("Паттерн: ")), this.inputs.pattern)
			),
			HTML.CreateElement(
				"section",
				HTML.AddClass(styles["text-settings__panel"]),
				HTML.Append(
					HTML.CreateElement("span", HTML.SetText("Поворот (в градусах): ")),
					this.inputs.patternSettings.rotate
				)
			),
			HTML.CreateElement(
				"section",
				HTML.AddClass(styles["text-settings__panel"]),
				HTML.Append(HTML.CreateElement("span", HTML.SetText("Сдвиг: ")), this.inputs.patternSettings.shift)
			),
			HTML.CreateElement(
				"section",
				HTML.AddClass(styles["text-settings__panel"]),
				HTML.Append(
					HTML.CreateElement("span", HTML.SetText("Масштаб: ")),
					this.inputs.patternSettings.scaleByFont,
					this.inputs.patternSettings.scale
				)
			)
		)
	);
	colorSettingsContainer: HTMLElement = HTML.CreateElement("section", HTML.Append(this.inputs.color));
	element: HTMLElement;

	set activeType(value: BrushType) {
		this.inputs.type.update(value);
		this.colorSettingsContainer.hidden = value !== "color";
		this.patternSettingsContainer.hidden = value !== "pattern";
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
