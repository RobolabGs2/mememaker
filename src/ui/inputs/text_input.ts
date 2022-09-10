import { InputComponent } from "./input_component";

export default class TextInput implements InputComponent<string> {
	readonly element = document.createElement("textarea");
	constructor(public onChange: (newValue: string) => void, rows = 15) {
		this.element.rows = rows;
		this.element.addEventListener("input", () => {
			this.onChange?.(this.element.value);
		});
	}
	update(value: string): void {
		if (this.element !== document.activeElement) {
			this.element.value = value;
			return;
		}
		const position = this.element.selectionStart;
		const delta = value.length - this.element.value.length;
		this.element.value = value;
		this.element.selectionEnd = this.element.selectionStart = Math.min(position + delta, this.element.value.length);
	}
}
