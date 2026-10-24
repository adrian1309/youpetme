# Non Functional Requirements

## Status

**Version:** 0.1 — Foundation
**Status:** Provisional baseline for the MVP

This document defines quality attributes and constraints that apply across YouPetMe's functionality, independent of any single feature. It follows the same philosophy as the Design System: establish principles and known constraints now, leave concrete values as explicit open decisions rather than inventing figures that would not be maintained.

---

## Security

- Password hashing, session handling, token issuance and revocation follow **ADR-002 — Authentication Strategy**.
- The project's overall security process (mapped to Security Development Lifecycle principles) and automated scanning tooling (dependency, secret and static-code scanning) follow **ADR-012 — Security Approach**.
- Secrets and credentials are never committed to source control; `.env.example` contains only fictitious values (per AGENTS.md).
- Passwords, password hashes, access tokens and refresh tokens are never logged or exposed in API responses, error messages or client-side telemetry.
- All input is validated independently on both client and server; the server is the source of truth (already established for registration in TS-IAM-001, and applies as a general rule).
- CORS is restricted to trusted origins via `WEB_ORIGIN` (ARCH-002).
- Media upload URLs are short-lived and scoped to a single object (ARCH-002).

## Privacy and data protection (GDPR-aligned)

YouPetMe is treated as a real product from a data-protection standpoint, not only as an academic prototype, since it is intended to evolve beyond the TFM.

- **Lawful basis:** account creation and adoption requests rely on user consent. The Terms of Service / Privacy Policy checkbox already present in the Authentication Wireframes must record the acceptance timestamp and the accepted policy version, not only a boolean.
- **Data minimization:** only data required for the current step is requested (already applied to registration — phone, address, housing type, etc. belong to a later profile step, not registration).
- **Right to erasure:** deleting an account (the existing `DELETED` `User Status` in the Domain Model) must result in an actual purge of personal data, not only a status flag. This is a concrete use case to define for IAM before it is considered complete, not a future aspiration.
- **Right to access / data portability:** users should be able to request an export of their personal data. This is not required for the MVP visual prototype and does not block it, but should be scoped as a use case before a real launch.
- **Records of processing:** what personal data is collected, why, and how long it is retained should be documented per data category as the domain model grows (this document, plus Domain Model, are the natural home for it).
- Guest AI matching interactions are not persisted on the server (see Requirements Overview — Access Model); the only thing kept is the adopter profile in the guest's own browser (localStorage), under their control. This limits privacy exposure for unauthenticated usage by design and reduces the surface this requirement needs to cover.
- The AI Assistant (Diango) does not persist conversation history beyond the current session for the MVP (see ADR-011). A future persistent, cross-session memory for Diango is explicitly deferred until its own retention and right-to-erasure design is reviewed against these principles — it must not be implemented as a side effect of another feature.

## AI usage — cost and abuse protection

- AI matching and the AI assistant are reachable by unauthenticated guests (see Requirements Overview — Access Model). Because these features call a paid AI service, anonymous usage must be rate-limited (for example, per IP or per anonymous session) to prevent runaway cost from abuse or automated scripting.
- **Open decision:** exact rate limit thresholds, and whether authenticated users get a materially higher limit than guests.
- AI responses that are recommendations or explanations must be visually distinguishable from factual platform data (already defined in the Design System's AI-assisted experiences guidance).

## Performance

- No hard MVP targets are defined yet. **Open decision:** target response times for catalogue browsing/search and for AI matching responses (AI latency in particular should be communicated to the user via a loading state, per the Design System's Loading/Skeleton components, rather than assumed to be instant).

### Perceived performance

Real performance (milliseconds measured by tooling) and perceived performance (how fast the app *feels* to a user) are related but distinct, and users remember the latter. The following principles apply across the MVP wherever they are relevant, in addition to (not instead of) actual performance work:

- **Feedback rule:** every user interaction (button click, form submission, toggle) must produce visible feedback in under 100ms — a state change, not necessarily a finished operation. An interaction with no visible response is treated as a defect, independent of how fast the underlying request actually completes.
- **Never a blank screen while loading:** a loading state must always show at least the page/section structure (per the Design System's Skeleton component) rather than an empty screen, for any view expected to take longer than roughly 300ms.
- **Optimistic UI, applied selectively:** for reversible, low-risk, non-critical actions (e.g. toggling a favourite — see Functional Map, Animals — Future), the UI may update immediately and reconcile with the server in the background, rolling back with a clear error if the request fails. Optimistic UI must **not** be used for critical or hard-to-reverse actions — registration, login, password changes, submitting an adoption request — which must wait for server confirmation, consistent with TS-IAM-001's registration flow.
- **Progressive loading, where a view has clearly critical vs. secondary content:** load and render the critical content first (e.g. an animal's core detail) and let secondary content (e.g. related/recommended animals) load afterwards, rather than blocking the whole view on the slowest piece of data.
- **Target Web Vitals** (measured with tools such as Lighthouse or WebPageTest): First Contentful Paint (FCP) < 1.8s, Largest Contentful Paint (LCP) < 2.5s, Time to Interactive (TTI) < 3.8s, First Input Delay (FID) < 100ms. These formalize, with concrete industry-standard figures, the "open decision" on performance targets noted above; they apply as a target baseline for the MVP, without blocking it if not yet met, and should be revisited once real usage data exists.

Techniques such as image lazy-loading and blurred placeholders, hover-based prefetching, and aggressive caching (already partly covered technically by TanStack Query's cache, see ARCH-002) are useful implementations of these principles but are not mandated case-by-case here; they should be applied where they help meet the rule and targets above.

## Availability and reliability

- No formal uptime target is defined for the MVP; this is an academic prototype, not a production service with an SLA. **Open decision:** revisit if/when the project moves beyond the TFM.
- Adoption request submission must not silently fail: if the request cannot be completed, the user must see a clear error state and retain their entered data (consistent with the Design System's error-state guidance).

## Scalability

- The modular monolith (ARCH-001) is an explicit choice to defer scalability concerns; no specific load targets are defined for the MVP.
- Media storage is already designed to be decoupled from the relational database (ARCH-002), which avoids an early scalability bottleneck for animal photos regardless of final load.

## Accessibility

- Governed primarily by the Design System's "Accessibility baseline" section (semantic HTML, keyboard operability, visible focus, contrast, non-colour status cues, alt text). This document does not duplicate that guidance — it is referenced here so accessibility is understood as a non-functional requirement, not only a visual/design concern.
- **Target: WCAG 2.1 level AA** across the platform. Much of the Design System's existing accessibility baseline (contrast, visible focus, non-colour status cues, keyboard operability) already aligns with AA; this formalizes it as an explicit conformance target rather than an implicit set of good practices.

## Maintainability and documentation

- Enforced through existing process documents rather than restated here: Definition of Ready / Definition of Done (Requirements Overview, ARCH-003), Conventional Commits and PR review standard (ARCH-003), and the CHANGELOG, generated from Conventional Commits at release time rather than written by hand (ARCH-003 — Changelog).
- TypeScript strict mode, linting and formatting are mandatory quality gates in CI (ARCH-002, ARCH-003).

## Observability

- **Open decision:** no logging/monitoring strategy is defined yet. At minimum, authentication failures, AI service errors and rate-limit rejections should be logged (without sensitive data) once implementation begins, to support debugging and abuse detection.

## Internationalization

- **Decision:** the UI is structured with an i18n library (e.g. `react-i18next`) from the start of the MVP, with translation keys instead of hardcoded strings, even if only Spanish content is written initially. This keeps adding a second language (English) cheap later, since the architecture — not just the content — is the expensive part to retrofit.
- Technical documentation, code and identifiers remain English per AGENTS.md regardless of the product's UI language(s).

---

## Open decisions summary

- Exact AI rate-limit thresholds for guest vs. authenticated usage (mechanism decided, numbers pending).
- Whether the proposed Web Vitals baseline (FCP/LCP/TTI/FID, see Performance — Perceived performance) needs adjustment once real usage data exists.
- Data export (portability) use case: not blocking the MVP, to be scoped before a real launch.

Resolved: GDPR-aligned handling (treated as a real product, see Privacy section), accessibility target (WCAG 2.1 AA), internationalization approach (i18n-ready from the MVP, Spanish content first), perceived-performance principles and baseline Web Vitals targets (see Performance).

Until the remaining items are resolved, implementation must follow the principles above rather than assume unstated targets.

## Related documents

- ADR-002 — Authentication Strategy
- ADR-012 — Security Approach
- ARCH-001 — Architecture Foundation
- ARCH-002 — Application Stack
- Requirements Overview — Access Model
- Design System
