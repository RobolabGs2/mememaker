import * as HTML from "./html";
import { downloadBlobAs, downloadImage, readBlobAsURL } from "./http_helpers";

import { Frame, TextContent } from "./frame";
import { TextSettingsForm } from "./ui/inputs/text_settings_input";
import { BrushInput } from "./ui/inputs/brush_input";
import { BatchPatchData, ChangedData, DelegatePatch, PatchData } from "./patch";
import {
	State,
	SetActiveFrame,
	SetActiveText,
	AddFrame,
	SetFrames,
	RemoveFrame,
	ShiftFrame,
	AddContent,
	ShiftContent,
	makeDiffHandler,
	StateDiffListener,
	RemoveContent,
} from "./state";
import { getBlobFromCanvas, Meme } from "./meme";
import { FramePreview } from "./frame_preview";
import { ContentPreview } from "./content_preview";
import PreviewListContainer from "./ui/preview_container";
import { LoadingView } from "./loading_view";
import TextInput from "./ui/inputs/text_input";
import FilesInput from "./ui/inputs/file_input";
import { BrushManager } from "./brush";
import { TextStylePrototype, DefaultStyle, deepCopyTextStyle, StylePresets } from "./text_style";
import { RectangleSprite } from "./graphics/sprite";
import BoxEditor from "./box_editor";
import { ShadowInput } from "./ui/inputs/shadow_input";
import styles from "./tabs_container.module.scss";
import { ExperimentalInput } from "./ui/inputs/experimental_input";
import Icons from "./ui/icons";
import VK, { VkApiGroup, VkScope, VkUploadPhotoOnWall } from "./vk_open_api";

export class DrawContext {
	constructor(
		readonly main: CanvasRenderingContext2D,
		readonly ui: CanvasRenderingContext2D,
		readonly offscreen: CanvasRenderingContext2D
	) {}
	public set width(w: number) {
		if (this.width === w) return;
		this.main.canvas.width = w;
		this.ui.canvas.width = w;
		// this.offscreen.canvas.width = w;
	}
	public get width(): number {
		return this.main.canvas.width;
	}

	public set height(h: number) {
		if (this.height === h) return;
		this.main.canvas.height = h;
		this.ui.canvas.height = h;
		// this.offscreen.canvas.height = h;
	}
	public get height(): number {
		return this.main.canvas.height;
	}
}

function TabsContainer(tabs: { label: HTMLElement; content: HTMLElement; title: string }[]) {
	let activeTab = 0;
	const contents = tabs.map(tab =>
		HTML.CreateElement(
			"section",
			HTML.Append(tab.content),
			HTML.SetStyles(s => (s.display = "none"))
		)
	);
	const labels = tabs.map((tab, i) => {
		return HTML.CreateElement(
			"section",
			HTML.SetTitle(tab.title),
			HTML.AddClass(styles["label"]),
			HTML.Append(tab.label),
			HTML.AddEventListener("click", ev => {
				if (ev.button !== 0) return;
				ev.preventDefault();
				setActiveTab(i);
			})
		);
	});
	function setActiveTab(i: number) {
		contents[activeTab].style.display = "none";
		labels[activeTab].classList.toggle(styles["label_active"], false);
		contents[i].style.display = "";
		labels[i].classList.toggle(styles["label_active"], true);
		activeTab = i;
	}
	setActiveTab(0);
	const labelsContainer = HTML.CreateElement(
		"header",
		HTML.AddClass(styles["tabs-container__labels"]),
		HTML.Append(labels)
	);
	const content = HTML.CreateElement(
		"section",
		HTML.AddClass(styles["tabs-container__content"]),
		HTML.Append(contents)
	);
	const container = HTML.CreateElement(
		"article",
		HTML.AddClass(styles["tabs-container"]),
		HTML.Append(labelsContainer, content)
	);
	return container;
}

export class App {
	private state: State;
	private ctx: DrawContext;

	setActive(frame: Frame) {
		this.state.apply(new SetActiveFrame(frame));
	}
	setActiveText(text: TextContent) {
		this.state.apply(new SetActiveText(text));
	}

	drawFrame(frame: Frame) {
		frame.draw(this.ctx.main, this.brushManager);
		this.framesViews.updatePreview(frame);
	}

	private framesViews: PreviewListContainer<Frame>;
	private contentViews: PreviewListContainer<TextContent>;
	boxEditor: BoxEditor;
	uiDraw() {
		for (let i = 0; i < this.state.appliedOperations.length; i++) {
			const { diff: patch, op } = this.state.appliedOperations[i];
			this.drawPatchHandler(patch, !(op === "do" || op === "temporal"));
		}
		this.state.appliedOperations.length = 0;
		this.boxEditor.draw();
	}
	private brushManager: BrushManager;
	onChangeActiveFrame = new Array<(app: App) => void>();
	public busyView = new LoadingView(this.placeholders["downloading"]);
	constructor(
		private placeholders: Record<"downloading" | "empty", HTMLImageElement[]>,
		patternsImages: Record<string, HTMLImageElement>,
		fontFamilies: string[],
		project?: Blob
	) {
		this.busyView.up("Loading...");
		setTimeout(() => this.busyView.down("Loading..."));
		this.busyView.await("Loading fonts...", HTML.forceLoadFonts(document.fonts));
		this.state = new State([new Frame(randomFrom(placeholders.empty), `Hello meme! Write text here >>>>>>`)]);
		const animationFrame = () => {
			this.uiDraw();
			requestAnimationFrame(animationFrame);
		};
		requestAnimationFrame(animationFrame);
		const canvas = document.querySelector("canvas#main") as HTMLCanvasElement;
		const canvasUI = document.querySelector("canvas#ui") as HTMLCanvasElement;

		this.ctx = new DrawContext(
			canvas.getContext("2d")!,
			canvasUI.getContext("2d")!,
			document.createElement("canvas").getContext("2d")!
		);
		this.boxEditor = new BoxEditor(this.ctx, this.state);

		this.brushManager = new BrushManager(this.ctx.offscreen, patternsImages);
		this.framesViews = new PreviewListContainer(frame => this.createFrameView(frame), this.brushManager);
		this.contentViews = new PreviewListContainer(content => this.createContentView(content), this.brushManager);
		const framesContainer = document.querySelector("section#frames") as HTMLElement;
		framesContainer.append(this.framesViews.element);
		addButton("Добавить фрейм", () => this.addFrame(), framesContainer);
		const textsContainer = HTML.CreateElement("section", HTML.SetId("current-frame"), HTML.AddClass("frames"));
		textsContainer.append(this.contentViews.element);
		addButton("Добавить блок с текстом", () => this.addText(), textsContainer);

		const properties = document.querySelector("section#right-panel") as HTMLElement;
		const urlInput = new FilesInput("image/*", files => {
			const image = files.find(file => file.type?.match(/^image/));
			if (image) this.busyView.await("Upload image from file...", this.downloadAndSetImage(image));
		});
		const applyPatch = (patch: PatchData<TextStylePrototype>) =>
			this.state.apply(
				new DelegatePatch<State, ["activeText", ["style"]], TextStylePrototype>(["activeText", ["style"]], patch)
			);
		const textSettingsInput = TextSettingsForm(fontFamilies, applyPatch);
		const patternsKeys = Object.keys(patternsImages);
		const fillBrushInput = new BrushInput(
			brushPatch => applyPatch(new DelegatePatch(["fill"], brushPatch)),
			patternsKeys,
			"#FFFFFF"
		);
		const strokeBrushInput = new BrushInput(
			brushPatch => applyPatch(new DelegatePatch(["stroke"], brushPatch)),
			patternsKeys,
			"#000000"
		);
		const shadowInput = new ShadowInput(newValue => applyPatch(new DelegatePatch(["shadow"], newValue)));
		const textInput = new TextInput(
			newValue =>
				this.state.apply(new ChangedData<State, ["activeText", ["text"]]>(["activeText", ["text"]], newValue)),
			6
		);
		const experimentalInput = new ExperimentalInput(newValue =>
			applyPatch(new DelegatePatch(["experimental"], newValue))
		);
		const presetsSelector = HTML.CreateSelector(
			"Выбрать пресет...",
			["Выбрать пресет...", ...StylePresets.map(p => p.name)],
			value => {
				const s = StylePresets.find(x => x.name === value);
				if (!s) return;
				this.state.apply(
					new ChangedData<State, ["activeText", ["style"]]>(["activeText", ["style"]], deepCopyTextStyle(s))
				);
				presetsSelector.value = "Выбрать пресет...";
			},
			HTML.SetStyles(styles => {
				styles.width = "100%";
				styles.height = "24px";
			}),
			HTML.ModifyChildren(el => {
				const op = el as HTMLOptionElement;
				const s = StylePresets.find(x => x.name === op.text);
				if (!s) return;
				op.style.fontFamily = s.font.family;
			})
		);
		this.onChangeActiveFrame.push(app => {
			textSettingsInput.update(app.state.activeText.style);
			fillBrushInput.update(app.state.activeText.style.fill);
			strokeBrushInput.update(app.state.activeText.style.stroke);
			shadowInput.update(app.state.activeText.style.shadow);
			textInput.update(app.state.activeText.text);
			experimentalInput.update(app.state.activeText.style.experimental);
		});
		const styleSettingsContainer = TabsContainer([
			{ title: "Заливка", label: HTML.CreateElement("div", HTML.SetHTML(Icons.Fill)), content: fillBrushInput.element },
			{
				title: "Обводка",
				label: HTML.CreateElement("div", HTML.SetHTML(Icons.Stroke)),
				content: strokeBrushInput.element,
			},
			{ title: "Тень", label: HTML.CreateElement("div", HTML.SetHTML(Icons.Shadow)), content: shadowInput.element },
			{
				title: "Экспериментальное",
				label: HTML.CreateElement("div", HTML.SetHTML(Icons.Experimental)),
				content: experimentalInput.element,
			},
		]);
		const blockPropertiesContainer = HTML.ModifyElement(
			TabsContainer([
				{
					title: "Настройки текста",
					label: HTML.CreateElement("span", HTML.SetText("Текст")),
					content: HTML.CreateElement(
						"article",
						HTML.Append(presetsSelector, textSettingsInput.element, textInput.element, styleSettingsContainer)
					),
				},
				{
					title: "Настройки фона",
					label: HTML.CreateElement("span", HTML.SetText("Фон")),
					content: HTML.CreateElement(
						"article",
						HTML.Append(
							HTML.CreateElement("span", HTML.SetText("Фоновое изображение (также работают Ctrl+V, или drop):")),
							urlInput.element
						)
					),
				},
			]),
			HTML.SetId("properties")
		);
		properties.append(textsContainer, blockPropertiesContainer);
		document.addEventListener("paste", event => {
			const items = event.clipboardData?.items;
			if (!items) return;
			for (let index = 0; index < items.length; index++) {
				const item = items[index];
				if (!item.type?.match(/^image/)) continue;
				this.busyView.await(
					"Pasting image...",
					new Promise<File>((resolve, reject) => {
						const file = item.getAsFile();
						if (file) resolve(file);
						else reject("Failed to get file from clipboard");
					}).then(this.downloadAndSetImage)
				);
				return;
			}
		});
		document.addEventListener("drop", ev => {
			ev.preventDefault();
			const items = ev.dataTransfer?.files;
			if (!items) return;
			for (let index = 0; index < items.length; index++) {
				const file = items[index];
				if (!file.type?.match(/^image/)) continue;
				this.busyView.await("Dropping image to meme...", this.downloadAndSetImage(file));
				return;
			}
		});
		document.addEventListener("dragover", ev => ev.preventDefault());
		framesContainer.addEventListener("drop", ev => {
			ev.preventDefault();
			ev.stopPropagation();
			const items = ev.dataTransfer?.files;
			if (!items) return;
			const frames = Promise.all(
				Array.from(items)
					.filter(file => file.type?.match(/^image/))
					.map(file => readBlobAsURL(file).then(downloadImage))
			)
				.then(images => new BatchPatchData(...images.map(img => new AddFrame(new Frame(img, "")))))
				.then(patch => this.state.apply(patch));
			this.busyView.await("Creating new frames...", frames);
		});
		{
			const projectActionsContainer = HTML.CreateElement(
				"section",
				HTML.AppendTo(framesContainer.parentElement!),
				HTML.SetStyles(styles => {
					styles.display = "flex";
					styles.flexDirection = "column";
					styles.backgroundColor = "#34352F";
					styles.color = "#EEEEEE";
				})
			);
			addButton(
				"Сохранить отрендеренный мем",
				() =>
					this.busyView.await(
						"Rendering...",
						Meme.renderToZIP(this.state.frames, this.brushManager).then(downloadBlobAs("meme.zip"))
					),
				projectActionsContainer
			);
			addButton(
				"Сохранить текст в csv",
				() =>
					this.busyView.await(
						"Preparing script...",
						Meme.scriptCSV(this.state.frames).then(downloadBlobAs("meme.csv"))
					),
				projectActionsContainer
			);
			addButton(
				"Сохранить meme project",
				() =>
					this.busyView.await("Packing project...", Meme.toFile(this.state.frames).then(downloadBlobAs("meme.meme"))),
				projectActionsContainer
			);
			addButton(
				"VK",
				() => VK.Auth.login(console.log, VkScope.wall | VkScope.groups | VkScope.photos),
				projectActionsContainer
			);
			const memeInput = new FilesInput(".meme", files => {
				const file = files[0];
				this.busyView.await(
					"Open project...",
					Meme.fromFile(file).then(frames => this.state.apply(new SetFrames(frames)))
				);
			});
			HTML.ModifyChildren(
				HTML.SetStyles(s => {
					s.margin = "4px";
					s.padding = "4px";
				})
			)(projectActionsContainer);
			projectActionsContainer.append(
				"Открыть meme project:",
				memeInput.element,
				HTML.CreateElement("div", HTML.SetId("vk_auth")),
				HTML.CreateElement("div", HTML.SetId("vk_button"))
			);
		}
		document.addEventListener("keydown", ev => {
			if (ev.ctrlKey && ev.code === "KeyZ") {
				ev.preventDefault();
				if (ev.shiftKey) this.state.redo();
				else this.state.undo();
			}
			if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) {
				return;
			}
			if (ev.code === "ArrowRight") {
				const current = this.state.activeFrame;
				const next =
					this.state.frames[(this.state.frames.findIndex(x => x === current) + 1) % this.state.frames.length];
				this.setActive(next);
				return;
			}
			if (ev.code === "ArrowLeft") {
				const current = this.state.activeFrame;
				const next =
					this.state.frames[
						(this.state.frames.findIndex(x => x === current) + this.state.frames.length - 1) % this.state.frames.length
					];
				this.setActive(next);
				return;
			}
		});
		if (project)
			this.busyView.await(
				"Открываем...",
				Meme.fromFile(project).then(frames => this.state.apply(new SetFrames(frames)))
			);
		setupAppHeader(this);
		VK.init({ apiId: APP_ID });
		// VK.Widgets.Auth("vk_auth", {
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		// onAuth: () => {},
		// });
		VK.Observer.subscribe("auth.login", r => {
			console.log(r);
			if (r.session) {
				VK.Api.call("groups.get", { user_id: r.session.mid, v: "5.131", fields: "can_post", extended: 1 }, r => {
					if (r.error) {
						console.log(r.error);
						return;
					}
					const resp = r.response!;
					console.log(`Total count: ${resp.count}`);
					const canPost = (resp.items as VkApiGroup[]).filter(g => {
						return g.can_post;
					});
					console.log(canPost.length);
					const appContainer = document.querySelector("body > article") as HTMLElement;
					const w = new HelpWindow(appContainer, () => {});
					w.show2(
						HTML.CreateElement(
							"article",
							HTML.SetStyles(s => {
								s.display = "flex";
								s.flexDirection = "column";
							}),
							HTML.Append(
								canPost.map(g =>
									HTML.CreateElement(
										"button",
										HTML.Append(
											HTML.CreateElement("img", el => (el.src = g.photo_50)),
											HTML.CreateElement("span", HTML.SetText(g.name))
										),
										HTML.AddEventListener("click", () => {
											const future = new Date();
											future.setDate(future.getDate() + 365);
											getBlobFromCanvas(this.ctx.main.canvas).then(blob => {
												VkUploadPhotoOnWall(VK, -g.id, blob).then(photo => {
													console.log(photo);
													VK.Api.call(
														"wall.post",
														{
															v: "5.131",
															owner_id: -g.id,
															from_group: 1,
															message: "Привет из мемейкера!",
															attachments: `photo${photo.owner_id}_${photo.id}`,
															publish_date: Math.floor(future.getTime() / 1000),
														},
														console.log
													);
												});
											});
										})
									)
								)
							)
						)
					);
				});
			}
		});
	}
	private drawPatchHandler = makeDiffHandler(
		new StateDiffListener([BatchPatchData], (diff, cancel) =>
			diff.patches.forEach(patch => this.drawPatchHandler(patch, cancel))
		),
		new StateDiffListener([ChangedData, DelegatePatch], () => {
			// TODO: update only selected fields
			this.onChangeActiveFrame.forEach(v => v(this));
			this.contentViews.updatePreview(this.state.activeText);
		}),
		new StateDiffListener([AddFrame], diff => this.framesViews.add(diff.frame)),
		new StateDiffListener([AddContent], diff => this.contentViews.add(diff.content)),
		new StateDiffListener([RemoveFrame], diff => this.framesViews.remove(diff.frame)),
		new StateDiffListener([RemoveContent], diff => this.contentViews.remove(diff.content)),
		new StateDiffListener([AddFrame, ShiftFrame], () => this.framesViews.updateIndexes(this.state.frames)),
		new StateDiffListener([AddContent, ShiftContent], () =>
			this.contentViews.updateIndexes(this.state.activeFrame.textContent)
		),
		new StateDiffListener([SetFrames], diff => this.framesViews.reset(diff.frames)),
		new StateDiffListener([SetFrames, SetActiveFrame], () =>
			this.contentViews.reset(this.state.activeFrame.textContent)
		),
		new StateDiffListener(
			[SetFrames, SetActiveFrame, ShiftContent, AddContent, RemoveContent, ChangedData, DelegatePatch],
			() => {
				this.drawFrame(this.state.activeFrame);
			}
		),
		new StateDiffListener([SetFrames, SetActiveFrame, SetActiveText], () => {
			this.onChangeActiveFrame.forEach(v => v(this));
			this.framesViews.focus(this.state.activeFrame);
			this.contentViews.focus(this.state.activeText);
			this.boxEditor.setup();
		})
	);
	addFrame(img: HTMLImageElement = randomFrom(this.placeholders.empty)) {
		const newFrame = new Frame(img, "");
		const currentStyle = deepCopyTextStyle(this.state.activeText.style);
		newFrame.textContent[0].style = currentStyle;
		this.state.apply(new AddFrame(newFrame));
		this.setActive(newFrame);
	}
	addText() {
		const frame = this.state.activeFrame;
		const currentStyle = deepCopyTextStyle(this.state.activeText.style);
		const newText = new TextContent(
			new RectangleSprite(
				frame.image.width / 2,
				frame.image.height / 2,
				frame.image.width / 2,
				frame.image.height / 2,
				0,
				{ fill: {}, stroke: { default: "#aaaa00 " } }
			),
			"New text",
			currentStyle
		);
		this.state.apply(new AddContent(newText));
		this.setActiveText(newText);
	}
	setFrames(frames: Frame[]) {
		this.state.apply(new SetFrames(frames));
	}
	createFrameView(frame: Frame): FramePreview {
		return new FramePreview(frame, patch => {
			if (patch instanceof RemoveFrame) {
				if (this.state.frames.length === 1) this.addFrame();
				if (this.state.activeFrame === frame) this.setActive(this.state.frames.find(v => v !== frame)!);
			}
			this.state.apply(patch);
		});
	}
	createContentView(content: TextContent): ContentPreview {
		return new ContentPreview(content, patch => {
			if (patch instanceof RemoveContent) {
				if (this.state.activeText === content)
					this.setActiveText(this.state.activeFrame.textContent.find(v => v !== content)!);
			}
			this.state.apply(patch);
		});
	}
	downloadAndSetImage = (file: File) => {
		return readBlobAsURL(file)
			.then(downloadImage)
			.then(img => {
				this.state.apply(new ChangedData<State, ["activeFrame", ["image"]]>(["activeFrame", ["image"]], img));
			});
	};
}

export function randomFrom<T>(arr: T[]): T {
	return arr[Math.floor(arr.length * Math.random())];
}
function addButton(text: string, action: () => void, destination: HTMLElement) {
	HTML.CreateElement("button", HTML.SetText(text), HTML.AddEventListener("click", action), HTML.AppendTo(destination));
}

import docsMemeExample from "../docs/docs.meme";
import { HelpWindow } from "./help_window";
import HelpMd from "../docs/help.html";
import ChangelogMd from "../docs/changelog.html";

function setupAppHeader(app: App) {
	const header = document.querySelector("#header-main") as HTMLElement;
	header.parentElement?.append(header);
	const [helpButton, changelogButton, exampleButton] = Array.from(
		document.querySelectorAll("#header-links > button")
	) as HTMLButtonElement[];
	exampleButton.addEventListener("click", () => {
		app.busyView.await(
			"Открываем пример...",
			fetch(docsMemeExample)
				.then(resp => resp.blob())
				.then(Meme.fromFile)
				.then(frames => app.setFrames(frames))
		);
	});
	const appContainer = document.querySelector("body > article") as HTMLElement;
	appContainer.style.position = "relative";
	let state = "off";
	const helpWindow = new HelpWindow(appContainer, () => (state = "off"));
	Promise.all([fetch(HelpMd), fetch(ChangelogMd)].map(resp => resp.then(r => r.text()))).then(
		([helpHTML, changelogHTML]) => {
			helpButton.addEventListener("click", () => {
				if (state == "help") {
					helpWindow.hide();
					return;
				}
				state = "help";
				helpWindow.show(helpHTML);
			});
			changelogButton.addEventListener("click", () => {
				if (state == "changelog") {
					helpWindow.hide();
					return;
				}
				state = "changelog";
				helpWindow.show(changelogHTML);
			});
		}
	);
}
