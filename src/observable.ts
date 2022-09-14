type MapOfArrays<T> = {
	[K in keyof T]: Set<T[K]>;
};

export type EventHandler<T, This = unknown, Return = void> = {
	[K in keyof T]: (this: This, data: T[K]) => Return;
};

type ListenersMap<EventsMap, This = unknown> = MapOfArrays<EventHandler<EventsMap, This>>;

export default class Observable<EventsMap> {
	protected listeners: ListenersMap<EventsMap, this> = {} as ListenersMap<EventsMap, this>;
	// Возвращает индекс слушателя
	public addEventListener<E extends keyof EventsMap>(eventType: E, listener: EventHandler<EventsMap, this>[E]): void {
		let set = this.listeners[eventType];
		if (!set) {
			set = new Set();
			this.listeners[eventType] = set;
		}
		set.add(listener);
	}
	public removeEventListener<E extends keyof EventsMap>(
		eventType: E,
		listener: EventHandler<EventsMap, this>[E]
	): void {
		this.listeners[eventType]?.delete(listener);
	}
	protected dispatchEvent<E extends keyof EventsMap>(eventType: E, event: EventsMap[E]) {
		this.listeners[eventType]?.forEach(listener => listener.call(this as unknown as this, event));
	}
}
