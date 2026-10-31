# ARCH-002 — Application Stack

## Status

Accepted for the MVP, subject to version pinning at repository initialization.

## Objective

Define a pragmatic, typed and testable stack for the YouPetMe web client and API. The stack must support the current web MVP, a REST API for future mobile clients and the modular-monolith architecture described in ARCH-001.

## Decisions at a glance

| Area | Selected technology | Purpose |
|---|---|---|
| Workspace | pnpm workspaces + Turborepo | Dependency management and task orchestration. |
| Web build | React + TypeScript + Vite | Single-page web application. |
| Routing | React Router | Public and protected client routes. |
| Server state | TanStack Query | API queries, mutations, cache and invalidation. |
| Forms | React Hook Form | Form state, submissions and accessible field errors. |
| Client validation | Zod | Schema-based validation close to form contracts. |
| Internationalisation | i18next + react-i18next | Spanish-first UI copy kept in translation files, keyed by screen and field. |
| Styling | Tailwind CSS | Utility-first implementation of the Design System's tokens (colour, spacing, typography, breakpoints). See ADR-009. |
| Accessible UI primitives | Radix UI | Unstyled, accessible interactive primitives (dialog, dropdown, tabs) with keyboard navigation and ARIA handled, styled with Tailwind. See ADR-009. |
| Animation | Framer Motion | Declarative animations and transitions (e.g. the AI Assistant mascot, skeleton-to-content transitions, staggered list animations) per Design System's perceived performance patterns. |
| API | NestJS + TypeScript | Modular REST API. |
| Server validation | NestJS validation layer + Zod schemas | Mandatory request validation at the HTTP boundary. |
| API documentation | OpenAPI / Swagger | Versioned, inspectable REST contract. |
| Persistence | PostgreSQL + Prisma ORM | Relational persistence, migrations and typed access. |
| Media storage | S3-compatible object storage (SeaweedFS in Docker for local development; see ADR-015) | Animal photo storage and delivery. |
| Unit/component tests | Vitest + React Testing Library | Fast application and UI testing. |
| Automated accessibility checks | axe-core | Accessibility assertions inside component tests. |
| API integration tests | Jest + Supertest | NestJS and PostgreSQL integration coverage. |
| End-to-end tests | Playwright | Critical user journeys across supported browsers. |
| Transactional email | Resend (behind an `EmailSender` port) | Password-reset and other transactional emails; console/in-memory adapters in dev/test. See ADR-014. |
| Formatting and linting | Prettier + ESLint + EditorConfig | Consistent, automated quality baseline. |

## Web application

### React, TypeScript and Vite

`apps/web` will be a client-rendered React application built with Vite and TypeScript. Server-side rendering is not a requirement for the MVP; it can be reconsidered if public SEO needs become material.

Vite provides a fast development server, HMR and optimized production builds for a modern React application.

### Routing

React Router will define all browser routes. It will distinguish among:

- Public routes, such as `/register`, `/login`, `/terms` and `/privacy`.
- Protected application routes, requiring an authenticated session.
- Error and not-found routes.

Authorization decisions remain enforced by the API. Route protection improves user experience but is never the security boundary.

### Data and state

TanStack Query owns server state: requests, mutations, cache, invalidation, retries and loading/error states.

Local UI state remains in React component state unless it is truly cross-cutting. A global client-state library will not be introduced initially. This avoids duplicating remote API state in a second store.

The authentication session (the access token, held in memory only, per ADR-002) is exposed through a React context provider, not a store.

### Forms and validation

React Hook Form manages form state and submission. Zod schemas validate browser input. The API repeats all validation independently, so a modified client cannot bypass business or security rules.

`confirmPassword` is a form-only field: it is validated in the registration interaction and never persisted.

### Internationalisation

The web client is Spanish-first (Non Functional Requirements) and uses i18next with react-i18next from the start, so that additional languages can be added later without touching components. Copy lives in translation files keyed by screen and field. Validation schemas carry translation keys, never literal text, and visual components never hard-code user-facing strings.

### Web directory structure

```text
apps/web/src/
├── app/                 # Application bootstrap, providers and route configuration
├── features/            # Feature-oriented UI, e.g. iam/register
├── components/          # Reusable, domain-neutral UI components
├── lib/                 # HTTP client and small technical helpers
├── styles/              # Global styles and design tokens
└── test/                # Test setup and reusable test utilities
```

Feature code must not directly call arbitrary endpoints from visual components. It will use an API client and feature-level query or mutation hooks.

## API application

### NestJS

`apps/api` implements the REST API as a modular monolith. NestJS modules compose the application, but the business dependency direction remains the one defined in ARCH-001.

Controllers are adapters: they parse HTTP input, invoke an application use case and serialize a safe response. They do not contain business logic or direct Prisma access.

### Validation and HTTP errors

Request validation is mandatory at the HTTP boundary. Zod schemas are the canonical representation for transport validation; they may be shared through `packages/contracts` when this helps avoid duplicated request rules.

The API maps validation errors to a documented, stable error shape. Domain exceptions are translated by a dedicated exception filter or adapter; they are not exposed as framework or database errors.

### OpenAPI

The API generates an OpenAPI document and provides Swagger UI only in approved non-production environments. The contract is reviewed with each endpoint and is the reference for external clients.

### Prisma and PostgreSQL

Prisma is used inside infrastructure repositories, not in controllers or use cases. PostgreSQL constraints remain authoritative for data integrity.

Every persistent schema change follows this sequence:

```text
Prisma schema change → reviewed migration → integration test → deployment
```

Database migrations are committed to source control. Manual schema changes are prohibited except for emergency procedures documented separately.

### Media storage

Animal photos (and any future media, such as shelter or store images) are stored as binary objects in **S3-compatible object storage**, not in PostgreSQL. Only object references are persisted in the relational database.

- **Local development:** SeaweedFS running in Docker, alongside PostgreSQL, orchestrated through `infra/docker` (ADR-015). It replaces MinIO, whose community edition is no longer maintained; SeaweedFS must first pass the presigned-upload verification described in ADR-015.
- **Deployed environments:** a managed S3-compatible provider (for example AWS S3 or Cloudflare R2). The exact provider is an infrastructure/deployment decision and may be finalized in a dedicated ADR when deployment is addressed.
- **Domain boundary:** the `Animal` entity stores photo references (object keys or URLs) only. It has no knowledge of the storage provider, upload mechanism or bucket configuration — those belong to infrastructure, consistent with the hexagonal boundary already defined for persistence.
- **Upload flow:** the API issues short-lived, signed upload URLs. The web client uploads the binary directly to object storage; the raw file is not proxied through NestJS. The API only receives and validates the resulting object reference before associating it with the `Animal` record.
- **Delivery:** images are served either directly from the object storage provider or through a CDN in front of it. This is not required for the MVP and can be introduced later without changing the domain model.
- **Validation:** allowed file types, maximum size and image count per animal are enforced by application-layer validation before a signed upload URL is issued.

This keeps photo storage swappable behind a port, mirroring the `UserRepository` / `PrismaUserRepository` pattern already used for persistence in ARCH-001.

## Testing strategy

| Test level | Tooling | Scope |
|---|---|---|
| Unit | Vitest (web), Jest (API) | Pure domain rules, use cases, utilities and isolated components. Use-case tests against a port (e.g. `UserRepository`) use an in-memory adapter, not a database. |
| Component | React Testing Library + axe-core | Form behaviour, visible errors and accessible interactions, including automated accessibility checks. |
| Integration | Jest + Supertest + isolated PostgreSQL | API endpoints, Prisma repositories, transactions and constraints. |
| E2E | Playwright | Browser journeys such as registration, login and logout. |

Integration and E2E tests must use dedicated test configuration and must never target a development or production database.

### Test database provisioning

- **Unit tests** never touch a real database. Use cases and other application/domain logic are tested against an **in-memory adapter** implementing the same port as the real repository (e.g. an in-memory `UserRepository`), kept only in the test code.
- **Integration tests** provision PostgreSQL via **Testcontainers**: a real Postgres container is started for the test run (or per test file, for isolation), migrations are applied, and the actual infrastructure adapter (e.g. `PrismaUserRepository`) runs against it — not a mock or an in-memory substitute. This is the concrete mechanism behind the "isolated PostgreSQL" integration testing already listed above.
- **E2E tests** run against the existing `infra/docker` stack (PostgreSQL and the local S3-compatible storage, see Media storage above), started once per CI run via `docker-compose`, with the API and web app running against it, rather than a fresh Testcontainers instance per test. Per-test container isolation is not needed at this level; a single stable environment for the full E2E suite is simpler and sufficient.
- Testcontainers requires Docker to be available wherever the tests run, including CI; this is expected to work out of the box on GitHub Actions runners but should be verified when the CI pipeline (ARCH-003) is set up.

### Test file location and naming

- **Unit tests** are co-located with the code they test, using the `.spec.ts` suffix — e.g. `user.entity.ts` + `user.entity.spec.ts` in the same folder.
- **Integration tests** are also co-located with the infrastructure adapter they test (they test one module's adapter, e.g. a Prisma repository, not a cross-module flow), using the `.integration-spec.ts` suffix — e.g. `user.repository.ts` + `user.repository.integration-spec.ts` in the same folder.
- **E2E tests** live in a dedicated `test/` folder per app rather than co-located, since they exercise a full journey across modules rather than belonging to one: `apps/api/test/` (following NestJS's own convention for this folder) and `apps/web/e2e/` for Playwright, using the `.e2e-spec.ts` suffix.

The suffix alone identifies what a test needs to run (nothing special, a Testcontainers-provisioned database, or the full `infra/docker` stack) without needing to open the file.

### Build exclusions

Production builds (`apps/api`, `apps/web`) exclude: all test files (`**/*.spec.ts`, `**/*.integration-spec.ts`, `**/*.e2e-spec.ts`), the `test/`/`e2e/` folders, `docs/`, and any `.env*` file other than `.env.example`.

## Security baseline

- Secrets exist only in environment configuration, never in source control or browser bundles.
- Password hashing, session storage and token delivery follow ADR-002.
- Authentication and authorization are enforced by API guards and use cases, never solely by frontend routes.
- Browser-visible errors must not leak internal stack traces, Prisma errors, hashes or tokens.
- CORS is restricted through `WEB_ORIGIN`.
- Signed media upload URLs are short-lived and scoped to a single object; the object storage bucket is never publicly writable.

## Versioning and upgrades

- Exact dependency versions are pinned in the lockfile.
- A new dependency is pinned to an exact version published at least 7 days earlier, which can be older than the latest release.
- Node.js uses a documented LTS version: **Node.js 24 (LTS, supported until 2028-04-30)**, pinned in `.nvmrc` and `package.json` `engines`. Confirmed by the project owner at repository initialization (2026-10-20), when Node.js 24 entered Maintenance LTS and Node.js 26 was about to become Active LTS (2026-10-28); a move to Node.js 26 is a major upgrade performed in an isolated branch.
- pnpm is pinned to **11.21.0** through the `packageManager` field (Corepack). TypeScript is pinned to **6.0.3**, the highest version compatible with the whole toolchain at initialization (NestJS 12 schematics require ≥6; typescript-eslint and ts-jest do not yet support 7).
- Major upgrades are performed in isolated branches with a complete test run.
- Preview, beta or early-access features are excluded from the MVP unless explicitly approved in an ADR.

## Explicit non-decisions

The MVP will not initially introduce:

- Microservices or a message broker.
- Redux or another global client-state store. A lightweight alternative (e.g. Zustand) may be adopted later, surgically, only for a concrete cross-cutting client-state need shared between non-related components (for example, a future floating AI assistant widget triggered from multiple places in the UI). It would complement, not replace, TanStack Query for server state, and would not be applied globally across the app.
- Server-side rendering.
- A component library with a paid dependency.
- A separate backend-for-frontend service.
- A finalized production object storage provider (deferred to a deployment-focused ADR).
- LangChain (or a similar LLM-orchestration framework). AI features (AI Matching's structured extraction, AI Assistant/Diango) call the Anthropic SDK directly, wrapped behind an application-level port (e.g. `AIProvider`), the same hexagonal pattern already used for persistence (`UserRepository`/`PrismaUserRepository`) and media storage. LangChain's main value — RAG/vector-store integrations and multi-provider abstraction — is not needed: this project does not use RAG (see ADR-010) and has no documented need to support multiple AI providers. Revisit only if one of those needs materializes for real.
- Gradio (or a similar Python-based ML demo UI framework) for Diango's chat interface. It is a separate Python runtime and application shell, incompatible with the project's React + TypeScript web client (ADR-007) and monorepo (no Python elsewhere in the stack), and does not give the level of control needed for Diango's custom mascot identity (tail-wagging animation, speech bubbles, welcome trigger — Design System, ADR-011). Diango's interface is a React component calling the API's `AIProvider` port, like the rest of the AI-assisted UI.
- A multi-agent architecture (e.g. LangGraph, CrewAI, AutoGen-style orchestration of several specialized, collaborating agents) for AI Matching or the AI Assistant. Both are adequately served by a single agent with tool use (Diango, ADR-011) or a simple sequential step chain (AI Matching, ADR-010); neither has genuinely independent sub-tasks or distinct domains of reasoning that would justify coordinating multiple agents, and doing so would add latency, cost and failure surface without a corresponding benefit. Revisit only if a single agent with an extended toolset genuinely proves insufficient in practice, and prefer extending that agent's tools before introducing multi-agent orchestration.
- Terraform (or another Infrastructure-as-Code tool). The deployment candidates noted above (Vercel, Railway/Render) are PaaS platforms configured through their own dashboard/CLI, not raw cloud resources (VMs, networking, IAM) that IaC exists to manage repeatably; adopting Terraform for them would add a tool without a corresponding need. The one plausible use — declaring the Cloudflare R2 bucket and its access policy as code — is not justified for a single-developer TFM where a one-time manual setup carries little of the risk IaC mitigates for teams. Revisit only if deployment moves to a full cloud provider (AWS/GCP/Azure) or infrastructure needs to be reproduced across multiple environments repeatably.

These may be reconsidered only when a concrete product or operational need arises.

### Deployment candidates (informal, not yet decided)

No deployment/hosting decision has been made; this is a working note of candidates to evaluate when that dedicated ADR is written, not a commitment. Current leaning, given the project is a single-developer TFM and favours low setup friction over infrastructure flexibility: **Vercel** for `apps/web` (React/Vite SPA), **Railway** or **Render** for `apps/api` and managed PostgreSQL (both integrate well with the existing Docker-based local setup), and **Cloudflare R2** for the S3-compatible object storage already decided above. A full cloud provider (AWS/GCP/Azure) remains an option but was not favoured for this project's scope, given the added setup and operational complexity relative to the alternatives above. This note may be revised freely; it does not require an ADR to change until deployment is actually addressed. Before adopting any of Vercel, Railway/Render or Cloudflare, the author intends to learn how each one works rather than adopting them blindly.

## References

- ARCH-001 — Architecture Foundation
- TS-IAM-001 — User Registration
- ADR-002 — Authentication Strategy
- ADR-009 — Styling and Accessible Component Foundation
- ADR-014 — Transactional Email Delivery
- ADR-015 — Local Object Storage for Development
- Vite documentation: https://vite.dev/guide/
- React Router documentation: https://reactrouter.com/
- TanStack Query documentation: https://tanstack.com/query/latest/docs/framework/react/overview
- NestJS OpenAPI documentation: https://docs.nestjs.com/openapi/introduction
- Prisma ORM documentation: https://www.prisma.io/docs/orm
- Playwright documentation: https://playwright.dev/docs/intro
