/*
	Typescript не умеет импротить произвольные файлы, это делает сборщик (parcel)
	Для тайпчекера объявим, что модули с картинками - это нормально
*/

type RecursiveRecord<T> = T | { [key: string]: RecursiveRecord<T> };
type ParcelBlobURLs = RecursiveRecord<string>;

declare module "*.png" {
	const value: ParcelBlobURLs;
	export = value;
}

declare module "*.jpg" {
	const value: ParcelBlobURLs;
	export = value;
}

declare module "*.ogg" {
	const value: string;
	export = value;
}

declare module "*.meme" {
	const value: string;
	export = value;
}

declare module "*.html" {
	const value: string;
	export = value;
}
