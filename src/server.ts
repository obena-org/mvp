/**
 * HTTP API server — wraps pipeline() and serves the SvelteKit SPA.
 *
 * In production:  tsx src/server.ts  (or pnpm start)
 * In dev:         pnpm dev:api  (API)  +  pnpm dev:web  (SvelteKit HMR)
 *
 * POST /api/kpa  — run the KPA pipeline, return KPAResult JSON.
 * GET  *         — serve web/build (SvelteKit static output).
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';

import { readHistory } from './cache.js';
import { pipeline } from './index.js';
import { log } from './logger.js';
import type { OnProgress } from './models.js';
import { runKpa } from './pipeline.js';
import { ConfigError, getSettings } from './settings.js';

const _ROOT = resolve(fileURLToPath(import.meta.url), '../../');
const _WEB_BUILD = join(_ROOT, 'web/build');

const RequestSchema = z.object({
	topic: z.string().min(1, 'topic must not be empty'),
	options: z
		.object({
			strategy: z.enum(['bottom-up', 'top-down']).optional(),
			numSources: z.number().int().positive().optional(),
			forceRefresh: z.boolean().optional(),
		})
		.optional(),
});

const StreamQuerySchema = z.object({
	topic: z.string().min(1, 'topic must not be empty'),
	strategy: z.enum(['bottom-up', 'top-down']).optional(),
	numSources: z.coerce.number().int().positive().optional(),
	forceRefresh: z
		.enum(['true', 'false'])
		.optional()
		.transform((v) => v === 'true'),
});

const app = new Hono();

app.get('/api/kpa/stream', (c) => {
	const parsed = StreamQuerySchema.safeParse({
		topic: c.req.query('topic'),
		strategy: c.req.query('strategy'),
		numSources: c.req.query('numSources'),
		forceRefresh: c.req.query('forceRefresh'),
	});
	if (!parsed.success) {
		return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
	}

	const { topic, strategy, numSources, forceRefresh } = parsed.data;
	log.info({ topic, strategy }, 'kpa stream request');

	return streamSSE(c, async (stream) => {
		// Serialised write queue — onProgress is synchronous but writeSSE is async.
		// Queuing ensures ordering and prevents concurrent writes to the SSE stream.
		let writeQueue = Promise.resolve<void>(undefined);
		const send: OnProgress = (event) => {
			writeQueue = writeQueue.then(async () => {
				try {
					await stream.writeSSE({ data: JSON.stringify(event) });
				} catch {
					// client disconnected — swallow
				}
			});
		};

		try {
			const result = await runKpa(topic, strategy ?? 'bottom-up', numSources, forceRefresh, {
				onProgress: send,
			});
			send({ type: 'complete', result });
		} catch (err) {
			send({ type: 'error', message: err instanceof Error ? err.message : 'Pipeline failed' });
		}

		// Drain before the SSE stream closes.
		await writeQueue;
	});
});

app.post('/api/kpa', async (c) => {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: 'Invalid JSON body' }, 400);
	}

	const parsed = RequestSchema.safeParse(body);
	if (!parsed.success) {
		return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400);
	}

	const { topic, options } = parsed.data;
	log.info({ topic, strategy: options?.strategy }, 'kpa request');

	try {
		const result = await pipeline(topic, {
			...(options?.strategy !== undefined && { strategy: options.strategy }),
			...(options?.numSources !== undefined && { numSources: options.numSources }),
			forceRefresh: options?.forceRefresh ?? false,
		});
		log.info({ topic, cacheHit: result.cacheHit, keyPoints: result.keyPoints.length }, 'kpa done');
		return c.json(result);
	} catch (err) {
		log.error({ err, topic }, 'pipeline failed');
		return c.json({ error: 'Pipeline failed' }, 500);
	}
});

app.get('/api/kpa/history', (c) => {
	return c.json(readHistory(getSettings().cacheDir));
});

// Serve SvelteKit static build (CSS, JS, assets).
app.use('*', serveStatic({ root: _WEB_BUILD }));

// SPA fallback — any unmatched route returns index.html so client-side routing works.
app.get('*', async (c) => {
	try {
		const html = await readFile(join(_WEB_BUILD, 'index.html'), 'utf-8');
		return c.html(html);
	} catch {
		return c.text('KPA API server is running. Build the web app first: pnpm build:web', 404);
	}
});

let settings;
try {
	settings = getSettings();
} catch (err) {
	if (err instanceof ConfigError) {
		process.stderr.write(`${err.message}\n`);
		process.exit(1);
	}
	throw err;
}

const server = serve({ fetch: app.fetch, port: settings.port }, (info) => {
	log.info({ port: info.port }, 'KPA server started');
});

server.on('error', (err: Error & { code?: string }) => {
	if (err.code === 'EADDRINUSE') {
		process.stderr.write(
			`Port ${String(settings.port)} is already in use. Set PORT to another value or stop the process using that port.\n`,
		);
		process.exit(1);
	}
	throw err;
});
