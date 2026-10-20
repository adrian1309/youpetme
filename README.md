# YouPetMe

YouPetMe is a web-based animal adoption platform that connects potential adopters with animals and shelters. It is being developed as a Master's Final Project (TFM), with emphasis on a disciplined, AI-assisted software engineering process.

## Project status

The project is currently in the **architecture foundation phase**. Product scope, architecture decisions and the first technical specification have been defined. The monorepo skeleton (workspaces, tooling and CI) is in place; feature implementation has not started yet.

## Product vision

YouPetMe aims to make animal adoption more accessible, trustworthy and personalised.

The MVP focuses on:

- User registration, authentication and profile management.
- Animal catalogue, search, filters and animal details.
- Adoption requests and request status.
- Basic management of animals belonging to YouPetMe.
- An initial AI-assisted experience for guidance and animal matching.

Ideas such as external shelter synchronisation, veterinary and store integrations, social features, mobile applications and advanced AI capabilities are documented as future scope. They are not part of the MVP unless the project scope is formally revised.

## Architecture at a glance

YouPetMe is designed as a TypeScript monorepo managed with pnpm workspaces and Turborepo.

| Area | Decision |
| --- | --- |
| Web client | React, TypeScript and Vite |
| API | NestJS modular monolith exposing REST under `/api/v1` |
| Persistence | PostgreSQL with Prisma |
| Architecture | Clean Architecture and Hexagonal Architecture principles |
| API documentation | OpenAPI and Swagger |
| Authentication | Short-lived JWT access tokens and rotating refresh tokens |

The API is organised by business module. The initial module is Identity and Access Management (IAM).

## Intended repository structure

```text
youpetme/
├── apps/
│   ├── web/                 # React web application
│   └── api/                 # NestJS REST API
├── packages/
│   ├── contracts/           # Public API transport contracts
│   └── config/              # Shared tooling configuration
├── docs/                    # Official project and technical documentation
├── infra/
│   └── docker/              # Local infrastructure configuration
├── .github/
│   └── workflows/           # Continuous Integration workflows
├── .env.example             # Environment variable template
├── pnpm-workspace.yaml
├── turbo.json
└── AGENTS.md                # Instructions for AI coding agents
```

## Documentation

Official, versioned project documentation lives under `docs/`.

| Directory | Content |
| --- | --- |
| `docs/product/` | Product definition, functional map and MVP scope. |
| `docs/requirements/` | Requirements management and traceability. |
| `docs/user-stories/` | User stories and acceptance criteria. |
| `docs/specifications/` | Technical specifications ready for development. |
| `docs/ux-ui/` | Design system, flows and wireframes. |
| `docs/architecture/` | Architecture views, conventions and diagrams. |
| `docs/adr/` | Architecture Decision Records. |

The authoritative documents for the current foundation are:

- ARCH-001 — Architecture Foundation.
- ARCH-002 — Application Stack.
- ARCH-003 — Development and Delivery Workflow.
- ADR-002 — Authentication Strategy.
- ADR-003 — External Shelter Adoption Model.
- ADR-004 — Client State Management.
- ADR-005 — Testing Strategy Tooling.
- ADR-006 — Modular Monolith Architecture.
- ADR-007 — Frontend Framework Selection.
- ADR-008 — Primary Database Selection.
- ADR-009 — Styling and Accessible Component Foundation.
- ADR-010 — AI Matching Approach.
- ADR-011 — AI Assistant (Diango) Behaviour.
- ADR-012 — Security Approach.
- ADR-013 — Development Methodology: SDD, BDD and TDD.
- ADR-014 — Transactional Email Delivery.
- TS-IAM-001 — User Registration.

## Getting Started

### Prerequisites

- **Node.js 24 (LTS)** — the version is pinned in `.nvmrc` and `package.json` `engines` (ARCH-002).
- **pnpm 11.21.0** — pinned in the `packageManager` field; with Corepack enabled (`corepack enable`), the right version is used automatically.
- **Docker** and Docker Compose, for `infra/docker` (local PostgreSQL, ARCH-002).

### Setup order

1. Clone the repository.
2. `pnpm install` — installs dependencies from `pnpm-lock.yaml`.
3. Copy `.env.example` to `.env` and fill in real local values. The variables are described in the file itself (ARCH-001). **Secret values (e.g. the JWT secrets) are never generated or invented on the project owner's behalf — ask them to provide or confirm these.**
4. Start the local infrastructure:

   ```bash
   docker compose --env-file .env -f infra/docker/compose.yaml up -d
   ```

5. `pnpm dev` — starts the web client (Vite, http://localhost:5173) and the API (http://localhost:3000/api/v1 by default, `API_PORT`). See AGENTS.md — Common commands for the remaining scripts.

Not yet part of the setup, added with the stories that need them: Prisma migrations and seed data (first persistence story), S3-compatible object storage in `infra/docker` (SeaweedFS per ADR-015, pending presigned-upload verification; MinIO's community edition is no longer maintained) and Playwright E2E tests.

### Before running anything setup-related

Follow AGENTS.md — When uncertain: do not guess or invent a missing prerequisite, secret, version number, or setup step. If something in this section is unclear, outdated, or not yet confirmed against the real repository, ask the project owner before running a command — especially anything that installs software, generates or overwrites `.env`/secrets, resets a database or volume, or is otherwise hard to undo.

## Development workflow

Every change follows this path:

```text
User Story
→ Definition of Ready
→ Technical Specification and ADRs
→ Short-lived branch
→ Implementation and verification
→ Pull Request and CI
→ Merge to main
```

`main` is the only permanent branch and must remain deployable. Work is carried out in short-lived branches:

```text
codex/<type>/<scope>-<short-description>
```

New behaviour is implemented **test-first (TDD is mandatory)**: a failing test is written before its implementation, following Red → Green → Refactor. See **AGENTS.md — Test-Driven Development is mandatory** and **ADR-013 — Development Methodology: SDD, BDD and TDD**.

Commits follow Conventional Commits:

```text
feat(iam): add user registration use case
docs(architecture): define application stack
```

## Security principles

- Secrets and real environment files must never be committed.
- Passwords must never be stored or logged in plaintext.
- Authentication and session handling follow ADR-002.
- The API, not frontend route protection, enforces authorization.
- Database migrations are versioned and reviewed with their related schema changes.

## License

This project is developed for academic purposes as part of a Master's Final Project.