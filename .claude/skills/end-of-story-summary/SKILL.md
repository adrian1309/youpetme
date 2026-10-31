---
name: end-of-story-summary
description: Produce the end-of-User-Story summary required by AGENTS.md once a User Story's Definition of Done is met. Use when a User Story has just been completed — not for partial progress updates or non-story work like refactors or chores.
---

# End-of-Story Summary

Produce the summary required by **AGENTS.md — End-of-story summary** when a User Story's Definition of Done (ARCH-003 / Requirements Overview) has actually been met — not before.

## When to use this

Only once the Definition of Done checklist is genuinely satisfied: implementation complete, tests passing, manual validation done by the developer (not by this skill), documentation updated where needed. If the story is only partially done, do not produce this summary — report partial status in plain conversation instead.

## Required content

Cover exactly these five points, concisely — this is a quick-review summary for the project owner, not a duplicate of the PR description:

1. **Story and Acceptance Criteria** — which User Story/Use Case was completed, and a one-line restatement of what its Acceptance Criteria required.
2. **Decisions made during implementation** — anything decided that was not already fixed by existing documentation (an ADR, ARCH doc, or Technical Specification). For each one, flag explicitly whether it looks significant enough to warrant its own ADR (see the `create-adr` skill) — do not silently decide and move on for anything with real alternatives or a non-trivial cost to reverse.
3. **Deviations from the plan** — anything that differed from the original Technical Design or Use Case, and the concrete reason why.
4. **Test coverage added** — what was covered, following the Red → Green → Refactor cycle (ADR-013, AGENTS.md — Test-Driven Development is mandatory). Name the test files/levels (unit `.spec.ts`, integration `.integration-spec.ts`, E2E `.e2e-spec.ts`), not just "tests were added."
5. **Uncertainty or documentation contradictions encountered** — anything that came up along the way per AGENTS.md — When uncertain, even if it was ultimately resolved during the work. Do not omit something just because it got resolved; the project owner benefits from knowing it happened.

## Format

Keep it short — a handful of bullet points per section is enough. Do not restate the full PR description, the full diff, or re-explain background already established in the relevant User Story/ADR. If a point has nothing to report (e.g. no deviations occurred), say so in one line rather than omitting the section silently — an omitted section is ambiguous between "nothing happened" and "forgot to check."
