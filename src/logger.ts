/**
 * Shared pino logger instance.
 * Use pino-pretty in dev (LOG_PRETTY=1) for human-readable output.
 */

import pino from 'pino';

export const log = pino(
	{ level: process.env['LOG_LEVEL'] ?? 'info' },
	process.env['LOG_PRETTY'] === '1'
		? pino.transport({ target: 'pino-pretty', options: { colorize: true } })
		: undefined,
);
