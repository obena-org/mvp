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
import { z } from 'zod';

import { pipeline } from './index.js';
import { log } from './logger.js';
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

const app = new Hono();

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
