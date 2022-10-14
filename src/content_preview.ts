import * as HTML from "./html";
import { TextContent } from "./frame";
import { StateDiff, SetActiveText, RemoveContent, ShiftContent } from "./state";
import { BrushManager } from "./brush";

export class ContentPreview {
	private preview: HTMLDivElement;
	public readonly element: HTMLElement;
	constructor(readonly content: TextContent, onChange: (patch: StateDiff) => void) {
		this.preview = HTML.CreateElement(
			"div",
			HTML.AddEventListener("click", onChange.bind(undefined, new SetActiveText(content)))
		);
		function makeButton(name: string, action: StateDiff) {
			return HTML.CreateElement(
				"button",
				HTML.SetText(name),
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
						...(content.main ? [] : [makeButton("Remove", new RemoveContent(content))]),
						makeButton("Up", new ShiftContent(content, +1)),
						makeButton("Down", new ShiftContent(content, -1))
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
	}
	updateIndex(index: number) {
		this.element.style.order = index.toString();
	}
}
