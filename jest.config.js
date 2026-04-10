/** @type {import('jest').Config} */
module.exports = {
	testEnvironment: 'node',
	testMatch: ['**/tests/**/*.spec.ts'],
	testPathIgnorePatterns: ['<rootDir>/dist/'],
	transform: {
		'^.+\\.tsx?$': ['ts-jest', {
			tsconfig: {
				strict: true,
				esModuleInterop: true,
				module: 'commonjs',
				target: 'es2019',
				skipLibCheck: true,
			},
		}],
	},
};
