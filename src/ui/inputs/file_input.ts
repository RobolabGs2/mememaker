import * as HTML from "../../html";

export default class FilesInput {
	readonly element = HTML.CreateElement("input", HTML.SetInputType("file"));
	constructor(accept: string, onChange: (files: File[]) => void) {
		this.element.style.width = "100%";
		this.element.accept = accept;
		this.element.addEventListener("change", () => {
			const items = this.element.files;
			if (!items || items.length === 0) return;
			onChange(Array.from(items));
		});
	}
}
