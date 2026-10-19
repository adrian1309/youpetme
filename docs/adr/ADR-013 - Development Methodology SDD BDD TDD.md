# ADR-013 — Development Methodology: SDD, BDD and TDD

## Status

Accepted

## Date

2026-08-29

## Context

Requirements Overview already defines a specification-first hierarchy (Product Goal → Epic → User Story → Use Case → Acceptance Criteria → Technical Design → Implementation → Testing) and a hard rule against implementing functionality before its User Story and Use Cases are defined and approved — in substance, this is already Spec-Driven Development (SDD), though never named as such. Two related gaps remain: Acceptance Criteria have no defined format for expressing expected behaviour, and ARCH-003's Definition of Done requires tests to exist and pass but does not specify whether they are written before or after the corresponding code. A decision is needed on whether to formalize a combined methodology across these three levels — specification, behaviour, and implementation — and in what order they apply.

## Considered Options

### Option 1 — SDD only (current, unnamed state)

Continue as today: a specification-first hierarchy governs what gets built, with Acceptance Criteria written as free-form prose, and no defined discipline for when tests are written relative to code.

### Option 2 — SDD, formalized, with no additional layers

Name and document the existing specification-first approach explicitly (so it is legible as a deliberate methodology, not an implicit convention), without introducing BDD or TDD as named disciplines.

### Option 3 — SDD → BDD → TDD, layered

Keep SDD as the top-level, specification-first governance already in place (nothing changes there). Add **BDD** as the format for Acceptance Criteria: each Use Case's Acceptance Criteria are expressed as Given/When/Then behaviour scenarios, giving Requirements Overview's existing hierarchy a concrete, testable shape at the point it currently stops at prose. Add **TDD** as the implementation discipline for turning each scenario into code: a failing test is written first (unit, and where applicable integration), then the minimal implementation to pass it, then refactoring — applied within the Implementation step of the existing SDD hierarchy, not replacing it.

## Decision

We will use:

**Option 3 — SDD, BDD and TDD, layered in that order**, formalizing SDD explicitly and adding BDD and TDD to fill the two gaps identified above.

### How the three layers fit together

```text
SDD (already in place, Requirements Overview)
  Product Goal → Epic → User Story → Use Case
    ↓
BDD (new — gives Acceptance Criteria a concrete shape)
  Use Case → Acceptance Criteria written as Given/When/Then scenarios
    ↓
TDD (new — implementation discipline)
  Each scenario → failing test written first → minimal code to pass → refactor
```

- **SDD** governs *what* gets built and *when* work is allowed to start (unchanged: Definition of Ready/Done, ARCH-003).
- **BDD** governs how a Use Case's expected behaviour is *expressed*: Acceptance Criteria are written as Given/When/Then scenarios in the User Story/Use Case document itself, in plain language, before Technical Design begins. This does not mandate a specific Gherkin tool (e.g. Cucumber) — the scenarios can be implemented directly as Playwright/Jest/Vitest test cases following the same Given/When/Then structure, keeping the existing tooling from ARCH-002 rather than adding a BDD-specific test runner. A dedicated Gherkin tool may be reconsidered later if scenario reuse or non-technical stakeholder readability becomes a real need.
- **TDD** governs how each scenario becomes *code*: for unit and integration tests (Vitest/Jest per ARCH-002), the test for a given scenario is written before the implementation that satisfies it, following red → green → refactor. This applies at the level individual scenarios are implemented, not to exploratory or throwaway code.

## Consequences

### Advantages

- Fills both real gaps identified (Acceptance Criteria format, test-writing order) without introducing new tooling — BDD-style scenarios and TDD's red/green/refactor cycle both run on the test stack already decided in ARCH-002 (Vitest, Jest, Playwright).
- Given/When/Then scenarios make Acceptance Criteria directly traceable to the E2E tests already planned with Playwright (ARCH-002 already describes these as user "journeys" — a natural fit for behaviour scenarios), strengthening the existing Requirements → Testing traceability that Requirements Overview's hierarchy already intends.
- TDD's write-test-first discipline directly supports catching regressions and validation gaps early, reinforcing the Definition of Done's existing requirement that "automated tests pass" and "the developer has manually tested the functionality" (ARCH-003).
- Naming the methodology explicitly (rather than leaving it implicit) gives the project's development process a clear, presentable structure — relevant for how a TFM is evaluated on process, not only on the resulting product.

### Disadvantages

- TDD adds real discipline overhead: writing a failing test before any implementation is slower moment-to-moment than writing code first, especially while still learning a codebase or exploring an approach. This is accepted as a deliberate trade-off for the increased confidence and regression safety it provides, not applied dogmatically to exploratory spikes.
- BDD-style scenarios add a small amount of extra writing to each Use Case (structuring Acceptance Criteria as Given/When/Then rather than free prose), though this is a modest, one-time cost per Use Case, not an ongoing overhead.
- Without a dedicated Gherkin tool, scenarios are not automatically parsed from plain text into runnable tests; a developer (or agent) must translate each Given/When/Then scenario into Playwright/Jest/Vitest code by hand. Acceptable at the project's current scale; revisit if this translation step becomes error-prone or scenario reuse across tests becomes valuable.

## Rejected Alternatives

### Option 1 — SDD only, unnamed

Rejected because leaving the methodology implicit and undocumented means Acceptance Criteria continue to have no defined shape, and test-writing order remains unspecified — both gaps stay open, and the project's actual process discipline is less visible and less presentable than it already deserves to be, given what is already practiced informally.

### Option 2 — SDD, formalized, without BDD or TDD

Rejected because naming SDD alone would not close either of the two concrete gaps (Acceptance Criteria format, test-writing order) that motivated revisiting this decision; it would improve documentation clarity but not development practice itself.

## Related documents

- Requirements Overview — Requirement Hierarchy, Definition of Ready, Definition of Done
- ARCH-002 — Testing strategy
- ARCH-003 — Development and Delivery Workflow, Definition of Done
