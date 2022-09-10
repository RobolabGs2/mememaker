import * as HTML from "../../html";
import { InputComponent } from "./input_component";

export class ColorInput implements InputComponent<string> {
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
