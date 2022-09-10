import { PatchData, PathInObject, TypeOfField, ChangedData } from "../../patch";

export interface InputComponent<T, HTML extends HTMLElement = HTMLElement> {
	update(value: T): void;
	onChange?: (newValue: T) => void;
	readonly element: HTML;
}

export interface ObjectInputComponent<T extends object> {
	update(value: T): void;
	onChange?: (patch: PatchData<T>) => void;
	readonly element: HTMLElement;
}

export class Input<T extends object, P extends PathInObject<T> = PathInObject<T>> {
	constructor(
		readonly path: P,
		readonly input: InputComponent<TypeOfField<T, P>>,
		onChange?: (patch: ChangedData<T, P>) => void
	) {
		if (onChange) input.onChange = value => onChange(new ChangedData(path, value));
	}
}
