# ADR-006 — Modular Monolith Architecture

## Status

Accepted

## Date

2026-08-28

## Context

YouPetMe's API needs an initial architectural style. The system is expected to grow across several business domains (Identity, Animals, Adoptions, Shelters, AI, and future domains such as Stores or Veterinary), or is being built by a single developer within a TFM's timeframe, with no existing production load or team-scaling pressure yet. A decision is needed on whether to start with a monolith, a modular monolith with enforced internal boundaries, or a microservices split from day one.

## Considered Options

### Option 1 — Traditional (non-modular) monolith

A single NestJS application with little enforced separation between business domains; modules may freely depend on each other's internals, and there is no explicit boundary between, for example, IAM and Animals.

### Option 2 — Modular monolith (Clean Architecture / Hexagonal / DDD principles), single deployable

A single deployable NestJS application, but organized by business module (IAM, Animals, Adoptions, Shelters, AI, plus cross-cutting Notifications and Platform), with explicit dependency direction (`presentation → application → domain`, `infrastructure → application/domain ports`) and a rule that modules do not read each other's persistence models directly.

### Option 3 — Microservices from the start

Each business domain (IAM, Animals, Adoptions, Shelters, AI, etc.) is built and deployed as an independent service from the beginning, communicating over the network (REST, messaging, or an API gateway).

## Decision

We will use:

**Option 2 — Modular monolith**, with Clean Architecture, Hexagonal Architecture and Domain-Driven Design principles applied inside module boundaries, and an Event-Driven approach available for internal domain/application events (e.g. `UserCreated`) without requiring an external message broker for the MVP.

## Consequences

### Advantages

- A single deployable application is significantly simpler to build, run locally (via Docker Compose) and reason about than a distributed system, which fits a TFM's scope and a single-developer team.
- Enforced module boundaries (dependency direction, no direct cross-module persistence access) mean the codebase does not become an unstructured "big ball of mud" even though it is a monolith — internal discipline substitutes for network boundaries.
- The system can be split into real microservices later, module by module, only if an operational or domain need actually justifies it — the modular structure is designed to make that split easier than it would be from a traditional monolith.
- Avoids the operational overhead of microservices (service discovery, network reliability, distributed transactions, per-service deployment pipelines) before there is any concrete scalability or team-scaling pressure to justify it.

### Disadvantages

- All modules currently share the same runtime and deployment unit; a performance or reliability issue in one module can, in principle, affect the availability of others until the architecture evolves.
- Enforcing module boundaries requires discipline (code review, linting rules) since NestJS does not prevent cross-module imports at the language level the way separate services would.
- Scaling a single module independently (e.g. scaling only the AI module under heavy load) is not possible without eventually extracting it.

## Rejected Alternatives

### Option 1 — Traditional (non-modular) monolith

Rejected because, without enforced module boundaries, a growing number of business domains (IAM, Animals, Adoptions, Shelters, AI, and future ones) would likely become tightly coupled over time, making the codebase harder to reason about and a future split into services significantly more costly, even though no split is planned for the MVP.

### Option 3 — Microservices from the start

Rejected because there is no current load, team-scaling or domain-isolation need that justifies the operational cost of a distributed system (network communication, service orchestration, distributed data consistency) at this stage. Introducing that complexity from day one would slow down MVP delivery within the TFM's scope without a corresponding benefit.

## Related documents

- ARCH-001 — Architecture Foundation
- Architecture Overview
