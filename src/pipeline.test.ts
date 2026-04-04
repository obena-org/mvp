import { describe, expect, it } from 'vitest';

import type { KeyPoint, Source } from './models.js';
import { applySourceAttribution, computeSourceUsage } from './pipeline.js';

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

describe('computeSourceUsage', () => {
	it('counts quotes and distinct key points per source URL', () => {
		const sources: Source[] = [
			{ url: 'https://a.test/1', title: 'A', outlet: 'Pub A', content: 'x' },
			{ url: 'https://b.test/2', title: 'B', outlet: 'Pub B', content: 'y' },
		];
		const keyPoints: KeyPoint[] = [
			{
				title: 'K1',
				summary: 'S',
				quotes: [
					{ text: 'q1', url: 'https://a.test/1' },
					{ text: 'q2', url: 'https://a.test/1' },
				],
			},
			{
				title: 'K2',
				summary: 'S',
				quotes: [{ text: 'q3', url: 'https://b.test/2' }],
			},
		];
		const u = computeSourceUsage(sources, keyPoints);
		expect(u).toHaveLength(2);
		expect(u[0]).toMatchObject({
			url: 'https://a.test/1',
			quoteCount: 2,
			keyPointCount: 1,
		});
		expect(u[1]).toMatchObject({
			url: 'https://b.test/2',
			quoteCount: 1,
			keyPointCount: 1,
		});
	});

	it('lists uncited sources with zero counts', () => {
		const sources: Source[] = [{ url: 'https://only.test/x', content: 'c' }];
		const keyPoints: KeyPoint[] = [
			{
				title: 'K',
				summary: 'S',
				quotes: [{ text: 'q', url: 'https://other.test/y' }],
			},
		];
		const u = computeSourceUsage(sources, keyPoints);
		expect(u).toHaveLength(1);
		expect(u[0]).toMatchObject({
			url: 'https://only.test/x',
			quoteCount: 0,
			keyPointCount: 0,
		});
	});
});
