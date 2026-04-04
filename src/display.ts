/**
 * Terminal display for KPA results.
 * Mirrors rnd-kpa/src/rnd_kpa/display.py using chalk.
 */

import chalk from 'chalk';

import type { KPAResult, SourceUsage } from './models.js';
import type { ArgGraphSummary, ArgUnitSummary } from './taxonomy-models.js';

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

function _host(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '') || url;
	} catch {
		return url;
	}
}

function _formatSourceUsageLine(s: SourceUsage): string {
	const title = s.title ?? chalk.dim('(no title)');
	const pub = s.outlet ?? _host(s.url);
	const stats =
		s.quoteCount === 0 && s.keyPointCount === 0
			? chalk.dim('not cited in output')
			: chalk.dim(
					`${s.quoteCount} quote${s.quoteCount !== 1 ? 's' : ''} · ${s.keyPointCount} key point${s.keyPointCount !== 1 ? 's' : ''}`,
				);
	return `  ${title}\n  ${chalk.dim(pub)} · ${stats}\n  ${chalk.dim(s.url)}`;
}

function _rule(label: string, width = 100): string {
	const padded = ` ${label} `;
	const sides = Math.max(0, width - padded.length);
	const left = Math.floor(sides / 2);
	const right = sides - left;
	return chalk.blueBright('─'.repeat(left) + padded + '─'.repeat(right));
}

export function printResult(result: KPAResult, write: (s: string) => void = console.log): void {
	const ts = new Date(result.searchFetchedAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
	const age = _age(new Date(result.searchFetchedAt));
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
	} else {
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
	}

	write('');
	write(_rule('Sources fetched'));
	if (result.sourceUsage.length === 0) {
		write(chalk.dim('  (none)'));
	} else {
		for (const s of result.sourceUsage) {
			write('');
			write(_formatSourceUsageLine(s));
		}
	}
	write('');
}

// ── Taxonomy / argument graph display ─────────────────────────────────────────

const ARG_TYPE_LABELS: Record<string, string> = {
	PROBLEM_FRAMING: 'Problem framing',
	DIAGNOSTIC_CAUSAL: 'Diagnostic / causal',
	NORMATIVE_EVALUATIVE: 'Normative / evaluative',
	PROPOSAL_PRESCRIPTION: 'Proposal',
	IMPLEMENTATION_DESIGN: 'Implementation / design',
	CONSEQUENCE_FORECAST: 'Consequence / forecast',
	FACTUAL_PREMISE_DISPUTE: 'Factual dispute',
	LEGAL_PROCEDURAL: 'Legal / procedural',
	ACTOR_APPRAISAL: 'Actor appraisal',
	TRADEOFF_BALANCING: 'Tradeoff / balancing',
	COALITION_STRATEGY: 'Coalition / strategy',
	META_DISCURSIVE: 'Meta-discursive',
};

const ARG_TYPE_COLORS: Record<string, (s: string) => string> = {
	PROBLEM_FRAMING: chalk.hex('#8b5cf6'),
	DIAGNOSTIC_CAUSAL: chalk.hex('#f59e0b'),
	NORMATIVE_EVALUATIVE: chalk.hex('#f43f5e'),
	PROPOSAL_PRESCRIPTION: chalk.hex('#0ea5e9'),
	IMPLEMENTATION_DESIGN: chalk.hex('#14b8a6'),
	CONSEQUENCE_FORECAST: chalk.hex('#f97316'),
	FACTUAL_PREMISE_DISPUTE: chalk.hex('#6b7280'),
	LEGAL_PROCEDURAL: chalk.hex('#6366f1'),
	ACTOR_APPRAISAL: chalk.hex('#a855f7'),
	TRADEOFF_BALANCING: chalk.hex('#84cc16'),
	COALITION_STRATEGY: chalk.hex('#06b6d4'),
	META_DISCURSIVE: chalk.hex('#71717a'),
};

function _typeColor(argType: string): (s: string) => string {
	return ARG_TYPE_COLORS[argType] ?? chalk.white;
}

function _typeBadge(argType: string): string {
	const label = ARG_TYPE_LABELS[argType] ?? argType;
	return _typeColor(argType)(`[${label.toUpperCase()}]`);
}

function _positionBadge(position: string | null): string {
	if (!position) return '';
	const p = position.toLowerCase();
	if (p === 'for' || p === 'positive' || p === 'just' || p === 'prudent' || p === 'legitimate')
		return chalk.green(` ✓ ${position}`);
	if (
		p === 'against' ||
		p === 'negative' ||
		p === 'unjust' ||
		p === 'imprudent' ||
		p === 'illegitimate'
	)
		return chalk.red(` ✗ ${position}`);
	return chalk.yellow(` ~ ${position}`);
}

function _miniBar(count: number, max: number): string {
	const filled = max > 0 ? Math.round((count / max) * 6) : 0;
	return chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(6 - filled));
}

export function printArgGraph(
	graph: ArgGraphSummary,
	write: (s: string) => void = console.log,
): void {
	write('');
	write(
		chalk.bold('Argument Graph: ') +
			chalk.bold.cyan(`"${graph.query}"`) +
			chalk.dim('  ·  run: ') +
			chalk.dim(graph.runId),
	);
	write(
		chalk.dim(
			`  ${graph.issues.length} issue${graph.issues.length !== 1 ? 's' : ''}  ·  ` +
				`${graph.proposals.length} proposal${graph.proposals.length !== 1 ? 's' : ''}  ·  ` +
				`${graph.argumentUnits.length} argument unit${graph.argumentUnits.length !== 1 ? 's' : ''}`,
		),
	);

	// ── Issue tree ────────────────────────────────────────────────────────────

	const rootIssues = graph.issues.filter((i) => !i.parentId);
	const childrenByParent = new Map<string, typeof graph.issues>();
	for (const iss of graph.issues) {
		if (iss.parentId) {
			const siblings = childrenByParent.get(iss.parentId) ?? [];
			siblings.push(iss);
			childrenByParent.set(iss.parentId, siblings);
		}
	}

	for (const rootIssue of rootIssues) {
		write('');
		write(_rule(`◉ ${rootIssue.title}`));

		const children = childrenByParent.get(rootIssue.id) ?? [];
		for (const child of children) {
			write(chalk.dim('  ├─ ') + chalk.white(child.title));
		}

		// Proposals under this issue
		const issueProposals = graph.proposals.filter((p) => p.issueId === rootIssue.id && !p.parentId);
		if (issueProposals.length > 0) {
			write('');
			write(chalk.bold.white('  PROPOSALS'));
			for (const prop of issueProposals) {
				const units = graph.argumentUnits.filter((u) => u.proposalId === prop.id);
				const forCount = units.filter(
					(u) => u.position === 'FOR' || u.position === 'POSITIVE',
				).length;
				const againstCount = units.filter(
					(u) => u.position === 'AGAINST' || u.position === 'NEGATIVE',
				).length;
				const condCount = units.filter(
					(u) => u.position?.includes('CONDITION') || u.position === 'MIXED',
				).length;
				const stanceStr =
					[
						forCount > 0 ? chalk.green(`${forCount} for`) : null,
						againstCount > 0 ? chalk.red(`${againstCount} against`) : null,
						condCount > 0 ? chalk.yellow(`${condCount} with-conditions`) : null,
					]
						.filter(Boolean)
						.join('  ') || chalk.dim('no stances');
				const bundleTag = prop.isBundle ? chalk.dim(' [bundle]') : '';
				write(`  ► ${chalk.cyan(prop.title)}${bundleTag}  ${stanceStr}`);
			}
		}

		// Argument type breakdown
		const issueUnits = graph.argumentUnits.filter(
			(u) => u.issueId === rootIssue.id || children.some((c) => c.id === u.issueId),
		);

		if (issueUnits.length > 0) {
			write('');
			write(chalk.bold.white('  ARGUMENT BREAKDOWN'));
			const counts = new Map<string, number>();
			for (const u of issueUnits) {
				counts.set(u.argType, (counts.get(u.argType) ?? 0) + 1);
			}
			const max = Math.max(...counts.values());
			const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
			for (const [type, count] of sorted) {
				const label = (ARG_TYPE_LABELS[type] ?? type).padEnd(30);
				write(`  ${_miniBar(count, max)}  ${_typeColor(type)(label)}  ${chalk.dim(String(count))}`);
			}

			// Top quotes by centrality
			write('');
			write(chalk.bold.white('  TOP QUOTES'));
			const topUnits = issueUnits.filter((u) => u.centrality === 'CENTRAL').slice(0, 3);
			const shown = topUnits.length > 0 ? topUnits : issueUnits.slice(0, 3);
			for (const unit of shown) {
				const attribution = [unit.author, unit.outlet].filter(Boolean).join(' · ');
				write('');
				write(`  ${_typeBadge(unit.argType)}${_positionBadge(unit.position)}`);
				write(chalk.italic(`  "${unit.claimSummary}"`));
				if (attribution) write(chalk.dim(`  — ${attribution}`));
			}
		}
	}

	// Unassigned units (no issue)
	const unassigned = graph.argumentUnits.filter((u) => !u.issueId);
	if (unassigned.length > 0) {
		write('');
		write(_rule(`Unassigned units (${unassigned.length})`));
		_printUnitList(unassigned.slice(0, 5), write);
	}

	write('');
}

function _printUnitList(units: ArgUnitSummary[], write: (s: string) => void): void {
	for (const unit of units) {
		const attribution = [unit.author, unit.outlet].filter(Boolean).join(' · ');
		write('');
		write(`  ${_typeBadge(unit.argType)}${_positionBadge(unit.position)}`);
		write(chalk.italic(`  "${unit.claimSummary}"`));
		if (attribution) write(chalk.dim(`  — ${attribution}`));
	}
}
