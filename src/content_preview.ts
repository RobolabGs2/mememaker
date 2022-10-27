import * as HTML from "./html";
import { TextContent } from "./frame";
import { StateDiff, SetActiveText, RemoveContent, ShiftContent } from "./state";
import { BrushManager } from "./brush";
import Icons from "./ui/icons";

export class ContentPreview {
	private preview: HTMLDivElement;
	public readonly element: HTMLElement;
	constructor(readonly content: TextContent, onChange: (patch: StateDiff) => void) {
		this.preview = HTML.CreateElement(
			"div",
			HTML.AddEventListener("click", onChange.bind(undefined, new SetActiveText(content)))
		);
		function makeButton(name: string, svg: string, action: StateDiff) {
			return HTML.CreateElement(
				"button",
				HTML.SetTitle(name),
				el => (el.innerHTML = svg),
				HTML.AddEventListener("click", onChange.bind(undefined, action))
			);
		}
		this.element = HTML.CreateElement(
			"article",
			HTML.AddClass("frame-preview"),
			HTML.Append(
				this.preview,
				HTML.CreateElement(
					"footer",
					HTML.Append(
						...(content.main ? [] : [makeButton("Remove", Icons.Trash, new RemoveContent(content))]),
						makeButton("Up", Icons.ArrowUp, new ShiftContent(content, +1)),
						makeButton("Down", Icons.ArrowDown, new ShiftContent(content, -1))
					)
				)
			)
		);
	}
	remove() {
		this.element.remove();
	}
	updatePreview(brushManager: BrushManager) {
		this.preview.textContent = this.content.text;
		this.preview.style.fontFamily = this.content.style.font.family;
	}
	updateIndex(index: number) {
		this.element.style.order = index.toString();
	}
}
