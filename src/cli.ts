#!/usr/bin/env tsx
/**
 * CLI entry point: `npx tsx src/cli.ts` or `npm run kpa`.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Command } from 'commander';

import { printArgGraph, printResult } from './display.js';
import { pipeline } from './index.js';
import { runKpa } from './pipeline.js';
import { ConfigError } from './settings.js';
import type { ArgGraphSummary } from './taxonomy-models.js';

function defaultOutPath(query: string, fmt: string): string {
	const slug = query
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	const ext = fmt === 'json' ? 'json' : 'txt';
	return `/tmp/kpa-${slug}.${ext}`;
}

const program = new Command();

program
	.name('kpa')
	.description('Key Points Analysis — extract structured perspectives from op-ed content')
	.argument('<query>', 'Topic to analyse (e.g. "Iran")')
	.option('--strategy <strategy>', 'Extraction strategy: bottom-up or top-down', 'bottom-up')
	.option('--num-sources <n>', 'Number of articles to fetch (default: from settings)', parseInt)
	.option('--force-refresh', 'Bypass all cache reads and re-fetch/re-extract everything', false)
	.option('--output <format>', 'Output format: pretty, taxonomy, or json', 'pretty')
	.option(
		'--out [path]',
		'Write to file instead of stdout; omit path for auto /tmp/kpa-<slug>.<ext>',
	)
	.action(async (query: string, opts) => {
		const isTaxonomy = opts.output === 'taxonomy';
		const isJson = opts.output === 'json';

		if (isTaxonomy) {
			// Taxonomy mode: run pipeline with onArgGraph callback
			let capturedGraph: ArgGraphSummary | undefined;
			const result = await runKpa(query, opts.strategy, opts.numSources, opts.forceRefresh, {
				onArgGraph: (g) => {
					capturedGraph = g;
				},
			});

			if (opts.out !== undefined) {
				const outPath =
					opts.out === true || opts.out === ''
						? defaultOutPath(query, 'txt')
						: resolve(opts.out as string);
				const lines: string[] = [];
				if (capturedGraph) printArgGraph(capturedGraph, (s) => lines.push(s));
				else printResult(result, (s) => lines.push(s));
				// eslint-disable-next-line no-control-regex
				writeFileSync(outPath, lines.join('\n').replace(/\x1b\[[0-9;]*m/g, ''), 'utf8');
				process.stderr.write(`Written to ${outPath}\n`);
			} else if (capturedGraph) {
				printArgGraph(capturedGraph);
			} else {
				printResult(result);
			}
			return;
		}

		const result = await pipeline(query, {
			strategy: opts.strategy,
			numSources: opts.numSources,
			forceRefresh: opts.forceRefresh,
		});

		if (opts.out !== undefined) {
			const outPath =
				opts.out === true || opts.out === ''
					? defaultOutPath(query, opts.output)
					: resolve(opts.out as string);

			if (isJson) {
				writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
			} else {
				const lines: string[] = [];
				printResult(result, (s) => lines.push(s));
				// eslint-disable-next-line no-control-regex
				const plain = lines.join('\n').replace(/\x1b\[[0-9;]*m/g, '');
				writeFileSync(outPath, plain, 'utf8');
			}
			process.stderr.write(`Written to ${outPath}\n`);
		} else if (isJson) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			printResult(result);
		}
	});

program.parseAsync(process.argv).catch((err: unknown) => {
	if (err instanceof ConfigError) {
		console.error(err.message);
		process.exit(1);
	}
	console.error(err);
	process.exit(1);
});
