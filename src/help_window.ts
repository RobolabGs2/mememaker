import * as HTML from "./html";

export class HelpWindow {
	readonly element: HTMLElement;
	readonly content: HTMLElement;
	constructor(parent: HTMLElement = document.body, readonly onHide: () => void) {
		this.element = HTML.CreateElement(
			"article",
			HTML.AppendTo(parent),
			HTML.SetStyles(style => {
				style.position = "absolute";
				style.cursor = "pointer";
				style.top = "0";
				style.right = "0";
				style.width = "100%";
				style.height = "100%";
				style.backgroundColor = "#CCCCCCAA";
				style.zIndex = "100";
				style.backgroundRepeat = "no-repeat";
				style.backgroundPosition = "50% 50%";
				style.display = "none";
				style.alignItems = "center";
				style.justifyContent = "space-around";
			})
		);
		this.content = HTML.CreateElement(
			"section",
			HTML.AppendTo(this.element),
			HTML.AddClass("markdown-body"),
			HTML.SetStyles(style => {
				style.cursor = "default";
				style.height = "100%";
				style.boxSizing = "border-box";
				style.width = "80%";
				style.maxWidth = "752px";
				style.backgroundColor = "black";
				style.color = "white";
				style.paddingBottom = "32px";
				style.zIndex = "101";
				style.padding = "8px 16px";
				style.overflowY = "scroll";
			})
		);
		this.element.addEventListener("click", ev => {
			if (ev.target !== this.element) return;
			ev.preventDefault();
			this.hide();
		});
	}
	show(html: string) {
		this.content.innerHTML = html;
		this.element.style.display = "flex";
	}
	hide() {
		this.element.style.display = "none";
		this.onHide();
	}
}
