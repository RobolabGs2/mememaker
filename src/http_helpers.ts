export function downloadImage(url: string): Promise<HTMLImageElement> {
	return new Promise(function (resolve, reject) {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = function () {
			return resolve(img);
		};
		img.onerror = function () {
			return reject(new Error(`Can't load image ${url}`));
		};
		img.src = url;
	});
}

export function downloadImagesParcel<T extends ParcelBlobURLs>(urlsMap: T): Promise<RecursiveRecord<HTMLImageElement>> {
	if (typeof urlsMap === "string") {
		return downloadImage(urlsMap);
	}
	return downloadImagesArray(flatRecursiveRecordEntries(urlsMap)).then(recursiveRecordFromEntries);
}

export function downloadImagesParcelRecord<T extends string>(
	urlsMap: Record<T, ParcelBlobURLs>
): Promise<Record<T, RecursiveRecord<HTMLImageElement>>> {
	return downloadImagesArray(flatRecursiveRecordEntries(urlsMap as RecursiveRecord<T>)).then(
		recursiveRecordFromEntries
	) as Promise<Record<T, RecursiveRecord<HTMLImageElement>>>;
}

function flatRecursiveRecordEntries<T>(r: RecursiveRecord<T>, delimiter = ">"): [string, T][] {
	return Object.entries(r as { [s: string]: T })
		.map(([key, rr]: [string, T]) => {
			if (typeof rr !== "object") return [[key, rr]] as [string, T][];
			return flatRecursiveRecordEntries(rr).map(([innerKey, value]) => [`${key}${delimiter}${innerKey}`, value]);
		})
		.flat(1) as [string, T][];
}

function recursiveRecordFromEntries<T>(entries: [string, T][], delimiter = ">"): RecursiveRecord<T> {
	return entries.reduce((acc, [key, value]) => {
		const keys = key.split(delimiter);
		if (keys.length === 1) {
			acc[key] = value;
			return acc;
		}
		keys.slice(0, -1).reduce((obj, partOfKey) => {
			if (!obj[partOfKey]) obj[partOfKey] = {};
			return obj[partOfKey] as Record<string, RecursiveRecord<T>>;
		}, acc)[keys[keys.length - 1]] = value;
		return acc;
	}, {} as Record<string, RecursiveRecord<T>>);
}

export function downloadImages<T extends string>(urlsMap: Record<T, string>): Promise<Record<T, HTMLImageElement>> {
	const urls = Object.entries<string>(urlsMap) as [T, string][];
	return downloadImagesArray(urls).then(Object.fromEntries);
}

export function downloadImagesArray<T>(urls: [T, string][]): Promise<[T, HTMLImageElement][]> {
	return Promise.all(urls.map(([, url]) => url).map(downloadImage)).then(
		images => images.map((img, i) => [urls[i][0], img]) as [T, HTMLImageElement][]
	);
}

function downloadFile(url: string) {
	return fetch(url).then(res => res.text());
}

export function downloadFiles<T extends string>(urlsMap: Record<T, string>): Promise<Record<T, string>> {
	const urls = Object.entries<string>(urlsMap);
	return Promise.all(urls.map(([, url]) => url).map(downloadFile)).then(
		images => Object.fromEntries(images.map((file, i) => [urls[i][0], file])) as Record<T, string>
	);
}

export function downloadResources<I extends string, F extends string>(
	images: Record<I, string>,
	files: Record<F, string>
) {
	return Promise.all([downloadImages(images), downloadFiles(files)]).then(([images, files]) => ({ images, files }));
}

export function downloadBlobAs(filename: string) {
	return (blob: Blob) => {
		const a = document.createElement("a");
		a.download = filename;
		a.href = URL.createObjectURL(blob);
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	};
}

export function readBlobAsURL(blob: Blob): Promise<string> {
	const reader = new FileReader();
	const promise = new Promise<string>((resolve, reject) => {
		reader.addEventListener("load", () => resolve(reader.result as string));
		reader.addEventListener("error", () => reject(reader.error));
	});
	reader.readAsDataURL(blob);
	return promise;
}
