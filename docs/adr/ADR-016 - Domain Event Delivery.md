# ADR-016 — Domain Event Delivery

## Status

Accepted

## Date

2026-10-21

## Context

TS-IAM-001 (`UserCreated`), TS-IAM-002 (`UserLoggedIn`) and TS-IAM-004 (`PasswordReset`) require publishing domain events, and TS-IAM-001 left the delivery strategy open ("to be defined in the project's event architecture"). ARCH-001 already anticipates events and consumers (for example welcome email, analytics, onboarding, notifications) but does not define how events are delivered.

Constraints already decided: the application is a modular monolith (ADR-006), ARCH-002 explicitly excludes a message broker from the MVP, and domain code must not depend on NestJS or other frameworks (AGENTS.md dependency direction).

## Considered Options

### Option 1 — In-process dispatch after the transaction commits

Events are plain objects defined in the domain layer. After the database transaction commits, the use case hands them to an application-level port (for example `EventPublisher`), whose infrastructure adapter dispatches them inside the same Node.js process (for instance with NestJS's event emitter). Handlers run in the same process and their failures are logged without affecting the original request.

### Option 2 — Transactional outbox

Events are written to an `outbox` table in the same transaction as the business data, and a separate process or poller delivers them. Delivery survives a crash between commit and dispatch.

### Option 3 — External message broker

Events are published to a broker such as RabbitMQ, Kafka or a cloud queue, supporting independent services and guaranteed delivery.

## Decision

We will use **Option 1 — in-process dispatch after commit**, behind an `EventPublisher` port.

- Domain events are plain classes in `domain/events/`, with no framework dependency.
- Use cases call the port only after the transaction has committed; events are never published for a rolled-back operation.
- Handlers are isolated: a handler failure is logged and never fails or rolls back the originating request.
- Events never carry secrets, tokens, hashes or passwords (as already required by each specification).
- Events must not be used for flows that must not be lost. In particular, sending the password-reset email in TS-IAM-004 is a direct call through the `EmailSender` port (ADR-014), not an event consumer.

This is the simplest option that satisfies the current specifications and does not change if a different delivery mechanism is adopted later, because only the port's adapter would be replaced.

**Known limitation:** if the process stops between the commit and the dispatch, the event is lost. This is acceptable for the MVP because the planned consumers are non-critical.

**Future option:** if a consumer ever needs guaranteed delivery, adopt Option 2 (transactional outbox) behind the same port, in a new ADR that supersedes this one. Option 3 would also require revisiting the "no message broker" non-decision in ARCH-002.

## Consequences

### Advantages

- No new infrastructure and very little code, consistent with the MVP scope.
- Domain and application layers stay free of NestJS and any delivery technology.
- Easy to test: unit tests use an in-memory `EventPublisher`, as with other ports.
- The delivery mechanism can be replaced without touching use cases.

### Disadvantages

- No delivery guarantee across process crashes.
- Handlers share the process and its resources with the API.
- Not suitable by itself for critical, must-not-lose flows.

## Rejected Alternatives

### Option 2 — Transactional outbox

Rejected for now: it adds a table, a delivery worker and retry logic that no current consumer needs. It remains the preferred upgrade path.

### Option 3 — External message broker

Rejected: contradicts the ARCH-002 non-decision on message brokers and is disproportionate for a single-process modular monolith.

## Related documents

- TS-IAM-001 — User Registration (`UserCreated`)
- TS-IAM-002 — Login (`UserLoggedIn`)
- TS-IAM-004 — Password Recovery (`PasswordReset`)
- ARCH-001 — Architecture Foundation
- ARCH-002 — Application Stack (explicit non-decisions)
- ADR-006 — Modular Monolith Architecture
- ADR-014 — Transactional Email Delivery
