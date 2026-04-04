/**
 * Minimal type declaration for the unfluff package (no upstream @types).
 * Only the fields consumed by fetcher.ts are declared.
 *
 * Note: unfluff returns arrays for multi-value fields (e.g. multiple authors).
 */

declare module 'unfluff' {
	interface UnfluffResult {
		author: string[] | null;
		title: string | null;
		date: string | null;
		description: string | null;
		text: string | null;
		tags: string[];
	}

	function unfluff(html: string): UnfluffResult;
	export = unfluff;
}
