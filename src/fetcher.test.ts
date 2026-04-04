/**
 * Tests for fetcher.ts — _normalizeAuthor unit tests + Unfluff integration
 * tests against real HTML fixtures copied from obena/apps/pipeline/tests/.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import unfluff from 'unfluff';
import { describe, expect, it } from 'vitest';

import { _extractJsonLdAuthor, _normalizeAuthor } from './fetcher.js';

const FIXTURES = join(fileURLToPath(import.meta.url), '../../tests/fixtures/pages/articles');

// ── _normalizeAuthor unit tests ───────────────────────────────────────────────

describe('_normalizeAuthor — null/empty inputs', () => {
	it('returns null for null', () => expect(_normalizeAuthor(null, null)).toBeNull());
	it('returns null for undefined', () => expect(_normalizeAuthor(undefined, null)).toBeNull());
	it('returns null for empty string', () => expect(_normalizeAuthor('', null)).toBeNull());
	it('returns null for whitespace-only string', () =>
		expect(_normalizeAuthor('   ', null)).toBeNull());
	it('returns null for empty array', () => expect(_normalizeAuthor([], null)).toBeNull());
});

describe('_normalizeAuthor — "By" prefix stripping', () => {
	it('strips "By " (title case)', () =>
		expect(_normalizeAuthor('By John Smith', null)).toBe('John Smith'));
	it('strips "by " (lowercase)', () =>
		expect(_normalizeAuthor('by Jane Doe', null)).toBe('Jane Doe'));
	it('strips "BY " (uppercase)', () =>
		expect(_normalizeAuthor('BY John Smith', null)).toBe('John Smith'));
	it('does not strip "By" mid-string', () =>
		expect(_normalizeAuthor('Goodbye Smith', null)).toBe('Goodbye Smith'));
});

describe('_normalizeAuthor — URL-shaped authors (NYT pattern)', () => {
	it('extracts name from /by/{slug} URL', () =>
		expect(_normalizeAuthor('https://www.nytimes.com/by/david-brooks', null)).toBe('David Brooks'));
	it('title-cases hyphenated slug', () =>
		expect(_normalizeAuthor('https://example.com/by/maggie-haberman', null)).toBe(
			'Maggie Haberman',
		));
	it('returns null for URL without /by/ segment', () =>
		expect(_normalizeAuthor('https://example.com/author/profile', null)).toBeNull());
	it('handles URL inside an array', () =>
		expect(_normalizeAuthor(['https://www.nytimes.com/by/david-brooks'], null)).toBe(
			'David Brooks',
		));
	it('skips invalid URL and returns next valid candidate', () =>
		expect(_normalizeAuthor(['https://example.com/no-by', 'Jane Doe'], null)).toBe('Jane Doe'));
});

describe('_normalizeAuthor — placeholder rejection', () => {
	it('rejects "staff"', () => expect(_normalizeAuthor('staff', null)).toBeNull());
	it('rejects "Staff" (case-insensitive)', () =>
		expect(_normalizeAuthor('Staff', null)).toBeNull());
	it('rejects "editors"', () => expect(_normalizeAuthor('editors', null)).toBeNull());
	it('rejects "editorial board"', () =>
		expect(_normalizeAuthor('editorial board', null)).toBeNull());
	it('rejects "editorial staff"', () =>
		expect(_normalizeAuthor('editorial staff', null)).toBeNull());
	it('rejects "wire services"', () => expect(_normalizeAuthor('wire services', null)).toBeNull());
	it('rejects "@handle" (social media handle)', () =>
		expect(_normalizeAuthor('@nypost', null)).toBeNull());
	it('rejects "@PersonHandle" (twitter creator handle)', () =>
		expect(_normalizeAuthor('@RalphOrtega', null)).toBeNull());
	it('rejects bare "By" (no following name)', () =>
		expect(_normalizeAuthor('By', null)).toBeNull());
	it('rejects "by" (lowercase)', () => expect(_normalizeAuthor('by', null)).toBeNull());
	it('does NOT reject "By John Smith" (strips prefix, keeps name)', () =>
		expect(_normalizeAuthor('By John Smith', null)).toBe('John Smith'));
});

describe('_normalizeAuthor — outlet-name rejection', () => {
	it('rejects when string exactly matches outlet', () =>
		expect(_normalizeAuthor('New York Times', 'New York Times')).toBeNull());
	it('rejects case-insensitively against outlet', () =>
		expect(_normalizeAuthor('new york times', 'New York Times')).toBeNull());
	it('does NOT reject when outlet is null', () =>
		expect(_normalizeAuthor('New York Times', null)).toBe('New York Times'));
});

describe('_normalizeAuthor — valid strings preserved as-is', () => {
	it('preserves role suffix', () =>
		expect(_normalizeAuthor('Jane Smith, Columnist', null)).toBe('Jane Smith, Columnist'));
	it('preserves multi-author string', () =>
		expect(_normalizeAuthor('Alice and Bob', null)).toBe('Alice and Bob'));
	it('preserves original capitalization', () =>
		expect(_normalizeAuthor('JOHN SMITH', null)).toBe('JOHN SMITH'));
	it('preserves mixed-case name', () =>
		expect(_normalizeAuthor('Kareem Rifai, opinion contributor', null)).toBe(
			'Kareem Rifai, opinion contributor',
		));
});

describe('_normalizeAuthor — array handling', () => {
	it('returns first valid element', () =>
		expect(_normalizeAuthor(['John Smith', 'Jane Doe'], null)).toBe('John Smith'));
	it('skips empty elements and returns next valid', () =>
		expect(_normalizeAuthor(['', '  ', 'John Smith'], null)).toBe('John Smith'));
	it('skips rejected placeholder and returns next valid', () =>
		expect(_normalizeAuthor(['staff', 'John Smith'], null)).toBe('John Smith'));
	it('returns null when all elements are invalid', () =>
		expect(_normalizeAuthor(['staff', 'editors'], null)).toBeNull());
});

// ── Unfluff + _normalizeAuthor integration on real HTML fixtures ──────────────

describe('author extraction from real HTML fixtures', () => {
	it('NYT David Brooks farewell column → "David Brooks"', () => {
		const html = readFileSync(
			join(FIXTURES, 'Opinion _ A Farewell Column From David Brooks - The New York Times.html'),
			'utf-8',
		);
		const author = _normalizeAuthor(unfluff(html).author, 'nytimes.com');
		expect(author).toBe('David Brooks');
	});

	it('Newsweek Venezuela piece → "John Davenport"', () => {
		const html = readFileSync(
			join(FIXTURES, 'Let Venezuela be Free at Last _ Opinion - Newsweek.html'),
			'utf-8',
		);
		const author = _normalizeAuthor(unfluff(html).author, 'newsweek.com');
		expect(author).toBe('John Davenport');
	});

	it('The Hill Gabbard piece → contains "Kareem Rifai"', () => {
		const html = readFileSync(
			join(FIXTURES, 'Trump administration excludes Gabbard from Venezuela operation.html'),
			'utf-8',
		);
		const author = _normalizeAuthor(unfluff(html).author, 'thehill.com');
		expect(author).not.toBeNull();
		expect(author).toContain('Kareem Rifai');
	});

	it('Arkansas Democrat-Gazette Steinbuch piece → contains "Robert Steinbuch"', () => {
		const html = readFileSync(
			join(
				FIXTURES,
				"OPINION _ ROBERT STEINBUCH_ March Madness _ The Arkansas Democrat-Gazette - Arkansas' Best News Source.html",
			),
			'utf-8',
		);
		const author = _normalizeAuthor(unfluff(html).author, 'arkansasonline.com');
		expect(author).not.toBeNull();
		expect(author).toContain('Robert Steinbuch');
	});

	it('NYT multi-author piece → returns first author name', () => {
		const html = readFileSync(
			join(
				FIXTURES,
				"Should I Fire Him - Inside Trump's Deliberations Over the Fate of Michael Waltz - The New York Times.html",
			),
			'utf-8',
		);
		const author = _normalizeAuthor(unfluff(html).author, 'nytimes.com');
		// NYT multi-author articles list URLs like /by/maggie-haberman — first valid should resolve
		expect(author).not.toBeNull();
	});
});

// ── _extractJsonLdAuthor unit tests ──────────────────────────────────────────

describe('_extractJsonLdAuthor — basic cases', () => {
	it('returns null for empty string', () => expect(_extractJsonLdAuthor('')).toBeNull());
	it('returns null when no JSON-LD script is present', () =>
		expect(_extractJsonLdAuthor('<html><head></head><body></body></html>')).toBeNull());
	it('returns null when JSON-LD has no author field', () =>
		expect(
			_extractJsonLdAuthor(
				'<script type="application/ld+json">{"@type":"NewsArticle","headline":"foo"}</script>',
			),
		).toBeNull());
});

describe('_extractJsonLdAuthor — author shapes', () => {
	it('extracts author.name from object', () =>
		expect(
			_extractJsonLdAuthor(
				'<script type="application/ld+json">{"@type":"NewsArticle","author":{"@type":"Person","name":"Jane Smith"}}</script>',
			),
		).toBe('Jane Smith'));

	it('extracts author[0].name from array of objects', () =>
		expect(
			_extractJsonLdAuthor(
				'<script type="application/ld+json">{"@type":"NewsArticle","author":[{"name":"Alice"},{"name":"Bob"}]}</script>',
			),
		).toBe('Alice'));

	it('extracts author as plain string', () =>
		expect(
			_extractJsonLdAuthor(
				'<script type="application/ld+json">{"@type":"Article","author":"John Doe"}</script>',
			),
		).toBe('John Doe'));

	it('extracts author from @graph array', () =>
		expect(
			_extractJsonLdAuthor(
				'<script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","author":{"name":"Graph Author"}}]}</script>',
			),
		).toBe('Graph Author'));

	it('skips malformed JSON-LD block and returns null', () =>
		expect(
			_extractJsonLdAuthor('<script type="application/ld+json">{bad json}</script>'),
		).toBeNull());

	it('returns null when author array is empty', () =>
		expect(
			_extractJsonLdAuthor(
				'<script type="application/ld+json">{"@type":"Article","author":[]}</script>',
			),
		).toBeNull());
});
