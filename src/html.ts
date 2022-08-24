/* DSL-like helpers for generating html */
export function CreateElement<K extends keyof HTMLElementTagNameMap>(
	tagName: K,
	...modify: ((t: HTMLElementTagNameMap[K]) => void)[]
): HTMLElementTagNameMap[K] {
	return ModifyElement(document.createElement(tagName), ...modify);
}

export function ModifyElement<T extends HTMLElement>(tag: T, ...modify: ((t: T) => void)[]): T {
	modify.forEach(x => x(tag));
	return tag;
}

export function SetTitle(title: string) {
	return (elem: HTMLElement) => (elem.title = title);
}

export function SetId(id: string) {
	return (elem: HTMLElement) => (elem.id = id);
}

export function AddClass(className: string) {
	return (elem: HTMLElement) => elem.classList.add(className);
}

export function SetName(name: string) {
	return (input: HTMLInputElement) => (input.name = name);
}

export function SetRequired(required = true) {
	return (input: HTMLInputElement | HTMLSelectElement) => (input.required = required);
}

export function SetChecked(checked = true) {
	return (input: HTMLInputElement) => (input.checked = checked);
}

export function SetInputType(type: string) {
	return (input: HTMLInputElement) => (input.type = type);
}

export function AppendTo(parent: HTMLElement) {
	return (elem: HTMLElement) => parent.append(elem);
}

export function SetNumberInputRange(min: number | undefined, max: number | undefined, step: number | undefined) {
	return (input: HTMLInputElement) => {
		input.min = min === undefined ? "any" : min.toString();
		input.max = max === undefined ? "any" : max.toString();
		input.step = step === undefined ? "any" : step.toString();
	};
}

export function SetText(text: string, title?: string) {
	return (el: HTMLElement) => {
		el.textContent = text;
		if (title) el.title = title;
	};
}

export function SetStyles(setter: (styles: CSSStyleDeclaration) => void) {
	return (el: HTMLElement) => setter(el.style);
}

export function FlexContainer(direction = "row", justifyContent = "", settings = { wrap: false }) {
	return SetStyles(style => {
		style.display = "flex";
		style.flexDirection = direction;
		style.justifyContent = justifyContent;
		style.flexWrap = settings.wrap ? "wrap" : "no-wrap";
	});
}

export function CreateSwitcher(
	currentState: () => boolean,
	changeState: (on: boolean) => void,
	titles: Record<"on" | "off", string>
): HTMLButtonElement {
	const button = CreateElement("button", SetText(!currentState() ? titles.on : titles.off));
	const hide = () => {
		changeState(!currentState());
		button.innerText = !currentState() ? titles.on : titles.off;
	};
	return ModifyElement(button, AddEventListener("click", hide));
}

export function CreateSelector<T extends string, K extends T>(
	defaultKey: K,
	options: Record<T, string>,
	onChange: (value: T) => void
) {
	return CreateElement(
		"select",
		AddEventListener("change", function () {
			try {
				onChange(<T>(<HTMLSelectElement>this).value);
			} catch (e) {
				alert(`${e}`);
			}
		}),
		Append(
			...Object.entries(options).map(([value, text]) =>
				CreateElement("option", SetText(text as string), el => (el.value = value))
			)
		),
		el => {
			el.selectedIndex = Object.keys(options).findIndex(k => k === defaultKey);
			onChange(defaultKey);
		}
	);
}

interface ForEachable<T> {
	forEach(each: (value: T) => void): void;
}

export function ModifyChildren(...modify: ((t: HTMLElement) => void)[]): (parent: HTMLElement) => void {
	return parent => {
		for (let i = 0; i < parent.children.length; i++) {
			const elem = parent.children.item(i);
			if (elem instanceof HTMLElement) ModifyElement(elem, ...modify);
		}
	};
}

export function Append<T extends HTMLElement>(...elems: T[]): (parent: HTMLElement) => void;
export function Append<T extends HTMLElement>(elems: ForEachable<T>): (parent: HTMLElement) => void;
export function Append<T extends HTMLElement>(
	...elems: (ForEachable<T> | HTMLElement)[]
): (parent: HTMLElement) => void;
export function Append<T extends HTMLElement>(
	...elems: (ForEachable<T> | HTMLElement)[]
): (parent: HTMLElement) => void {
	return (parent: HTMLElement) =>
		elems.forEach(value => {
			if (value instanceof HTMLElement) {
				parent.append(value);
			} else {
				value.forEach(elem => parent.append(elem));
			}
		});
}

export function AddEventListener<K extends keyof HTMLElementEventMap>(
	type: K,
	listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
	options?: boolean | AddEventListenerOptions
) {
	return (el: HTMLElement) => {
		el.addEventListener(type, listener, options);
	};
}

export function getStyleSheet(): Promise<CSSStyleSheet> {
	return new Promise((resolve, reject) => {
		document.head.appendChild(
			CreateElement("style", (style: HTMLStyleElement) => {
				setTimeout(() => {
					const styleSheet = style.sheet;
					if (!styleSheet) {
						reject(new Error("Can't take style sheet"));
						return;
					}
					styleSheet.addRule(`*`, `margin: 0; padding: 0;`);
					resolve(styleSheet);
				});
			})
		);
	});
}
