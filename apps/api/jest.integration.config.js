/**
 * Integration tests: co-located `*.integration-spec.ts` files that run infrastructure
 * adapters against a Testcontainers-provisioned PostgreSQL (ARCH-002).
 */
module.exports = {
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '\\.integration-spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
};
