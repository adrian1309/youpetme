# Domain Model

## Identity

The identity domain represents authentication and account-level information.

---

## User

A User represents an identity within YouPetMe.

Conceptual attributes:

- id
- email
- passwordHash
- status
- termsAcceptedAt
- termsVersion
- createdAt
- updatedAt

---

## UserProfile

UserProfile represents personal information.

Conceptual attributes:

- id
- userId
- firstName
- lastName
- createdAt
- updatedAt

---

## Separation

User represents:

> Who is this account?

UserProfile represents:

> What personal information does this account have?

---

## Profiles

Future profiles may include:

- AdopterProfile
- ShelterProfile
- StoreProfile
- VeterinaryProfile
- CaregiverProfile

A user may eventually have multiple profiles.

---

## Roles

Roles represent authorization rather than business profiles.

Potential roles:

- USER
- ADMIN
- SHELTER_MANAGER
- STORE_MANAGER
- VETERINARY_MANAGER

Roles and profiles must not be treated as the same concept.

### MVP roles

Only `USER` and `ADMIN` are implemented for the MVP. `SHELTER_MANAGER`, `STORE_MANAGER` and `VETERINARY_MANAGER` remain documented future roles: the MVP's own shelter is managed as `ADMIN`, and Store/Veterinary are out of scope entirely per the MVP document. These roles must not be added to the enum until the corresponding functionality is actually being implemented, to avoid unused authorization values.

### Unauthenticated access ("guest" / "visitor")

An unauthenticated visitor is **not** represented as a `Role`. A `Role` is an attribute of an authenticated `User`; a visitor has no `User` record, no credentials and no session, so no role value applies.

Public access to MVP functionality (for example browsing the animal catalogue or using the AI matching wizard without an account) is resolved at the routing and authorization layer — explicitly public endpoints/routes versus protected ones requiring a valid session — not by modelling a `GUEST` or `VISITOR` role. This is consistent with the public/protected route distinction already defined in ARCH-002.

`Visitor` remains a valid **actor** in flow-level documentation (see Authentication Flow), but it must not be introduced as a domain `Role` value.

If a future need arises to persist state for unauthenticated users (for example saved favourites or a resumable matching session without registration), that requires a distinct anonymous-identity mechanism (e.g. a device/session-bound identifier), not a role. Such a mechanism is out of MVP scope and would need its own decision record if introduced.

---

## MVP

The MVP initially requires:

User
    ↓
UserProfile
    ↓
Adopter functionality

Other profiles are future functionality.

---

## User Status

Initial conceptual states:

- ACTIVE
- SUSPENDED
- DELETED

Future:

- PENDING_VERIFICATION

---

## Password

Passwords must never be stored in plaintext.

Only a secure password hash may be persisted.

Password confirmation is a frontend/application validation concern and is never stored.

---

## PasswordResetToken

Represents a single-use, time-limited credential for resetting a forgotten password (TS-IAM-004).

Conceptual attributes:

- id
- userId
- tokenHash (hash of the reset token sent to the user; the plaintext token is never persisted, mirroring `UserSession.refreshTokenHash`)
- status: `ACTIVE`, `USED`, `EXPIRED`
- expiresAt
- createdAt

A password reset revokes all of the user's existing `UserSession`s once completed, consistent with ADR-002's "Password Changes" rule.

---

## Email

Email is unique within the platform.

Emails should be normalized before account lookup and persistence.

---

## Value Objects

The domain may use Value Objects where appropriate.

Potential example:

Email

The goal is to keep domain invariants explicit without overengineering the domain.

---

## Animals domain (MVP)

### Shelter

`Shelter` is included in the MVP domain model because ARCH-001 already lists `Shelters` as an MVP module ("shelter profiles and management of animals owned by a shelter"), even though `SHELTER_MANAGER` itself is not implemented yet (see Roles above). For the MVP, exactly one `Shelter` row exists — "YouPetMe" — managed by the `ADMIN` role, consistent with Product Definition's Adoption Model (MVP: YouPetMe's own catalogue). External shelters with their own account remain future scope (ADR-003).

Conceptual attributes:

- id
- name
- description
- createdAt, updatedAt

### Animal

Conceptual attributes:

- id
- shelterId (references `Shelter`; always the single MVP shelter for now)
- name
- species (e.g. dog, cat — exact enum to be finalized in Technical Design, not open-ended free text)
- breed (optional)
- size (e.g. small / medium / large)
- ageGroup (e.g. puppy / young / adult / senior)
- temperament (tags — see Design System, Animal information patterns, for the badge/tag display convention this maps to)
- compatibility (flags — e.g. compatible with children, compatible with other animals)
- careNotes (health or care considerations, free text)
- photos (object storage references only — see ARCH-002, Media storage; the domain has no knowledge of the storage provider)
- status: `AVAILABLE`, `RESERVED`, `ADOPTED`
- createdAt, updatedAt

`status` transitions are driven by `AdoptionRequest` below, not set freely: `RESERVED` when a request on this animal is `APPROVED`, `ADOPTED` when a request reaches `COMPLETED`. An admin may also revert `RESERVED` back to `AVAILABLE` if an approved request does not proceed (e.g. the applicant does not follow through) — see AdoptionRequest status notes.

### Taxonomy (fixed for the MVP)

- `species`: `DOG`, `CAT`, `OTHER` (kept minimal for the MVP; extending the enum later — e.g. rabbits, birds — does not require a migration strategy beyond adding a value).
- `size`: `SMALL`, `MEDIUM`, `LARGE`.
- `ageGroup`: `PUPPY_KITTEN`, `YOUNG`, `ADULT`, `SENIOR`.
- `temperament`: a free-form set of tags from a small fixed vocabulary — `CALM`, `PLAYFUL`, `ENERGETIC`, `SHY`, `AFFECTIONATE`, `INDEPENDENT` — an animal may have more than one. This vocabulary is intentionally short for the MVP; extend only when a real animal does not fit any existing tag, not speculatively.
- `compatibility`: two independent boolean flags — `compatibleWithChildren`, `compatibleWithOtherAnimals`. A `null`/unset value means "unknown", distinct from `false`.

This taxonomy is what AI Matching (ADR-010) extracts a user's free-text preferences into, and what the AI Assistant's catalogue-search tool (ADR-011) filters against — both must use these exact values, not invent their own.

---

## Adoption domain (MVP)

### AdoptionRequest

Represents a user's interest in adopting a specific animal, submitted through the platform. This **is** the contact channel between an interested user and the shelter for the MVP — resolving the "exact contact channel" item previously left open in Product Definition's Adoption Model: the adoption request form itself is that channel, not a separate email/contact mechanism.

Conceptual attributes:

- id
- animalId (references `Animal`)
- applicantUserId (references `User`)
- message (free text from the applicant, optional)
- status: `PENDING`, `APPROVED`, `REJECTED`, `COMPLETED`
- decidedByUserId (the `ADMIN` who approved/rejected, once decided)
- decidedAt
- createdAt, updatedAt

### Status meaning

- `PENDING` — submitted, not yet reviewed by the shelter (`ADMIN`).
- `APPROVED` — the shelter wants to proceed (e.g. arrange a meeting with the animal, per Product Definition's MVP adoption flow); the corresponding `Animal` moves to `RESERVED`.
- `REJECTED` — the shelter declines the request; the `Animal` remains/returns to `AVAILABLE`.
- `COMPLETED` — the adoption is finalized after the offline process (meeting, paperwork — Product Definition, MVP flow) concludes; the corresponding `Animal` moves to `ADOPTED`.

A `CANCELLED` status (applicant withdraws) is not modelled for the MVP; this is future scope if a real need for it appears.

## Related documents

- Product Definition — Adoption Model
- MVP — Animals, Adoption, Shelters
- Functional Map — Animals, Adoption, Shelters
- ADR-003 — External Shelter Adoption Model
- ADR-010 — AI Matching Approach
- ADR-011 — AI Assistant (Diango) Behaviour
- ARCH-002 — Media storage
