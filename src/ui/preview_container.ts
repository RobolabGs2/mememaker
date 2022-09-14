import { BrushManager } from "../brush";
import * as HTML from "../html";

interface PreviewComponent {
	readonly element: HTMLElement;
	updatePreview(brushManager: BrushManager): void;
	updateIndex(index: number): void;
}

export default class PreviewListContainer<T> {
	readonly element = HTML.CreateElement("article", HTML.AddClass("list"));
	private previews = new Map<T, PreviewComponent>();
	constructor(readonly previewFactory: (target: T) => PreviewComponent, readonly brushManager: BrushManager) {}
	add(target: T) {
		const preview = this.previewFactory(target);
		this.previews.set(target, preview);
		this.element.append(preview.element);
		preview.updatePreview(this.brushManager);
	}
	remove(target: T) {
		this.previews.get(target)?.element.remove();
		this.previews.delete(target);
	}
	updateIndexes(targets: T[]) {
		targets.forEach((target, i) => this.previews.get(target)?.updateIndex(i));
	}
	updatePreview(target: T) {
		this.previews.get(target)?.updatePreview(this.brushManager);
	}
	clear() {
		this.previews.clear();
		this.element.innerHTML = "";
	}
	reset(targets: T[]) {
		this.clear();
		targets.forEach(target => this.add(target));
		this.updateIndexes(targets);
	}
	private lastFocus?: T;
	focus(target: T) {
		if (this.lastFocus) this.previews.get(this.lastFocus)?.element.classList.toggle("focus", false);
		this.lastFocus = target;
		this.previews.get(target)?.element.classList.toggle("focus", true);
	}
}
