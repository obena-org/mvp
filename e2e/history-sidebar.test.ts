/**
 * End-to-end tests for the history sidebar.
 *
 * All API calls are mocked at the browser level via page.route(), so no
 * backend servers need to be running. The SvelteKit dev server is started
 * automatically by playwright.config.ts (webServer).
 *
 * Key facts about the sidebar:
 *  - Opens by default (sidebarOpen initialises to true in layout).
 *  - History is fetched in onMount; results appear without user interaction.
 *  - Clicking an entry fills the topic input and submits the query.
 *  - History is re-fetched from /api/kpa/history after each run completes.
 */

import { type Page, expect, test } from '@playwright/test';

// ── Fixture data ───────────────────────────────────────────────────────────────

const MOCK_HISTORY = [
	{
		query: 'Iran',
		strategy: 'bottom-up',
		searchFetchedAt: new Date(Date.now() - 3_600_000).toISOString(), // 1h ago
	},
	{
		query: 'Brooklyn Marine Terminal',
		strategy: 'bottom-up',
		searchFetchedAt: new Date(Date.now() - 7_200_000).toISOString(), // 2h ago
	},
];

const MOCK_RESULT = {
	query: 'Iran',
	strategy: 'bottom-up',
	keyPoints: [
		{
			title: 'Diplomatic tensions escalate',
			summary: 'A brief summary.',
			quotes: [
				{
					text: 'A meaningful quote.',
					author: 'Jane Smith',
					outlet: 'Global Times',
					url: 'https://example.com/article',
				},
			],
		},
	],
	sourcesAnalyzed: 1,
	sourceUsage: [
		{
			url: 'https://example.com/article',
			title: 'Example headline',
			outlet: 'Global Times',
			quoteCount: 1,
			keyPointCount: 1,
		},
	],
	generatedAt: new Date().toISOString(),
	searchFetchedAt: new Date().toISOString(),
	cacheHit: true,
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const SSE_HEADERS = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' };

function sseBody(events: object[]): string {
	return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
}

/** Stub GET /api/kpa/history with the given entries (defaults to MOCK_HISTORY). */
async function stubHistory(page: Page, entries = MOCK_HISTORY) {
	await page.route('/api/kpa/history', (route) =>
		route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(entries) }),
	);
}

/** Stub GET /api/kpa/stream* to emit a single complete event with MOCK_RESULT. */
async function stubStream(page: Page, result = MOCK_RESULT) {
	await page.route('/api/kpa/stream*', (route) =>
		route.fulfill({
			status: 200,
			headers: SSE_HEADERS,
			body: sseBody([
				{ type: 'status', phase: 'searching', message: 'Searching…' },
				{ type: 'complete', result },
			]),
		}),
	);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('history sidebar', () => {
	test('is open by default and shows history from API', async ({ page }) => {
		await stubHistory(page);
		await page.goto('/');

		const sidebar = page.getByRole('complementary', { name: 'Recent queries' });
		await expect(sidebar).toBeVisible();
		await expect(sidebar.getByText('Iran')).toBeVisible();
		await expect(sidebar.getByText('Brooklyn Marine Terminal')).toBeVisible();
	});

	test('shows empty state when history API returns no entries', async ({ page }) => {
		await stubHistory(page, []);
		await page.goto('/');

		const sidebar = page.getByRole('complementary', { name: 'Recent queries' });
		await expect(sidebar).toBeVisible();
		await expect(sidebar).toContainText('No recent queries yet.');
	});

	test('× button inside panel closes the sidebar', async ({ page }) => {
		await stubHistory(page);
		await page.goto('/');

		const sidebar = page.getByRole('complementary', { name: 'Recent queries' });
		await expect(sidebar).toBeVisible();

		await sidebar.getByRole('button', { name: 'Close' }).click();
		await expect(sidebar).not.toBeVisible();
	});

	test('header toggle closes and reopens sidebar', async ({ page }) => {
		await stubHistory(page);
		await page.goto('/');

		const sidebar = page.getByRole('complementary', { name: 'Recent queries' });
		await expect(sidebar).toBeVisible();

		// Close via header toggle
		await page.getByRole('button', { name: 'Close recent queries' }).click();
		await expect(sidebar).not.toBeVisible();

		// Reopen
		await page.getByRole('button', { name: 'Open recent queries' }).click();
		await expect(sidebar).toBeVisible();
	});

	test('clicking a history entry fills the input and runs the query', async ({ page }) => {
		await stubHistory(page);
		await stubStream(page);
		await page.goto('/');

		const sidebar = page.getByRole('complementary', { name: 'Recent queries' });
		await expect(sidebar.getByText('Iran')).toBeVisible();

		// Click the Iran entry (filter by text to distinguish from other buttons)
		await sidebar.getByRole('button').filter({ hasText: 'Iran' }).click();

		// Input is set, sidebar closes, result renders
		await expect(page.getByLabel('Topic to analyse')).toHaveValue('Iran');
		await expect(page.locator('article').first()).toBeVisible();
		await expect(page.locator('h1')).toContainText('Iran');
		await expect(sidebar).not.toBeVisible();
	});

	test('sidebar is closed while a query loads, reopens when result arrives', async ({ page }) => {
		await stubHistory(page);

		// Hold the stream open so we can observe the in-progress state
		let release: () => void;
		const hold = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route('/api/kpa/stream*', async (route) => {
			await hold;
			await route.fulfill({
				status: 200,
				headers: SSE_HEADERS,
				body: sseBody([{ type: 'complete', result: MOCK_RESULT }]),
			});
		});

		await page.goto('/');
		const sidebar = page.getByRole('complementary', { name: 'Recent queries' });

		// Click an entry — sidebar should close immediately
		await sidebar.getByRole('button').filter({ hasText: 'Iran' }).click();
		await expect(sidebar).not.toBeVisible();

		// Release the stream
		release!();
		await expect(page.locator('article').first()).toBeVisible();
	});

	test('history refreshes after a run completes', async ({ page }) => {
		// First call returns one entry; subsequent calls return two
		let callCount = 0;
		await page.route('/api/kpa/history', (route) => {
			callCount++;
			const entries = callCount === 1 ? [MOCK_HISTORY[0]] : MOCK_HISTORY;
			return route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(entries) });
		});
		await stubStream(page);

		await page.goto('/');
		const sidebar = page.getByRole('complementary', { name: 'Recent queries' });

		// Initially only Iran is present
		await expect(sidebar.getByText('Iran')).toBeVisible();
		await expect(sidebar.getByText('Brooklyn Marine Terminal')).not.toBeVisible();

		// Submit a query from the main input
		await page.getByLabel('Topic to analyse').fill('Iran');
		await page.getByRole('button', { name: 'Analyse' }).click();
		await expect(page.locator('article').first()).toBeVisible();

		// Reopen sidebar and check both entries are now shown
		await page.getByRole('button', { name: 'Open recent queries' }).click();
		await expect(sidebar.getByText('Brooklyn Marine Terminal')).toBeVisible();
	});
});
