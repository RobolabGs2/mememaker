export type Styles = {
	label: string;
	label_active: string;
	"tabs-container": string;
	"tabs-container__content": string;
	"tabs-container__labels": string;
};

export type ClassNames = keyof Styles;

declare const styles: Styles;

export default styles;
