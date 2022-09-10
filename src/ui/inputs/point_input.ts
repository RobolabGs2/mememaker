import * as HTML from "../../html";
import styles from "./ui.module.scss";
import { NumberInput } from "./number_input";
import { ChangedData, PatchData } from "../../patch";
import { ObjectInputComponent } from "./input_component";

export interface Point {
	x: number;
	y: number;
}

export class PointInput implements ObjectInputComponent<Point> {
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
