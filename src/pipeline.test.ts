import { describe, expect, it } from 'vitest';

import type { KeyPoint, Source } from './models.js';
import { applySourceAttribution } from './pipeline.js';

describe('applySourceAttribution', () => {
	it('replaces model author/outlet with source metadata when URL matches', () => {
		const sources: Source[] = [
			{
				url: 'https://example.com/a',
				title: 'T',
				author: 'Jane Q. Writer',
				outlet: 'Example Times',
				content: 'x',
			},
		];
		const keyPoints: KeyPoint[] = [
			{
				title: 'K',
				summary: 'S',
				quotes: [
					{
						text: 'quote',
						author: 'Congressman Wrong',
						outlet: 'Wrong Outlet',
						url: 'https://example.com/a',
					},
				],
			},
		];
		const out = applySourceAttribution(keyPoints, sources);
		expect(out[0]?.quotes[0]?.author).toBe('Jane Q. Writer');
		expect(out[0]?.quotes[0]?.outlet).toBe('Example Times');
	});

	it('keeps model attribution when source has no scraped author/outlet', () => {
		const sources: Source[] = [
			{
				url: 'https://example.com/a',
				content: 'x',
			},
		];
		const keyPoints: KeyPoint[] = [
			{
				title: 'K',
				summary: 'S',
				quotes: [
					{
						text: 'q',
						author: 'Fallback Author',
						outlet: 'Fallback Outlet',
						url: 'https://example.com/a',
					},
				],
			},
		];
		const out = applySourceAttribution(keyPoints, sources);
		expect(out[0]?.quotes[0]?.author).toBe('Fallback Author');
		expect(out[0]?.quotes[0]?.outlet).toBe('Fallback Outlet');
	});

	it('leaves quotes unchanged when URL is not in sources', () => {
		const sources: Source[] = [
			{
				url: 'https://example.com/other',
				author: 'X',
				content: 'c',
			},
		];
		const keyPoints: KeyPoint[] = [
			{
				title: 'K',
				summary: 'S',
				quotes: [
					{
						text: 'q',
						author: 'Only Model',
						url: 'https://example.com/missing',
					},
				],
			},
		];
		const out = applySourceAttribution(keyPoints, sources);
		expect(out[0]?.quotes[0]?.author).toBe('Only Model');
	});
});
