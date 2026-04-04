import type { Action } from 'svelte/action';

/** Move the node to `document.body` so fixed/z-index escapes parent stacking (e.g. sticky headers). */
export const portal: Action<HTMLElement> = (node) => {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		},
	};
};
