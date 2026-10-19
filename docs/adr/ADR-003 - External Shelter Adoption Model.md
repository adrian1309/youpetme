# ADR-003 — External Shelter Adoption Model

## Status

Accepted

## Date

2026-08-28

## Context

YouPetMe's ecosystem includes external shelters as a documented future participant (see Product Definition — Ecosystem). Once external shelters can register and list their own animals (via the future `SHELTER_MANAGER` role, already defined in the Domain Model), a decision is needed on how much responsibility YouPetMe takes on for the resulting adoption process, and how new listings are moderated before or after publication.

This decision is written now, ahead of `SHELTER_MANAGER` implementation, because it shapes the Domain Model, authorization boundaries and future User Stories for the Shelters module, and because the project owner does not operate a real physical shelter — some external shelters that would join the platform may lack their own website or management system.

## Considered Options

### Option 1 — Showcase and communication facilitator

YouPetMe publishes animals belonging to external shelters and lets an interested user contact that shelter directly. The external shelter carries out the entire adoption process (evaluation, paperwork, hand-over) on its own, outside the platform, and is responsible for updating the animal's status once concluded. Newly published animals are not pre-approved; moderation is reactive, triggered only by a report.

### Option 2 — Delegated management for shelters without digital presence

For external shelters that lack their own website or system, YouPetMe (the project owner or an admin acting on the shelter's behalf) manages the shelter's listings and acts as the operational contact point when a user is interested, coordinating with the shelter directly rather than having the shelter self-manage its account.

### Option 3 — YouPetMe validates the adoption

YouPetMe itself would evaluate and approve adoption requests for externally-owned animals, similar to how it may eventually handle its own catalogue, and would only coordinate the physical hand-over with the external shelter.

## Decision

We will use:

**Option 1 — Showcase and communication facilitator**, with reactive (report-triggered) moderation of newly published listings.

This is consistent with the Adoption Model already defined for YouPetMe's own MVP catalogue (see Product Definition — Adoption Model, MVP flow): an `ADMIN` or, in the future, a `SHELTER_MANAGER`, registers and manages animals directly, and manually updates status after an adoption concludes offline.

## Consequences

### Advantages

- Keeps YouPetMe's legal and operational responsibility limited to discovery and communication; the platform does not evaluate or approve who adopts an animal it does not own or manage.
- Matches the MVP's own adoption flow, so the same domain concepts (animal status updated manually after an offline process) extend naturally to external shelters without a second parallel model.
- Reactive moderation avoids YouPetMe becoming an operational bottleneck for every listing a shelter publishes, which would not scale as more shelters join.
- Does not require YouPetMe to staff or resource an approval workflow before this is actually needed.

### Disadvantages

- Shelters without their own website or system still need someone to receive and act on user contact — Option 1 alone does not solve this for them; they must at least have a working contact channel (e.g. a monitored email or phone).
- Because moderation is reactive, an inaccurate or inappropriate listing could remain visible until it is reported.

## Rejected Alternatives

### Option 2 — Delegated management for shelters without digital presence

Rejected for now because it would make YouPetMe operationally responsible for managing listings and coordinating on behalf of shelters it does not control, which does not scale without dedicated resources and blurs the responsibility boundary established in Option 1. It remains a possible future extension — a distinct, explicitly evaluated product decision — if a real need arises from shelters that genuinely lack any digital presence, rather than an implicit part of this model.

### Option 3 — YouPetMe validates the adoption

Rejected because it would make YouPetMe legally and operationally responsible for deciding who adopts an animal it neither owns nor manages, which is a significantly larger scope than a TFM-stage platform should take on, and is inconsistent with the discovery/communication role already defined for external shelters in Product Definition.

## Related documents

- Product Definition — Ecosystem, Adoption Model
- MVP — Shelters
- Domain Model — Roles (`SHELTER_MANAGER`)
- Functional Map — Shelters
