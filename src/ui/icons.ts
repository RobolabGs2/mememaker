// TODO: think about it
// https://tabler-icons.io/

import FillIcon from "../../assets/icons/fill.png";
import StrokeIcon from "../../assets/icons/stroke.png";
import ShadowIcon from "../../assets/icons/shadow.png";
import GearIcon from "../../assets/icons/gear.png";

const Icons = {
	ArrowUp: `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-arrow-up" width="16" height="16" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
<line x1="12" y1="5" x2="12" y2="19"></line>
<line x1="18" y1="11" x2="12" y2="5"></line>
<line x1="6" y1="11" x2="12" y2="5"></line>
</svg>`,
	ArrowDown: `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-arrow-down" width="16" height="16" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="18" y1="13" x2="12" y2="19"></line>
    <line x1="6" y1="13" x2="12" y2="19"></line>
 </svg>`,
	Trash: `<svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-trash" width="16" height="16" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
 <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
 <line x1="4" y1="7" x2="20" y2="7"></line>
 <line x1="10" y1="11" x2="10" y2="17"></line>
 <line x1="14" y1="11" x2="14" y2="17"></line>
 <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"></path>
 <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"></path>
</svg>`,
	Shadow: `<img width="24px" height="24px" style="margin: 4px;" src="${ShadowIcon}"/>`,
	Fill: `<img width="24px" height="24px" style="margin: 4px;" src="${FillIcon}"/>`,
	Stroke: `<img width="24px" height="24px" style="margin: 4px;" src="${StrokeIcon}"/>`,
	Experimental: `<img width="24px" height="24px" style="margin: 4px;" src="${GearIcon}"/>`,
};

export default Icons;
