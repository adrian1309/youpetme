# AGENTS.md

## Purpose

YouPetMe is a Master's Final Project (TFM) for an animal adoption platform.

This file defines the operating rules for AI coding agents and contributors. Apply these rules together with the official documentation under `docs/`.

## Current status

The project is in the architecture foundation phase.

Do not implement a feature until its User Story, Technical Specification and applicable ADRs have been reviewed and are sufficiently defined.

## Source of truth

Official, versioned documentation lives under `docs/`. Consult the relevant documents before changing code:

| Folder                 | Contains                                  | Key documents                                                                                                                                   |
| ---------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/product/`        | Product scope, MVP decisions              | Project Overview, Product Definition, Functional Map, MVP                                                                                       |
| `docs/requirements/`   | Requirements management, traceability     | Requirements Overview, Non Functional Requirements                                                                                              |
| `docs/user-stories/`   | User goals, acceptance criteria (archive; Jira prevails, see below) | —                                                                                                                                               |
| `docs/specifications/` | Technical behaviour, test expectations    | e.g. TS-IAM-001                                                                                                                                 |
| `docs/adr/`            | Accepted architecture decisions           | ADR-002 onward — see this folder or README for the current full list; it grows over time                                                        |
| `docs/architecture/`   | Structure, conventions, delivery workflow | ARCH-001 (repository/module structure), ARCH-002 (full technology stack and explicit non-decisions), ARCH-003 (branching/CI/Definition of Done) |
| `docs/ux-ui/`          | User flows, wireframes, design decisions  | Design System, Authentication Flow, Wireframes Authentication                                                                                   |

ARCH-002 is authoritative for the exact current technology stack (libraries, tooling, and what was deliberately *not* adopted and why) — do not assume a library is in use, or introduce a new one, without checking it there first.

If documentation conflicts, use this precedence order:

```text
Accepted ADR
→ Architecture document
→ Technical specification
→ User story
→ Product or exploratory note
```

Report any material contradiction rather than silently choosing a different behaviour.

### Jira as source of truth for User Stories

Jira (project `SCRUM`) is the source of truth for the **content and status** of User Stories and Epics. It is reached through the Atlassian MCP server named `atlassian` (tools `mcp__atlassian__*`), authenticated with OAuth by the project owner.

- `docs/user-stories/` is kept as a versioned archive and is what the Technical Specifications refer to by name. If a story differs between Jira and `docs/user-stories/`, Jira prevails; report the difference rather than silently choosing one.
- Read User Stories through the `jira-reader` subagent (below), not by calling Jira tools directly from the main agent.
- Access is **read-only**. Never create, edit, comment on or transition Jira issues unless the project owner explicitly asks. Updating a story's status as work progresses is possible future functionality, not current behaviour.

### Planned: Figma as source of truth for design

Not yet implemented; noted here so it is not lost. The intent is for **Figma** to become the source of truth for UI/UX design and wireframes (replacing `docs/ux-ui/wireframes/` and, where design-driven, `docs/ux-ui/flows/`), read by Claude Code most likely through an MCP integration. Until this is set up and this note is replaced with concrete instructions, the Markdown documents under `docs/ux-ui/` remain authoritative for design.

### Subagents for User Story delivery

Subagents live in `.claude/agents/`, each scoped to one stage of delivering a User Story, so the main agent can delegate automatically based on the task and the subagent's description.

Currently defined:

- **jira-reader** (`.claude/agents/jira-reader.md`) — reads a User Story's content, subtasks and status from Jira. Read-only: its tool access is limited to Jira read operations.

Planned, not yet created — do not assume they exist:

- **implementer** — implements the User Story following Test-Driven Development (Red → Green → Refactor, below); scoped tool access for file editing and running tests.
- **reviewer** — reviews and refactors already-implemented code, keeping all tests passing.
- **tester** — writes and runs unit, integration and end-to-end tests per ARCH-002's testing strategy.

Each subagent's description must be specific enough for Claude Code's automatic delegation to route tasks correctly. Until the planned subagents are created and this section is updated, no delegation to them should be assumed.

## Architecture rules

- Use a TypeScript monorepo managed with pnpm workspaces and Turborepo.
- Build the API as a NestJS modular monolith organised by business module.
- Apply Clean Architecture and Hexagonal Architecture principles in backend modules.
- Maintain this dependency direction:

```text
presentation → application → domain
infrastructure → application/domain ports
```

- Domain code must not depend on NestJS, Prisma, HTTP or concrete infrastructure providers.
- Prisma belongs to infrastructure and must not leak into domain models or public contracts.
- `packages/contracts` contains public API transport contracts only. Never place domain entities, Prisma types, credentials or business logic there.
- REST endpoints use the `/api/v1` prefix.
- Enforce authentication and authorization on the API; frontend route protection is only a user-experience measure.

### Repository structure

`apps/web` and `apps/api` are independently executable:

```text
youpetme/
├── apps/
│   ├── web/                         # React + TypeScript client (ADR-007)
│   │   ├── src/
│   │   │   ├── app/                 # Bootstrap, providers, route configuration
│   │   │   ├── features/            # Feature-oriented UI, e.g. iam/register
│   │   │   ├── components/          # Reusable, domain-neutral UI components
│   │   │   ├── lib/                 # HTTP client and small technical helpers
│   │   │   ├── styles/              # Global styles and design tokens
│   │   │   └── test/                # Test setup and reusable test utilities
│   │   └── e2e/                     # Playwright E2E tests (ARCH-002)
│   └── api/                         # NestJS + Prisma API
│       ├── src/
│       │   ├── app/
│       │   ├── modules/
│       │   │   └── <module>/        # e.g. iam, animals, adoptions, shelters, ai
│       │   │       ├── domain/
│       │   │       │   ├── entities/
│       │   │       │   ├── value-objects/
│       │   │       │   ├── events/
│       │   │       │   └── ports/
│       │   │       ├── application/
│       │   │       │   ├── use-cases/
│       │   │       │   ├── commands/
│       │   │       │   └── dto/
│       │   │       ├── infrastructure/
│       │   │       │   ├── persistence/prisma/
│       │   │       │   ├── security/
│       │   │       │   └── events/
│       │   │       ├── presentation/http/
│       │   │       └── <module>.module
│       │   └── platform/            # Cross-cutting: configuration, database, logging, health
│       └── test/                    # API E2E tests (NestJS/ARCH-002 convention)
├── packages/
│   ├── contracts/                   # Public API transport contracts only
│   └── config/                      # Shared tooling configuration
├── docs/                            # Official versioned documentation (see Source of truth)
├── infra/
│   └── docker/                      # Local PostgreSQL; S3-compatible storage planned (ARCH-002, ADR-015)
├── .github/workflows/               # CI (ARCH-003)
├── .env.example
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

Every module under `apps/api/src/modules/` follows the same `domain/application/infrastructure/presentation` subdivision shown above for `iam` (ARCH-001) — do not invent a different internal shape for a new module.

**Test file location and naming** (see ARCH-002 for full detail): unit tests are co-located with the code they test (`.spec.ts`); integration tests are co-located with the infrastructure adapter they test (`.integration-spec.ts`); E2E tests live in `apps/api/test/` and `apps/web/e2e/` (`.e2e-spec.ts`). Production builds exclude all test files, `test/`/`e2e/` folders, `docs/`, and any `.env*` other than `.env.example`.

### Common commands

Root scripts defined in `package.json` and orchestrated by Turborepo (`turbo.json`). They map 1:1 to the CI steps in ARCH-003 (`.github/workflows/ci.yml`).

```text
pnpm install            # install dependencies (CI uses --frozen-lockfile)
pnpm dev                # run apps/web (Vite) and apps/api (nest start --watch) in development
pnpm lint               # ESLint across the monorepo
pnpm format             # Prettier, writes changes
pnpm format:check       # Prettier, verification only (CI)
pnpm typecheck          # TypeScript type checking
pnpm test               # unit + component tests (Vitest for web, Jest for API — ADR-005)
pnpm test:integration   # API integration tests, *.integration-spec.ts (Jest — ARCH-002); passes with no tests
pnpm build              # production build
```

Per-workspace scripts can be run with `pnpm --filter <name> <script>` (workspaces: `@youpetme/web`, `@youpetme/api`, `@youpetme/contracts`, `@youpetme/config`).

Not yet available: `pnpm test:e2e` (Playwright is added with the first E2E journey), Testcontainers for integration tests, and Prisma scripts (added with the first persistence story). Do not assume any other script exists without checking `package.json`/`turbo.json` first.

### Manual API testing

Use `curl` from the terminal (Claude Code can run this directly as part of its own workflow) for ad hoc, manual checks against a running API — e.g. verifying an endpoint just implemented. Do not introduce Postman or a similar GUI client: Swagger UI (ARCH-002) already provides an interactive way to explore and try endpoints, and a terminal-based `curl` check keeps manual verification inside Claude Code's own workflow rather than a separate external tool with its own account and saved collections to maintain.

## Security and data rules

- Never commit secrets, credentials or real `.env` files.
- Keep `.env.example` limited to fictitious values and variable descriptions.
- Never log or expose passwords, password hashes, access tokens, refresh tokens or session secrets.
- Store passwords only as secure hashes.
- Follow ADR-002 for authentication, tokens and sessions.
- Treat database constraints as authoritative integrity safeguards in addition to application validation.

## Development workflow

Before implementation:

1. Identify the related User Story (read from Jira through the `jira-reader` subagent) and Technical Specification.
2. Check applicable ADRs and architecture constraints.
3. Assess validation, authorization, privacy and migration impacts.
4. Identify unit, integration and end-to-end test scenarios, including failure paths.

During implementation:

- Keep changes focused on one coherent purpose.
- Do not introduce unrelated refactors or formatting changes.
- Use clear names and preserve module boundaries.
- Add or update tests appropriate to the changed behaviour.
- Update documentation, API contracts and migrations when needed.

### Test-Driven Development is mandatory

Per **ADR-013 — Development Methodology: SDD, BDD and TDD**, all new behaviour (unit and, where applicable, integration level) is implemented test-first. This is not optional or best-effort:

1. **Red** — write a failing test that expresses the expected behaviour (typically one Given/When/Then scenario from the Use Case's Acceptance Criteria) before writing any implementation code for it.
2. **Green** — write the minimal implementation code needed to make that test pass. Do not implement more than the current test requires.
3. **Refactor** — improve the implementation's structure (naming, duplication, clarity) while keeping all tests passing, including the one just added.

Do not write implementation code for a piece of new behaviour before its failing test exists. Exploratory spikes intended to be thrown away are the only exception, and must not be merged as-is — once an approach is validated, it is re-implemented following Red → Green → Refactor.

## Git and delivery rules

- `main` is the only permanent branch and must remain deployable.
- Do not commit directly to `main`.
- Use short-lived branches named `codex/<type>/<scope>-<short-description>`.
- Use Conventional Commits: `<type>(<scope>): <imperative summary>`.
- Do not use destructive Git operations or force pushes unless explicitly instructed.
- Do not commit generated secrets, local configuration or unrelated files.
- Pull Requests must include relevant documentation references and verification evidence.

### End-of-story summary

When a User Story is completed (its Definition of Done, ARCH-003/Requirements Overview, is met), provide a summary covering:

- Which User Story/Use Case was completed, and its Acceptance Criteria.
- Decisions made during implementation that were not already fixed by existing documentation — flag any that look significant enough to warrant their own ADR, rather than silently deciding and moving on.
- Anything that deviated from the original plan (Technical Design, Use Case), and why.
- Test coverage added, per the Red → Green → Refactor cycle (Test-Driven Development is mandatory, above).
- Any uncertainty or documentation contradiction encountered along the way (per When uncertain, below), even if it was ultimately resolved.

Keep it concise — this is a summary for the project owner to review quickly, not a duplicate of the PR description.

## Documentation conventions

- Technical documentation, code, identifiers, commit messages and API contracts use English.
- Communication with the project owner may use Spanish.
- Use Markdown for documentation.
- Use Mermaid where a diagram makes a relationship clearer than prose.
- Keep diagrams close to the document they support.
- Do not duplicate official repository documents in personal note systems; link to the repository version instead.

## When uncertain

Do not invent business behaviour, security rules or architectural decisions.

State the uncertainty, identify the affected documentation and request a decision before implementing a material change.

This applies with extra weight to project setup and any hard-to-undo action: never invent or assume a missing prerequisite, version number, secret value, or setup step (see README — Getting Started); never generate, overwrite or guess `.env`/secret values on the project owner's behalf; and never run a command that installs software, resets a database or Docker volume, or is otherwise destructive without asking first. When README's Getting Started section is marked as "not yet confirmed," treat it as a plan to verify with the project owner, not as instructions to execute unattended.