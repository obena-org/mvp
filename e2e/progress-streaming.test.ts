/**
 * End-to-end tests for the progress-streaming UI.
 *
 * All API calls are mocked at the browser level via page.route(), so no backend
 * servers need to be running.  The SvelteKit dev server is started automatically
 * by playwright.config.ts (webServer).
 *
 * SSE mocking — two strategies
 * ──────────────────────────────
 * 1. route.fulfill() (batch)
 *    Sends the entire SSE body at once; EventSource dispatches each `data:` line
 *    as a separate task, so Svelte's reactive DOM updates run between events.
 *    Used for tests that only need to verify the final state.
 *
 * 2. Mock EventSource (addInitScript)
 *    For tests that need to observe intermediate UI states (e.g. source counter
 *    at "2 / 2" before `complete` arrives), we replace window.EventSource with
 *    a synchronous mock.  Events are dispatched one at a time from the test via
 *    page.evaluate(), giving precise DOM-state control with no network involved.
 *    This avoids the "onerror fires on connection drop" problem that makes the
 *    two-call route pattern unreliable.
 */

import { type Page, expect, test } from '@playwright/test';

// ── Fixture data ───────────────────────────────────────────────────────────────

const MOCK_RESULT = {
	query: 'Iran',
	strategy: 'bottom-up',
	keyPoints: [
		{
			title: 'Diplomatic tensions escalate',
			summary: 'A brief summary of the key point.',
			quotes: [
				{
					text: 'A meaningful quote from a news source.',
					author: 'Jane Smith',
					outlet: 'Global Times',
					url: 'https://example.com/article',
				},
			],
		},
	],
	sourcesAnalyzed: 2,
	sourceUsage: [
		{
			url: 'https://example.com/article',
			title: 'Example headline',
			outlet: 'Global Times',
			quoteCount: 1,
			keyPointCount: 1,
		},
		{
			url: 'https://unused.example/post',
			title: 'Unused article',
			outlet: 'Unused News',
			quoteCount: 0,
			keyPointCount: 0,
		},
	],
	generatedAt: new Date().toISOString(),
	cacheHit: false,
};

/** Format an array of plain objects as SSE event body (each gets its own data: line). */
function sseBody(events: object[], { retryMs }: { retryMs?: number } = {}): string {
	const retry = retryMs !== undefined ? `retry: ${retryMs}\n\n` : '';
	return retry + events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
}

const SSE_HEADERS = {
	'Content-Type': 'text/event-stream',
	'Cache-Control': 'no-cache',
};

const HAPPY_PATH_EVENTS = [
	{ type: 'status', phase: 'searching', message: 'Searching for sources…' },
	{ type: 'status', phase: 'processing', message: 'Processing sources…' },
	{ type: 'source-done', completed: 1, total: 2, url: 'https://a.test', ok: true },
	{ type: 'source-done', completed: 2, total: 2, url: 'https://b.test', ok: true },
	{ type: 'status', phase: 'synthesizing', message: 'Synthesising key points…' },
	{ type: 'complete', result: MOCK_RESULT },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Fill the topic input and click Analyse. */
async function submitTopic(page: Page, topic: string) {
	await page.getByLabel('Topic to analyse').fill(topic);
	await page.getByRole('button', { name: 'Analyse' }).click();
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('progress streaming', () => {
	test('displays key-point cards after a complete SSE stream', async ({ page }) => {
		await page.route('/api/kpa/stream*', (route) =>
			route.fulfill({ status: 200, headers: SSE_HEADERS, body: sseBody(HAPPY_PATH_EVENTS) }),
		);

		await page.goto('/');
		await submitTopic(page, 'Iran');

		// Result card appears and loading is gone
		await expect(page.locator('article').first()).toBeVisible();
		await expect(page.locator('h1')).toContainText('Iran');
		await expect(page.getByText('2 sources')).toBeVisible();
		await expect(page.locator('[aria-live="polite"]')).not.toBeVisible();
	});

	test('shows loading banner and disables submit while stream is open', async ({ page }) => {
		let release: () => void;
		const hold = new Promise<void>((resolve) => {
			release = resolve;
		});

		await page.route('/api/kpa/stream*', async (route) => {
			await hold;
			await route.fulfill({
				status: 200,
				headers: SSE_HEADERS,
				body: sseBody(HAPPY_PATH_EVENTS),
			});
		});

		await page.goto('/');
		await submitTopic(page, 'Iran');

		// While the SSE stream is still open, the loading UI should be active.
		// Note: button text changes to "Analysing…" while loading, so we match by type.
		const loadingBanner = page.locator('[aria-live="polite"]');
		await expect(loadingBanner).toBeVisible();
		await expect(page.locator('button[type="submit"]')).toBeDisabled();

		// Release the mock stream; result should appear
		release!();
		await expect(page.locator('article').first()).toBeVisible();
		await expect(loadingBanner).not.toBeVisible();
	});

	test('shows live source counter during processing phase', async ({ page }) => {
		// Uses a mock EventSource (injected before app scripts) so we can dispatch
		// events one at a time and observe the DOM between each one.
		// This avoids the "onerror fires on connection drop" problem that makes
		// the two-call route.fulfill() pattern unreliable for intermediate states.
		await page.addInitScript(() => {
			class MockEventSource {
				readyState = 1; // OPEN
				onmessage: ((e: { data: string }) => void) | null = null;
				onerror: ((e: Event) => void) | null = null;
				constructor(_url: string) {
					(window as any).__mockSse = this;
				}
				close() {
					this.readyState = 2;
				}
			}
			(window as any).EventSource = MockEventSource;
		});

		await page.goto('/');
		await submitTopic(page, 'Iran');

		// Wait until streamKpa has set up the onmessage handler on the mock.
		await page.waitForFunction(() => !!(window as any).__mockSse?.onmessage);

		const dispatch = (event: object) =>
			page.evaluate((data) => (window as any).__mockSse.onmessage({ data }), JSON.stringify(event));

		await dispatch({ type: 'status', phase: 'searching', message: 'Searching for sources…' });
		await dispatch({ type: 'status', phase: 'processing', message: 'Processing sources…' });
		await dispatch({
			type: 'source-done',
			completed: 1,
			total: 2,
			url: 'https://a.test',
			ok: true,
		});
		await dispatch({
			type: 'source-done',
			completed: 2,
			total: 2,
			url: 'https://b.test',
			ok: true,
		});

		// Counter should be visible at "2 / 2"; loading is still true (no complete yet).
		await expect(page.getByText('2 / 2')).toBeVisible();

		await dispatch({ type: 'status', phase: 'synthesizing', message: 'Synthesising key points…' });
		await dispatch({ type: 'complete', result: MOCK_RESULT });

		// Result rendered; counter gone (loading ended).
		await expect(page.locator('article').first()).toBeVisible();
		await expect(page.getByText('2 / 2')).not.toBeVisible();
	});

	test('shows "Searching" then "Processing" phase labels', async ({ page }) => {
		// Same mock EventSource approach — checks banner text at each phase transition.
		await page.addInitScript(() => {
			class MockEventSource {
				readyState = 1;
				onmessage: ((e: { data: string }) => void) | null = null;
				onerror: ((e: Event) => void) | null = null;
				constructor(_url: string) {
					(window as any).__mockSse = this;
				}
				close() {
					this.readyState = 2;
				}
			}
			(window as any).EventSource = MockEventSource;
		});

		await page.goto('/');
		await submitTopic(page, 'Iran');
		await page.waitForFunction(() => !!(window as any).__mockSse?.onmessage);

		const dispatch = (event: object) =>
			page.evaluate((data) => (window as any).__mockSse.onmessage({ data }), JSON.stringify(event));

		const banner = page.locator('[aria-live="polite"]');

		await dispatch({ type: 'status', phase: 'searching', message: 'Searching for sources…' });
		await expect(banner).toContainText('Searching for sources');

		await dispatch({ type: 'status', phase: 'processing', message: 'Processing sources…' });
		await expect(banner).toContainText('Processing sources');

		await dispatch({ type: 'status', phase: 'synthesizing', message: 'Synthesising key points…' });
		await expect(banner).toContainText('Synthesising key points');

		await dispatch({ type: 'complete', result: MOCK_RESULT });
		await expect(page.locator('article').first()).toBeVisible();
	});

	test('shows error banner when stream emits an error event', async ({ page }) => {
		await page.route('/api/kpa/stream*', (route) =>
			route.fulfill({
				status: 200,
				headers: SSE_HEADERS,
				body: sseBody([{ type: 'error', message: 'Pipeline failed' }]),
			}),
		);

		await page.goto('/');
		await submitTopic(page, 'Iran');

		const alert = page.getByRole('alert');
		await expect(alert).toBeVisible();
		await expect(alert).toContainText('Pipeline failed');
		// Loading is gone; submit re-enabled
		await expect(page.locator('[aria-live="polite"]')).not.toBeVisible();
		await expect(page.getByRole('button', { name: 'Analyse' })).toBeEnabled();
	});

	test('auto-submits when topic is present in the URL query string', async ({ page }) => {
		await page.route('/api/kpa/stream*', (route) =>
			route.fulfill({ status: 200, headers: SSE_HEADERS, body: sseBody(HAPPY_PATH_EVENTS) }),
		);

		// Navigate with ?topic= — onMount should trigger submit automatically
		await page.goto('/?topic=Iran');

		await expect(page.locator('article').first()).toBeVisible();
		await expect(page.locator('h1')).toContainText('Iran');
	});
});
