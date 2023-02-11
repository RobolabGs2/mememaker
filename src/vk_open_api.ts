// eslint-disable-next-line no-var
declare var VK: VkOpenApi;

export default VK;

export type VkOpenApi = {
	init(params: { apiId: number; status?: boolean; onlyWidgets?: boolean }): void;
	Auth: {
		login(cb: (status: VkLoginStatus) => void, settings: number): void;
		logout(cb: (status: VkEmptyLoginStatus) => void): void;
		revokeGrants(cb: (status: VkEmptyLoginStatus) => void): void;
		getLoginStatus(cb: (status: VkLoginStatus) => void): void;
		getSession(cb: (session: VkSession) => void): void;
	};
	Api: {
		call<M extends VkApiMethod>(method: M, params: VkApiParams<M>, callback: (r: VkApiResponse<M>) => void): void;
	};
	Observer: {
		subscribe<T extends keyof VkObserverEventsMap>(event: T, handler: (r: VkObserverEventsMap[T]) => void): void;
		unsubscribe<T extends keyof VkObserverEventsMap>(event: T, handler?: (r: VkObserverEventsMap[T]) => void): void;
	};
	Widgets: {
		Auth(elementId: string, options?: VkAuthOptions): number;
	};
	UI: {
		button(containerId: string): void;
	};
};

interface VkApiMethods {
	"groups.get": {
		Params: {
			user_id: number;
			filter?: "admin" | "editor" | "moder" | "advertiser" | "groups" | "publics" | "events" | "hasAddress";
			extended?: 0 | 1;
			fields?: "can_post"; // todo
			offset?: number;
			count?: number;
		};
		Response: {
			count: number;
			items: number[] | VkApiGroup[];
		};
	};
	"wall.post": {
		Params: VkApiPostParams;
		Response: number;
	};
	"photos.getWallUploadServer": {
		Params: { group_id: number };
		Response: { upload_url: string; album_id: number; user_id: number };
	};
	"photos.saveWallPhoto": {
		Params: {
			user_id?: number;
			group_id?: number;
			photo: string;
			server: string;
			hash: string;
			latitude?: string;
			longitude?: string;
			caption?: string;
		};
		Response: VkApiPhoto;
	};
}

export function VkUploadPhotoOnWall(api: VkOpenApi, groupId: number, image: Blob): Promise<VkApiPhoto> {
	return new Promise((resolve, reject) => {
		api.Api.call("photos.getWallUploadServer", { group_id: groupId, v: "5.131" }, r => {
			const uploadParams = r.response;
			if (!uploadParams) {
				reject(r.error);
				return;
			}
			const body = new FormData();
			body.append("photo", image);
			fetch(uploadParams.upload_url, {
				method: "POST",
				body,
				mode: "cors",
				headers: {
					Accept: "application/json",
				},
			})
				.then(r => r.text())
				.then(console.log)
				/*.then(r => r.json())
				.then(saveParams => {
					const { server, photo, hash } = saveParams.server;
					if (!server || !photo || !hash)
						throw new Error(`Unexpected answer from WallUploadServer: ${JSON.stringify(saveParams)}`);
					api.Api.call("photos.saveWallPhoto", { v: "5.131", hash, photo, server, group_id: groupId }, r => {
						const photo = r.response;
						if (!photo) throw r.error;
						resolve(photo);
					});
				})*/
				.catch(reject);
		});
	});
}

export type VkApiMethod = keyof VkApiMethods;
export type VkApiParams<M extends VkApiMethod> = VkApiMethods[M]["Params"] & { v: string };

export type VkApiResponse<M extends VkApiMethod> = {
	response?: VkApiMethods[M]["Response"];
	error: unknown;
};

interface VkObserverEventsMap {
	"auth.login": VkLoginStatus;
	"auth.logout": VkEmptyLoginStatus;
}

export interface VkSession {
	expire: number;
	mid: number;
	secret: string;
	sid: string;
	sig: string;
	user: {
		id: string;
		href: string;
		domain: string;
		first_name: string;
		last_name: string;
		nickname: string;
	};
}

export interface VkLoginStatus {
	session: VkSession;
	status: "connected" | "not_authorized" | "unknown";
}

export interface VkEmptyLoginStatus {
	session: null;
	status: "unknown";
	settings: undefined;
}

export interface VkAuthOptions {
	width?: number | undefined;
	onAuth?(user: VkAuthUserData): void;
	authUrl?: string | undefined;
}

export interface VkAuthUserData {
	uid: number;
	first_name: string;
	last_name: string;
	photo: string;
	photo_rec: string;
	hash: string;
}

export enum VkScope {
	//** Пользователь разрешил отправлять ему уведомления (для flash/iframe-приложений). */
	notify = 1 << 0,
	//** Доступ к друзьям. */
	friends = 1 << 1,
	//** Доступ к фотографиям. */
	photos = 1 << 2,
	//** Доступ к аудиозаписям. */
	audio = 1 << 3,
	//** Доступ к видеозаписям. */
	video = 1 << 4,
	//** Доступ к историям. */
	stories = 1 << 6,
	//** Доступ к wiki-страницам. */
	pages = 1 << 7,
	//** Добавление ссылки на приложение в меню слева. */
	menu = 1 << 8,
	//** Доступ к статусу пользователя. */
	status = 1 << 10,
	//** Доступ к заметкам пользователя. */
	notes = 1 << 11,
	//** Доступ к расширенным методам работы с сообщениями (только для Standalone-приложений, прошедших модерацию). */
	messages = 1 << 12,
	//** Доступ к обычным и расширенным методам работы со стеной. Данное право доступа по умолчанию недоступно для сайтов (игнорируется при попытке авторизации для приложений с типом «Веб-сайт» или по схеме Authorization Code Flow). */
	wall = 1 << 13,
	//** Доступ к расширенным методам работы с рекламным API. Доступно для авторизации по схеме Implicit Flow или Authorization Code Flow. */
	ads = 1 << 15,
	//** Доступ к API в любое время (при использовании этой опции параметр expires_in, возвращаемый вместе с access_token, содержит 0 — токен бессрочный). Не применяется в Open API. */
	offline = 1 << 16,
	//** Доступ к документам. */
	docs = 1 << 17,
	//** Доступ к группам пользователя. */
	groups = 1 << 18,
	//** Доступ к оповещениям об ответах пользователю. */
	notifications = 1 << 19,
	//** Доступ к статистике групп и приложений пользователя, администратором которых он является. */
	stats = 1 << 20,
	//** Доступ к email пользователя. */
	email = 1 << 22,
	//** Доступ к товарам. */
	market = 1 << 27,
}

export type VkApiBool = 0 | 1;

export interface VkApiGroup {
	// Идентификатор сообщества.
	readonly id: number;
	// Название сообщества.
	readonly name: string;
	// Короткий адрес, например, apiclub.
	readonly screen_name: string;
	/** Является ли сообщество закрытым. Возможные значения:
		0 — открытое;
		1 — закрытое;
		2 — частное.
	 */
	readonly is_closed: 0 | 1 | 2;
	// Возвращается в случае, если сообщество удалено или заблокировано. Возможные значения:
	readonly deactivated?: "deleted" | "banned";
	/**
	 * Требуется scope  = groups
	 * Информация о том, является ли текущий пользователь руководителем. Возможные значения:
	 */
	readonly is_admin: VkApiBool;
	/**
	 * Требуется scope  = groups
	 * Уровень полномочий текущего пользователя (если is_admin = 1):
	 * 	1 — модератор;
	 * 	2 — редактор;
	 * 	3 — администратор.
	 */
	readonly admin_level?: 1 | 2 | 3;
	// 	Требуется scope  = groups
	// Информация о том, является ли текущий пользователь участником.
	readonly is_member: VkApiBool;
	// Тип сообщества
	readonly type: "group" | "page" | "event";
	// URL главной фотографии с размером 50x50px.
	readonly photo_50: string;
	// URL главной  фотографии с размером 100х100px.
	readonly photo_100: string;
	// URL главной фотографии в максимальном размере.
	readonly photo_200: string;
	readonly can_post: VkApiBool;
}

export type VkApiPostParams = {
	/** Идентификатор пользователя или сообщества, на стене которого должна быть опубликована запись.
	 *  Обратите внимание, идентификатор сообщества в параметре owner_id необходимо указывать со знаком «-» — например,
	 *  owner_id=-1 соответствует идентификатору сообщества ВКонтакте API (club1).
	 */
	owner_id: number;

	/**1 — запись будет доступна только друзьям,
	 * 0 — всем пользователям.
	 * По умолчанию публикуемые записи доступны всем пользователям.
	 */
	friends_only?: VkApiBool;

	/** Данный параметр учитывается, если owner_id < 0 (запись публикуется на стене группы).
	 * 1 — запись будет опубликована от имени группы,
	 * 0 — запись будет опубликована от имени пользователя (по умолчанию).
	 */
	from_group?: VkApiBool;

	/** Текст сообщения (является обязательным, если не задан параметр attachments). */
	message?: string;

	/**
	 * Объект или несколько объектов, приложенных к записи.
	 * К записи можно приложить медиа или ссылку на внешнюю страницу. Если объектов несколько, их нужно указать через запятую «,».
	 *
	 * Формат описания медиа-приложения:
	 * <type><owner_id>_<media_id>
	 * <type> — тип медиа-приложения:
	 * photo — фотография;
	 * video — видеозапись;
	 * audio — аудиозапись;
	 * doc — документ;
	 * page — wiki-страница;
	 * note — заметка;
	 * poll — опрос;
	 * album — альбом;
	 * market — товар;
	 * market_album — подборка товаров;
	 * audio_playlist — плейлист с аудио.
	 * <owner_id> — идентификатор владельца медиа-приложения (обратите внимание, если объект находится в сообществе, значение должно быть отрицательным числом).
	 * <media_id> — идентификатор медиа-приложения.
	 * Формат описания ссылки:
	 * <protocol><URL>
	 * <protocol> — протокол HTTP или HTTPS.
	 * <URL> — оставшаяся часть URL.
	 * Формат для перечисления объектов:
	 * <type><owner_id>_<media_id>,<type><owner_id>_<media_id>,<protocol<URL>
	 * Обратите внимание, можно указать несколько медиа-приложений, но только одну ссылку. Если указать больше одной ссылки, будет возвращена ошибка.
	 * Примеры:
	 * photo100172_166443618,photo-1_265827614
	 * photo66748_265827614,https://example.ru
	 * https://example.ru
	 * Параметр attachments является обязательным, если не задано значение message.
	 */
	attachments?: string;

	/** Список сервисов или сайтов, на которые необходимо экспортировать запись, в случае если пользователь настроил соответствующую опцию.
	 *  Например, twitter, facebook.
	 */
	services?: string;

	/** 1 — у записи, размещенной от имени сообщества, будет добавлена подпись (имя пользователя, разместившего запись), 0 — подписи добавлено не будет.
	 *  Параметр учитывается только при публикации на стене сообщества и указании параметра from_group. По умолчанию подпись не добавляется.
	 */
	signed?: VkApiBool;

	/** Дата публикации записи в формате unixtime. Если параметр указан, публикация записи будет отложена до указанного времени. */
	publish_date?: number;

	/** Географическая широта отметки, заданная в градусах (от -90 до 90). */
	lat?: string;
	/** Географическая долгота отметки, заданная в градусах (от -180 до 180). */
	long?: string;

	/** Идентификатор места, в котором отмечен пользователь. */
	place_id?: number;

	/** Идентификатор записи, которую необходимо опубликовать. Данный параметр используется для публикации отложенных записей и предложенных новостей. */
	post_id?: number;

	/** Уникальный идентификатор, предназначенный для предотвращения повторной отправки одинаковой записи. Действует в течение одного часа. */
	guid?: string;

	/** 1 — у записи, размещенной от имени сообщества, будет добавлена метка Это реклама, 0 — метки добавлено не будет.
	 * В сутки может быть опубликовано не более пяти рекламных записей, из которых не более трёх — вне Биржи ВКонтакте.
	 */
	mark_as_ads?: VkApiBool;

	/** 1 — комментарии к записи отключены,
	 *  0 — комментарии к записи включены.
	 */
	close_comments?: VkApiBool;

	/** Период времени в течение которого запись будет доступна для донов — платных подписчиков VK Donut. Возможные значения:
	 * -1 — исключительно для донов;
	 * 86400 — на 1 день;
	 * 172800 — на 2 дня;
	 * 259200 — на 3 дня;
	 * 345600 — на 4 дня;
	 * 432000 — на 5 дней;
	 * 518400 — на 6 дней;
	 * 604800 — на 7 дней.
	 */
	donut_paid_duration?: number;

	/**	1 — уведомления к записи  отключены;
	 *  0 — уведомления к записи включены.
	 */
	mute_notifications?: VkApiBool;
	/** Источник материала. Поддерживаются внешние и внутренние ссылки. */
	copyright?: string;
};

export type VkApiPhoto = {
	/** Идентификатор фотографии.  */
	id: number;

	/** Идентификатор альбома, в котором находится фотография.  */
	album_id: number;

	/** Идентификатор владельца фотографии.  */
	owner_id: number;

	/** Идентификатор пользователя, загрузившего фото (если фотография размещена в сообществе). Для фотографий, размещенных от имени сообщества, user_id = 100.  */
	user_id: number;

	/** Текст описания фотографии.  */
	text: string;

	/** Дата добавления в формате Unixtime.  */
	date: number;

	/** Массив с копиями изображения в разных размерах. Каждый объект массива содержит следующие поля:  */
	sizes: {
		/** тип копии. См. Формат описания размеров фотографии. */
		type: string;
		/** URL копии. */
		url: string;
		/** высота в px. */
		width: number;
		/** ширина в px. */
		height: number;
	}[];
	/** Ширина оригинала фотографии в пикселах.  */
	width: number;

	/** Высота оригинала фотографии в пикселах.  */
	height: number;
};
