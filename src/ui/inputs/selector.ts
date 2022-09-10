import * as HTML from "../../html";
import { InputComponent } from "./input_component";

export class Selector<T extends string> implements InputComponent<T, HTMLSelectElement> {
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
