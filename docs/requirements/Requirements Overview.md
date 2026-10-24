# Requirements Overview

## Purpose

This document defines the requirements management strategy for YouPetMe.

Requirements must be defined before implementation.

---

## Requirement Hierarchy

The project follows this hierarchy:

Product Goal
    ↓
Epic
    ↓
User Story
    ↓
Use Case
    ↓
Acceptance Criteria
    ↓
Technical Design
    ↓
Implementation
    ↓
Testing

This hierarchy is, in substance, a Spec-Driven Development (SDD) approach: no production functionality is implemented before its User Story and Use Cases are defined and approved (see Development Rule below). **ADR-013 — Development Methodology: SDD, BDD and TDD** names this explicitly and layers two further disciplines on top of it: Acceptance Criteria are expressed as Given/When/Then behaviour scenarios (BDD), and each scenario's implementation follows a test-first discipline (TDD).

---

## Access Model (Guest vs Authenticated)

YouPetMe follows a single, cross-cutting access rule instead of tagging each functionality individually:

> **Read-only / visual functionality is available to unauthenticated visitors ("guest"). Any functionality that creates, modifies or persists user-linked data — or that reads data already tied to a specific account — requires authentication.**

This applies across all functional areas, present and future, including modules not yet implemented for the MVP (Stores, Veterinary).

### Guest-accessible (examples)

- Browsing, searching and filtering the animal catalogue.
- Viewing animal detail pages.
- Browsing store and veterinary catalogues (once those modules exist).
- Using the AI matching assistant with a free-text or guided input, and receiving recommendations, without an account.

### Requires authentication (examples)

- Submitting an adoption request.
- Viewing the status of your own adoption request(s).
- Managing your user profile.
- Persisting matching preferences to an account.
- Shelter, store or veterinary management functionality.
- Administration functionality.

### AI matching as a guest — clarifications

- A guest can use the AI matching input and receive recommendations exactly like an authenticated user. No data is persisted on the server for a guest interaction; nothing about a guest's prompts or results is stored server-side beyond the interaction itself. The extracted adopter profile may be kept only in the guest's own browser (localStorage), so it can be offered as a starting point if they register (ADR-010).
- If the user registers, previously detected preferences may be offered as a *starting point* for their saved profile. This is a convenience default, not a restriction: an authenticated user retains full freedom to enter different prompts at any time, and the system must not narrow their input to what was inferred earlier.
- Because AI matching invokes a paid, rate-limitable AI service and is reachable without authentication, anonymous usage must be protected against abuse (for example, a rate limit per IP/session for unauthenticated requests). This is a non-functional requirement to capture formally in `Non Functional Requirements.md` before implementation, even though it is out of scope for the MVP visual prototype.

### Note on roles

This access model is independent of the `Role` enum defined in the Domain Model. Guest access is resolved at the routing/authorization layer (public vs protected routes), not through a `GUEST` role value — see Domain Model, "Unauthenticated access (guest / visitor)".

---

## Definition of Ready

A User Story is considered Ready for Development when:

- The business objective is understood.
- The User Story is clearly defined.
- The Use Cases are identified.
- Acceptance Criteria are defined.
- Dependencies are known.
- UX requirements are sufficiently defined.
- The relevant User Flow exists.
- The necessary Wireframe exists.
- The technical approach is understood.
- Open architectural decisions have been resolved or documented.

---

## Definition of Done

A User Story is considered Done when:

- Implementation is complete.
- Automated tests are implemented.
- Automated tests pass.
- The developer has manually tested the functionality.
- The developer has reviewed the changes.
- No known blocking issues remain.
- Documentation has been updated where necessary.

The developer, not Claude Code, performs the final manual validation.

---

## Development Rule

No production functionality should be implemented before its corresponding User Story and Use Cases have been defined and approved.
