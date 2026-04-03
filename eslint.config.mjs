/**
 * ESLint flat config — adapted from obena/apps/frontend/eslint.config.ts.
 * Svelte, Tailwind, and browser-extension-specific rules stripped for Node.js/TypeScript.
 *
 * Rules mirrored:
 *  - Prettier integration (eslint-plugin-prettier + eslint-config-prettier)
 *  - no-console (enforces structured logging via pino; allow-listed per file below)
 *  - @typescript-eslint/no-unused-vars (replaces base no-unused-vars)
 *  - import/order (group + alphabetize; mirrors frontend import discipline)
 */

// @ts-check
import { fileURLToPath } from 'node:url';

import { includeIgnoreFile } from '@eslint/compat';
import eslint from '@eslint/js';
import plugin from '@typescript-eslint/eslint-plugin';
import * as typescriptParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default [
	includeIgnoreFile(gitignorePath),
	eslint.configs.recommended,
	prettier, // disable ESLint rules that conflict with Prettier
	{
		plugins: {
			prettier: prettierPlugin,
			import: importPlugin,
			'@typescript-eslint': plugin,
		},
		rules: {
			'prettier/prettier': 'warn',
			// Enforce structured logging via pino — allow-listed per file below
			'no-console': 'error',
			// Defer to @typescript-eslint/no-unused-vars to avoid noise on types/interfaces
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					vars: 'all',
					args: 'all',
					ignoreRestSiblings: true,
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
				},
			],
			'import/order': [
				'warn',
				{
					groups: [
						'builtin', // node:* built-ins
						'external', // npm packages
						['parent', 'sibling', 'index'], // relative imports
					],
					'newlines-between': 'always',
					alphabetize: { order: 'asc', caseInsensitive: true },
				},
			],
		},
	},
	{
		// TypeScript parser for all .ts files (no project reference — keeps lint-staged fast)
		files: ['**/*.ts', '**/*.mts', '**/*.cts'],
		languageOptions: {
			parser: typescriptParser,
			parserOptions: { sourceType: 'module', ecmaVersion: 'latest' },
		},
	},
	{
		// Allow console.* where structured logging isn't available or appropriate
		files: [
			'src/display.ts', // console.log used as default write callback
			'src/logger.ts', // pino transport setup
			'src/cli.ts', // process.stderr.write (allowed as a safety net)
		],
		rules: { 'no-console': 'off' },
	},
	{
		languageOptions: {
			globals: { ...globals.node },
		},
	},
];
