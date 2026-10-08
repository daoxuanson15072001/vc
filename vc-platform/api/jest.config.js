// Unit and API e2e tests: MongoDB replica set in memory (mongodb-memory-server), started once for all files.
// Where the MongoDB download host is blocked, set MONGOMS_SYSTEM_BINARY to a local mongod 7.
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: { parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true }, target: 'es2022' },
        module: { type: 'commonjs' },
      },
    ],
  },
  globalSetup: '<rootDir>/test/util/global-setup.ts',
  globalTeardown: '<rootDir>/test/util/global-teardown.ts',
  testTimeout: 30000,
};
