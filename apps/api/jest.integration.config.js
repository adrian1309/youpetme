/**
 * Integration tests: co-located `*.integration-spec.ts` files that run infrastructure
 * adapters against a Testcontainers-provisioned PostgreSQL (ARCH-002).
 */
module.exports = {
  testEnvironment: 'node',
  // Starting a PostgreSQL container and applying migrations takes a while on a cold machine.
  testTimeout: 120000,
  // One PostgreSQL container at a time: starting several in parallel made suites time out on
  // slower machines.
  maxWorkers: 1,
  rootDir: 'src',
  testRegex: '\\.integration-spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  // The generated Prisma client imports its own files with a .js extension.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  moduleFileExtensions: ['ts', 'js', 'json'],
};
