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

export function downloadImages<T extends string>(urlsMap: Record<T, string>): Promise<Record<T, HTMLImageElement>> {
	const urls = Object.entries<string>(urlsMap);
	return Promise.all(urls.map(([, url]) => url).map(downloadImage)).then(
		images => Object.fromEntries(images.map((img, i) => [urls[i][0], img])) as Record<T, HTMLImageElement>
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
