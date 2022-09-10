import * as HTML from "../../html";
import { InputComponent } from "./input_component";

export class NumberInput implements InputComponent<number> {
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
