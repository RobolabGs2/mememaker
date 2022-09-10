import * as HTML from "../../html";
import { InputComponent } from "./input_component";
import styles from "./ui.module.scss";

export class SwitchButton implements InputComponent<boolean> {
	element: HTMLElement;
	constructor(...modify: ((t: HTMLButtonElement) => void)[]) {
		this.element = HTML.CreateElement(
			"button",
			HTML.AddClass(styles["switcher-button__button"]),
			HTML.AddEventListener("click", () => {
				this.update(!this.value);
				this.onChange?.(this.value);
			}),
			...modify
		);
	}
	onChange?: (newValue: boolean) => void;
	private value = false;
	update(newState: boolean) {
		this.element.classList.toggle(styles["switcher-button__button_enabled_true"], newState);
		this.value = newState;
	}
}
