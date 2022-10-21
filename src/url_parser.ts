/**
 * Выбирает из урла параметры по ключам из объекта.
 * Поддерживает простые типы: строка, число, булеан.
 */
export function loadSettingsFromURL<T extends Record<string, unknown>>(defaults: T): T {
	const url = new URL(location.href);
	return Object.fromEntries(
		Object.entries(defaults).map(([key, defaultValue]) => [key, getOrDefault(key, defaultValue, url.searchParams)])
	) as T;
}

function getOrDefault<T>(key: string, origin: T, params: URLSearchParams): T {
	const hasKey = params.has(key);
	const value = params.get(key);
	switch (typeof origin) {
		case "string":
			return (hasKey ? value : origin) as unknown as T;
		case "number":
			return (hasKey ? Number(value) : origin) as unknown as T;
		case "boolean":
			return (hasKey ? value !== "false" : origin) as unknown as T;
		default:
			throw new Error(`type ${typeof origin} does not supported`);
	}
}
