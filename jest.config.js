/** @type {import('ts-jest').JestConfigWithTsJest} */

// we can define here only configuration that belongs to both test types,
// to unit tests (src/**/*.spec.ts) and integration tests (test/**/*.spec.ts)

module.exports = {    
    preset: 'ts-jest',
    setupFilesAfterEnv: [
      '<rootDir>/test/setup/equalityTesters.ts',
    ],
  };