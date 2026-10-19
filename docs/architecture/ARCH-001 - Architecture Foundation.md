# ARCH-001 — Architecture Foundation

## Status

Accepted for MVP foundation.

## Context

YouPetMe requires a web client, a NestJS API, PostgreSQL persistence and a future mobile client. The architecture must keep the MVP simple while protecting module boundaries and allowing the system to grow without an early microservices split.

## Decisions

### Repository model

The project will use a TypeScript monorepo managed with pnpm workspaces and orchestrated with Turborepo.

```text
youpetme/
├── apps/
│   ├── web/                         # React + TypeScript client
│   └── api/                         # NestJS + Prisma API
├── packages/
│   ├── contracts/                   # Public transport contracts only
│   └── config/                      # Shared tooling configuration
├── docs/
│   ├── adr/
│   ├── architecture/
│   ├── specifications/
│   └── user-stories/
├── infra/
│   └── docker/
├── .github/workflows/
├── .env.example
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

The monorepo centralizes coordinated frontend/API changes and shared transport contracts. Applications remain independently executable and deployable.

### Documentation

All versioned product and technical documentation will live under `docs/`:

| Directory | Purpose |
|---|---|
| `docs/user-stories/` | Product user stories. |
| `docs/specifications/` | Technical specifications ready for development. |
| `docs/adr/` | Architecture Decision Records. |
| `docs/architecture/` | Architecture, conventions and system views. |

### API structure

The API is a modular monolith implemented with NestJS. Its functionality is organized by business module, not by global technical layer.

```text
apps/api/src/
├── app/
├── modules/
│   └── iam/
│       ├── domain/
│       │   ├── entities/
│       │   ├── value-objects/
│       │   ├── events/
│       │   └── ports/
│       ├── application/
│       │   ├── use-cases/
│       │   ├── commands/
│       │   └── dto/
│       ├── infrastructure/
│       │   ├── persistence/prisma/
│       │   ├── security/
│       │   └── events/
│       ├── presentation/http/
│       └── iam.module
└── platform/
    ├── configuration/
    ├── database/
    ├── logging/
    └── health/
```

Dependency direction:

```text
presentation → application → domain
infrastructure → application/domain ports
```

The domain must not depend on NestJS, Prisma, HTTP or a concrete security provider. Infrastructure implements ports defined by the domain or application layer.

### Module boundaries

Initial modules:

| Module | Responsibility |
|---|---|
| IAM | Users, credentials, profiles, sessions, authentication and authorization. |
| Animals | Animal records, characteristics, photos and availability. |
| Adoptions | Adoption requests, request status and the adoption workflow. |
| Shelters | Shelter profiles and management of animals owned by a shelter. |
| AI | AI-assisted matching (adopter preference collection and recommendations) and the AI assistant. |
| Notifications | Internal notifications and future external channels. |
| Platform | Technical cross-cutting concerns. |

This list replaces the earlier `Pets` and `Care` module names. `Pets` is renamed to `Animals` for consistency with the Product, Functional Map, Domain Model and MVP documents. `Care` is removed as an MVP module: the earlier intent behind it corresponds to the `Adoptions` module, which is now listed explicitly, since adoption requests are core MVP functionality. Temporary pet care (a distinct, out-of-scope concept) remains a documented future module, not part of the MVP.

Only modules required by the MVP will initially be implemented: `IAM`, `Animals`, `Adoptions`, `Shelters` and `AI`, plus the cross-cutting `Notifications` and `Platform` modules. `Stores`, `Veterinary`, `Social` and `Temporary Care` remain future modules per the Functional Map and MVP documents.

IAM owns `User`, `UserProfile` and `UserSession`. Other modules must not read IAM persistence models directly; they will use an explicitly exposed use case or contract.

### Contracts

`packages/contracts` is limited to API transport contracts: request and response types, error shapes and transport validation schemas when needed.

It must not contain domain entities, Prisma types, repositories, business logic, credentials or infrastructure configuration.

### Persistence and local infrastructure

PostgreSQL will run in Docker for local development and isolated integration tests. Prisma, including its schema, migrations and generated client, belongs to `apps/api`.

Migrations are the authoritative, versioned record of database changes. Prisma types are infrastructure details and must not leak into domain or public API contracts.

### Environment configuration

`.env.example` is versioned with fictitious values. Real `.env` files and secrets are excluded from Git.

Initial expected variables:

```text
DATABASE_URL
API_PORT
WEB_ORIGIN
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRATION
JWT_REFRESH_EXPIRATION
```

The API validates required configuration on startup. Authentication secrets are mandatory outside local development.

### API versioning

REST endpoints use the `/api/v1` prefix from the beginning. Example:

```text
POST /api/v1/auth/register
```

OpenAPI documentation is generated by the API and kept aligned with endpoint development.

### Quality and Git workflow

- TypeScript strict mode is required.
- ESLint, Prettier and EditorConfig establish consistent code quality and formatting.
- CI runs formatting verification, linting, type checks and relevant tests.
- `main` is protected and always deployable.
- No permanent `develop` branch is used.
- Work is performed on short-lived branches such as `codex/feature/iam-user-registration`.

## Consequences

- Frontend and API can evolve together while retaining explicit boundaries.
- The monolith can be split later only if operational or domain needs justify it.
- Shared packages stay small and intentional, avoiding a generic shared-code dependency sink.
- Infrastructure remains replaceable behind ports, at the cost of a small initial design overhead.
- Module naming is now consistent across Product, Functional Map, Domain Model, MVP and Architecture documents, reducing ambiguity when implementing the `Adoptions` and `AI` modules.

## Related documents

- TS-IAM-001 — User Registration
- ADR-002 — Authentication Strategy
