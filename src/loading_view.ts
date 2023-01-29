import * as HTML from "./html";
import { randomFrom } from "./app";

export class LoadingView {
	readonly element: HTMLElement;
	readonly text: HTMLElement;
	constructor(readonly placeholders: HTMLImageElement[], parent: HTMLElement = document.body) {
		this.element = HTML.CreateElement(
			"article",
			HTML.AppendTo(parent),
			HTML.SetStyles(style => {
				style.position = "absolute";
				style.right = "0";
				style.top = "0";
				style.width = "100%";
				style.height = "100%";
				style.backgroundColor = "#CCCCCCAA";
				style.backgroundSize = `66%`;
				style.zIndex = "100";
				style.backgroundRepeat = "no-repeat";
				style.backgroundPosition = "50% 50%";
				style.display = "none";
				style.alignItems = "flex-end";
				style.justifyContent = "space-around";
			})
		);
		this.text = HTML.CreateElement(
			"section",
			HTML.AppendTo(this.element),
			HTML.SetStyles(style => {
				style.color = "white";
				style.fontWeight = "bold";
				style.fontStyle = "italic";
				style.paddingBottom = "32px";
			})
		);
	}
	private jobs = new Array<string>();
	up(msg: string) {
		this.jobs.push(msg);
		this.element.style.backgroundImage = `url(${randomFrom(this.placeholders).src}) `;
		this.text.textContent = msg;
		this.element.style.display = "flex";
	}
	down(msg: string) {
		const jobIndex = this.jobs.lastIndexOf(msg);
		if (jobIndex === -1) {
			console.error(`Logic error: LoadingView: not expected job for down: ${msg}`);
			return;
		}
		this.jobs.splice(jobIndex, 1);
		if (this.jobs.length === 0) this.element.style.display = "none";
		this.text.textContent = this.jobs[this.jobs.length - 1];
	}
	await<T>(msg: string, promise: Promise<T>) {
		this.up(msg);
		promise.finally(() => this.down(msg));
	}
}
