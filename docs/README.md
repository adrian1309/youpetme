# YouPetMe Documentation

Index of the official, versioned project documentation. Each document has a single home; when two documents disagree, follow the precedence order in [AGENTS.md](../AGENTS.md):

```text
Accepted ADR → Architecture document → Technical specification → User story → Product or exploratory note
```

## Product

Scope and product decisions.

| Document | Description |
|---|---|
| [Project Overview](product/Project%20Overview.md) | What YouPetMe is and its development philosophy. |
| [Product Definition](product/Product%20Definition.md) | Users, value proposition and the MVP adoption model. |
| [Functional Map](product/Functional%20Map.md) | All functional areas, MVP and future. |
| [MVP](product/MVP.md) | What is included and excluded from the MVP. |

## Requirements

Requirements management and quality attributes.

| Document | Description |
|---|---|
| [Requirements Overview](requirements/Requirements%20Overview.md) | Hierarchy, access model, Definition of Ready and Done. |
| [Non Functional Requirements](requirements/Non%20Functional%20Requirements.md) | Security, privacy, accessibility, performance and more. |

## User stories

Acceptance criteria in Given/When/Then. Jira will become the source of truth once it is integrated (see AGENTS.md).

| Document | Description |
|---|---|
| [US-IAM-001](user-stories/US-IAM-001%20-%20Create%20Account.md) | Create Account |
| [US-IAM-002](user-stories/US-IAM-002%20-%20Login.md) | Login |
| [US-IAM-003](user-stories/US-IAM-003%20-%20Logout.md) | Logout |
| [US-IAM-004](user-stories/US-IAM-004%20-%20Password%20Recovery.md) | Password Recovery |
| [US-IAM-005](user-stories/US-IAM-005%20-%20View%20and%20Edit%20Profile.md) | View and Edit Profile |

## Technical specifications

Technical behaviour and test expectations per story.

| Document | Description |
|---|---|
| [TS-IAM-001](specifications/iam/TS-IAM-001%20-%20User%20Registration.md) | User Registration |
| [TS-IAM-002](specifications/iam/TS-IAM-002%20-%20Login.md) | Login |
| [TS-IAM-003](specifications/iam/TS-IAM-003%20-%20Logout.md) | Logout |
| [TS-IAM-004](specifications/iam/TS-IAM-004%20-%20Password%20Recovery.md) | Password Recovery |
| [TS-IAM-005](specifications/iam/TS-IAM-005%20-%20User%20Profile.md) | User Profile |

## Architecture

Structure, stack, delivery workflow and domain.

| Document | Description |
|---|---|
| [ARCH-001 — Architecture Foundation](architecture/ARCH-001%20-%20Architecture%20Foundation.md) | Repository, module structure and dependency direction. |
| [ARCH-002 — Application Stack](architecture/ARCH-002%20-%20Application%20Stack.md) | Authoritative technology stack and explicit non-decisions. |
| [ARCH-003 — Development and Delivery Workflow](architecture/ARCH-003%20-%20Development%20and%20Delivery%20Workflow.md) | Branching, CI, Conventional Commits, changelog, Definition of Done. |
| [Domain Model](architecture/domain/Domain%20Model.md) | Entities, roles, statuses and taxonomy. |

## Architecture Decision Records

Accepted decisions with alternatives and consequences.

| Document | Description |
|---|---|
| [ADR-002 — Authentication Strategy](adr/ADR-002%20-%20Authentication%20Strategy.md) | JWT access token, rotating refresh token, Argon2id and password policy. |
| [ADR-003 — External Shelter Adoption Model](adr/ADR-003%20-%20External%20Shelter%20Adoption%20Model.md) | How adoption works for external shelters (future) and the MVP model. |
| [ADR-004 — Client State Management](adr/ADR-004%20-%20Client%20State%20Management.md) | Server state with TanStack Query; no global client store. |
| [ADR-005 — Testing Strategy Tooling](adr/ADR-005%20-%20Testing%20Strategy%20Tooling.md) | Vitest, Jest, Supertest, Playwright. |
| [ADR-006 — Modular Monolith Architecture](adr/ADR-006%20-%20Modular%20Monolith%20Architecture.md) | NestJS modular monolith, no microservices. |
| [ADR-007 — Frontend Framework Selection](adr/ADR-007%20-%20Frontend%20Framework%20Selection.md) | React, TypeScript and Vite. |
| [ADR-008 — Primary Database Selection](adr/ADR-008%20-%20Primary%20Database%20Selection.md) | PostgreSQL with Prisma. |
| [ADR-009 — Styling and Accessible Component Foundation](adr/ADR-009%20-%20Styling%20and%20Accessible%20Component%20Foundation.md) | Tailwind, Radix UI and Framer Motion. |
| [ADR-010 — AI Matching Approach](adr/ADR-010%20-%20AI%20Matching%20Approach.md) | LLM extraction, structured scoring and explanation; no vector DB in the MVP. |
| [ADR-011 — AI Assistant (Diango) Behaviour](adr/ADR-011%20-%20AI%20Assistant%20Diango%20Behaviour.md) | Single agent with tool use, session memory only. |
| [ADR-012 — Security Approach](adr/ADR-012%20-%20Security%20Approach.md) | Adapted SDL principles and automated security checks. |
| [ADR-013 — Development Methodology: SDD, BDD and TDD](adr/ADR-013%20-%20Development%20Methodology%20SDD%20BDD%20TDD.md) | Test-first development is mandatory. |
| [ADR-014 — Transactional Email Delivery](adr/ADR-014%20-%20Transactional%20Email%20Delivery.md) | Resend behind an `EmailSender` port. |
| [ADR-015 — Local Object Storage for Development](adr/ADR-015%20-%20Local%20Object%20Storage%20for%20Development.md) | SeaweedFS replaces MinIO for local S3-compatible storage. |

## UX / UI

Design foundations. Figma is planned to replace the wireframes (see AGENTS.md).

| Document | Description |
|---|---|
| [Design System](ux-ui/Design%20System.md) | Tokens, components and AI-experience guidelines. |
| [Authentication Flow](ux-ui/flows/Authentication%20Flow.md) | Registration, login and recovery journeys. |
| [Wireframes Authentication](ux-ui/wireframes/Wireframes%20Authentication.md) | Registration wireframes and UI states. |

## Conventions

- Documentation, code, identifiers and commit messages are written in English; some user stories and technical specifications are currently in Spanish.
- A new decision with real alternatives and a non-trivial cost to reverse gets its own ADR (`.claude/skills/create-adr`).
- Update this index when a document is added, moved or removed.
