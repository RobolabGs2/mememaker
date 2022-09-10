export interface PatchData<T extends object> {
	// Return patch for return to previous state
	apply(object: T): PatchData<T>;
}

export class BatchPatchData<T extends object> implements PatchData<T> {
	readonly patches: PatchData<T>[];
	constructor(...patches: PatchData<T>[]) {
		this.patches = patches;
	}
	apply(object: T): PatchData<T> {
		return new BatchPatchData(...this.patches.map(p => p.apply(object)).reverse());
	}
}

export class DelegatePatch<P extends object, Path extends PathInObject<P>, C extends object & TypeOfField<P, Path>>
	implements PatchData<P>
{
	constructor(readonly path: Path, readonly patch: PatchData<C>) {}
	apply(object: P): PatchData<P> {
		return new DelegatePatch(this.path, this.patch.apply(getValueByPath(this.path, object) as C));
	}
}

export class ChangedData<T extends object, P extends PathInObject<T> = PathInObject<T>> implements PatchData<T> {
	constructor(readonly path: P, readonly value: TypeOfField<T, P>) {}
	apply(object: T): PatchData<T> {
		const currentValue = getValueByPath(this.path, object);
		setValueByPath(this.path, this.value, object);
		return new ChangedData(this.path, currentValue);
	}
}

export function setValueByPath<T extends object, P extends PathInObject<T>>(path: P, value: TypeOfField<T, P>, obj: T) {
	const head = path[0] as keyof T;
	if (path.length === 1) {
		obj[head] = value as T[keyof T];
		return;
	}
	const currentValue = obj[head];
	setValueByPath(path[1] as PathInObject<object>, value as never, currentValue as unknown as object);
}

export function getValueByPath<T extends object, P extends PathInObject<T>>(path: P, obj: T): TypeOfField<T, P> {
	const head = path[0] as keyof T;
	const currentValue = obj[head];
	if (path.length === 1) {
		return obj[head] as TypeOfField<T, P>;
	}
	return getValueByPath(path[1] as PathInObject<object>, currentValue as unknown as object);
}

export type PathInObject<O extends object, P extends keyof O = keyof O> = P extends string
	? O[P] extends object
		? [P, PathInObject<O[P]>] | [P]
		: [P]
	: never;

export type TypeOfField<O extends object, Path extends PathInObject<O>> = Path extends [keyof O]
	? O[Path[0]]
	: Path extends [infer Head, infer Tail]
	? Head extends keyof O
		? O[Head] extends object
			? Tail extends PathInObject<O[Head]>
				? TypeOfField<O[Head], Tail>
				: never
			: never
		: never
	: never;
