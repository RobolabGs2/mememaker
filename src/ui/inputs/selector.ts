import * as HTML from "../../html";
import { InputComponent } from "./input_component";

export class Selector<T extends string> implements InputComponent<T, HTMLSelectElement> {
	readonly states: T[];
	constructor(states: Record<string, T> | T[], ...modify: ((t: HTMLSelectElement) => void)[]) {
		this.states = Object.values(states);
		this.element = HTML.CreateSelector(
			this.states[0],
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
