import placeholdersURLs from "../assets/placeholders/INSIDE/*/*.png";
import patternsURLs from "../assets/materials/patterns/*.png";
import { downloadImagesParcelRecord } from "./http_helpers";
import { App } from "./app";

downloadImagesParcelRecord({
	placeholders: placeholdersURLs,
	patterns: patternsURLs,
}).then(({ placeholders, patterns }) => {
	new App(
		Object.fromEntries(
			Object.entries(placeholders).map(([key, map]) => [key, Object.entries(map).map(([, img]) => img)])
		) as Record<"downloading" | "empty", HTMLImageElement[]>,
		patterns as Record<string, HTMLImageElement>,
		["Impact", "Lobster", "Arial", "Helvetica", "Next art", "Pacifico", "Caveat", "Comforter"]
	);
});
