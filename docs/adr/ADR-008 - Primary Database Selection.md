# ADR-008 — Primary Database Selection

## Status

Accepted

## Date

2026-08-28

## Context

YouPetMe needs a primary datastore for its relational-looking domain: users, profiles, sessions, shelters, animals and adoption requests, with clear relationships between them (see Domain Model and TS-IAM-001, which already requires atomic, transactional creation of `User`, `UserProfile` and `UserSession` together). The project's author has prior experience mostly with relational databases (SQL, SQLite), some limited exposure to MongoDB, and is completing this decision within a Master's program whose instructor uses PostgreSQL in coursework.

## Considered Options

### Option 1 — PostgreSQL (relational)

A mature, open-source relational database with strong support for constraints (unique, foreign key, check), transactions and referential integrity, paired with Prisma as a typed ORM (already decided in ARCH-002).

### Option 2 — MongoDB (document-oriented)

A schema-flexible, document-oriented database where related data can be embedded or referenced, commonly chosen when the data model is expected to be heterogeneous or to change shape frequently, or when horizontal scalability of writes is an early concern.

## Decision

We will use:

**PostgreSQL**, accessed through Prisma ORM (already established in ARCH-002).

## Consequences

### Advantages

- The domain is fundamentally relational: `User` – `UserProfile` – `UserSession` (ADR-002, TS-IAM-001), and future entities such as `Animal`, `Shelter` and adoption requests, all have clear, stable relationships to each other. A relational schema with foreign keys and constraints models this naturally and lets the database itself enforce integrity (e.g. the unique email constraint already required in TS-IAM-001), rather than relying only on application-level checks.
- Several already-accepted requirements depend on relational guarantees: TS-IAM-001 requires `User`, `UserProfile` and `UserSession` to be created in a single atomic transaction, and Non Functional Requirements' "Right to erasure" section requires an actual purge of personal data on account deletion — both are naturally supported by PostgreSQL's transactional and relational integrity model.
- Builds on the author's existing relational database experience (SQL, SQLite), reducing the learning curve compared to adopting a document-oriented model this project has less prior experience with.
- Consistent with what is being taught and used in the author's Master's program, which keeps the academic and project contexts aligned and makes it easier to get support during development.
- Prisma (already selected in ARCH-002) is a typed ORM with particularly strong, first-class support for relational databases, including PostgreSQL, migrations and type-safe queries — a good fit for a relational schema.

### Disadvantages

- Schema changes require migrations (already addressed as a required workflow step in ARCH-002 and ARCH-003), which is more ceremony than a schema-less document store for early, fast-changing prototyping.
- Horizontal write scalability is comparatively harder with PostgreSQL than with some document-oriented databases, though this is explicitly out of scope for the MVP (see Non Functional Requirements — Scalability, which defers load concerns via the modular monolith decision).

## Rejected Alternatives

### Option 2 — MongoDB

Rejected because the project's data model is relational by nature (clear, stable entity relationships, not deeply nested or highly variable documents), so MongoDB's main strengths — schema flexibility and easy handling of heterogeneous or frequently changing document shapes — do not provide a clear benefit here, while PostgreSQL's relational integrity and transactional guarantees directly support requirements already accepted elsewhere (TS-IAM-001's atomic account creation, the Right to erasure requirement). The author's stronger prior experience with relational databases, and the Master's program's own use of PostgreSQL, further support this choice over adopting a less familiar model without a concrete technical need for it.

## Related documents

- ARCH-002 — Application Stack
- TS-IAM-001 — User Registration
- Domain Model
- Non Functional Requirements — Privacy and data protection (Right to erasure)
