/**
 * Terminal display for KPA results.
 * Mirrors rnd-kpa/src/rnd_kpa/display.py using chalk.
 */

import chalk from 'chalk';

import type { KPAResult } from './models.js';

function _age(dt: Date): string {
	const seconds = Math.floor((Date.now() - dt.getTime()) / 1000);
	if (seconds < 60) return 'just now';
	if (seconds < 3600) {
		const m = Math.floor(seconds / 60);
		return `${m} minute${m !== 1 ? 's' : ''} ago`;
	}
	if (seconds < 86400) {
		const h = Math.floor(seconds / 3600);
		return `${h} hour${h !== 1 ? 's' : ''} ago`;
	}
	const d = Math.floor(seconds / 86400);
	return `${d} day${d !== 1 ? 's' : ''} ago`;
}

function _rule(label: string, width = 100): string {
	const padded = ` ${label} `;
	const sides = Math.max(0, width - padded.length);
	const left = Math.floor(sides / 2);
	const right = sides - left;
	return chalk.blueBright('─'.repeat(left) + padded + '─'.repeat(right));
}

export function printResult(result: KPAResult, write: (s: string) => void = console.log): void {
	const ts = new Date(result.generatedAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
	const age = _age(new Date(result.generatedAt));
	const cacheLabel = result.cacheHit ? `cached · ${ts} (${age})` : `fresh · ${ts}`;

	write('');
	write(
		chalk.bold('Key Points: ') +
			chalk.bold.cyan(`"${result.query}"`) +
			chalk.dim('  ·  strategy: ') +
			chalk.dim.cyan(result.strategy) +
			chalk.dim('  ·  sources: ') +
			chalk.dim.cyan(String(result.sourcesAnalyzed)),
	);
	write(chalk.dim(`  ${cacheLabel}`));

	if (result.keyPoints.length === 0) {
		write(chalk.yellow('\nNo key points extracted.'));
		return;
	}

	for (const [i, kp] of result.keyPoints.entries()) {
		write('');
		write(_rule(`${i + 1}. ${kp.title}`));
		write(`  ${kp.summary}`);
		for (const q of kp.quotes) {
			write('');
			write(chalk.italic(`  "${q.text}"`));
			const attribution = [q.author, q.outlet].filter(Boolean).join(' · ');
			if (attribution) write(chalk.dim(`  — ${attribution}`));
			write(chalk.dim(`  ${q.url}`));
		}
	}
	write('');
}
