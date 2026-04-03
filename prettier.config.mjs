/** @type {import("prettier").Config} */
export default {
	useTabs: false,
	tabWidth: 2,
	singleQuote: true,
	trailingComma: 'all',
	printWidth: 100,

	overrides: [
		{
			// Mirror obena/apps/frontend: tabs for all JS/TS source files
			files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
			options: { useTabs: true },
		},
	],
};
