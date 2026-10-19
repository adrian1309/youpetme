# ADR-005 — Testing Strategy Tooling

## Status

Accepted

## Date

2026-08-28

## Context

YouPetMe's monorepo has two independently executable applications with different runtimes and build tools: `apps/web` (React + TypeScript + Vite) and `apps/api` (NestJS + TypeScript). A decision is needed on which test runner(s) to use for unit and component-level tests in each application, given they do not need to share the same tooling.

## Considered Options

### Option 1 — Jest for both `apps/web` and `apps/api`

Jest is used uniformly across the monorepo, for both the React web application and the NestJS API, since it is a mature, widely adopted test runner with broad ecosystem support.

### Option 2 — Vitest for `apps/web`, Jest for `apps/api`

Each application uses the test runner best aligned with its own build tool and ecosystem conventions: Vitest for the Vite-based web application, Jest for the NestJS API, which uses Jest as its documented default.

### Option 3 — Vitest for both `apps/web` and `apps/api`

Vitest is used uniformly across the monorepo, including for the NestJS API, moving away from Jest entirely.

## Decision

We will use:

**Option 2 — Vitest for `apps/web`, Jest for `apps/api`.**

Vitest is paired with React Testing Library for component-level tests on the web side. Jest is paired with Supertest for API integration tests against an isolated PostgreSQL instance.

## Consequences

### Advantages

- Vitest shares Vite's configuration, transform pipeline and module resolution, so web tests run fast and stay consistent with how the application is actually built and bundled, without a separate transform step to maintain.
- Jest is NestJS's documented and most-supported test runner, so API testing follows the framework's own conventions and has the most mature tooling and community support for that context (decorators, dependency injection, module testing utilities).
- Each application uses the tool best suited to its own runtime, rather than forcing a single tool to fit both reasonably well but neither optimally.

### Disadvantages

- The monorepo uses two different test runners instead of one, which means two sets of configuration and, in principle, two things to learn — though in practice their APIs are very similar (both are Jest-compatible in syntax).
- Shared test utilities or helpers that need to run in both applications cannot always be reused as-is between the two runners.

## Rejected Alternatives

### Option 1 — Jest for both applications

Rejected because Jest does not integrate as natively with Vite's transform pipeline as Vitest does; using Jest for the web application would mean maintaining a separate, potentially diverging build/transform configuration just for tests, instead of reusing Vite's own configuration.

### Option 3 — Vitest for both applications

Rejected because NestJS's own documentation, examples, decorators and testing utilities are built with Jest as the primary target. Moving the API to Vitest would mean working against the framework's conventions and losing first-party tooling support, for a benefit (tooling uniformity) that does not outweigh that cost at this stage.

## Related documents

- ARCH-002 — Application Stack
