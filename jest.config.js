export default {
	verbose: true,
	testEnvironment: 'node',
	transform: {
		'^.+\\.ts$': ['ts-jest', { useESM: true }]
	},
	testMatch: [
		'**/src/**/*.test.ts'
	],
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
	coveragePathIgnorePatterns: [
	],
	collectCoverageFrom: [
		'**/src/**/*.ts',
		'!**/*.test.ts',
		'!**/node_modules/**',
		'!jest*.ts',
	]
}
