import * as HTML from "./html";
import { BrushManager, Frame } from "./frame";
import { SetActiveFrame, RemoveFrame, ShiftFrame, StateDiff } from "./state";

export class FramePreview {
	private preview: CanvasRenderingContext2D;
	private indexContainer = HTML.CreateElement("header");
	public readonly element: HTMLElement;
	constructor(readonly frame: Frame, onChange: (patch: StateDiff) => void) {
		const image = HTML.CreateElement(
			"canvas",
			HTML.AddEventListener("click", onChange.bind(undefined, new SetActiveFrame(frame)))
		);
		function makeButton(name: string, action: StateDiff) {
			return HTML.CreateElement(
				"button",
				HTML.SetText(name),
				HTML.AddEventListener("click", onChange.bind(undefined, action))
			);
		}
		this.preview = image.getContext("2d")!;
		this.element = HTML.CreateElement(
			"article",
			HTML.AddClass("frame-preview"),
			HTML.Append(
				image,
				this.indexContainer,
				HTML.CreateElement(
					"footer",
					HTML.Append(
						makeButton("Remove", new RemoveFrame(frame)),
						makeButton("Up", new ShiftFrame(frame, -1)),
						makeButton("Down", new ShiftFrame(frame, +1))
					)
				)
			)
		);
	}
	remove() {
		this.element.remove();
	}
	updatePreview(brushManager: BrushManager) {
		const preview = this.preview;
		const frame = this.frame;
		const previewWidth = preview.canvas.clientWidth;
		const previewScale = previewWidth / frame.image.width;
		const previewHeight = (previewScale * frame.image.height) | 0;
		preview.canvas.width = previewWidth;
		preview.canvas.height = previewHeight;
		preview.scale(previewScale, previewScale);
		frame.draw(preview, brushManager);
	}
	updateIndex(index: number) {
		this.indexContainer.textContent = (index + 1).toString();
		this.element.style.order = index.toString();
	}
}
