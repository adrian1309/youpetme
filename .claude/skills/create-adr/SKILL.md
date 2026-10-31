---
name: create-adr
description: Create a new Architecture Decision Record (ADR) for YouPetMe, following the project's established format, numbering and cross-referencing conventions. Use when a decision with real alternatives, meaningful trade-offs, and a non-trivial cost to reverse needs to be documented — not for trivial or easily-reversed choices.
---

# Create ADR

Create a new ADR for YouPetMe following the exact structure already used by every existing ADR (ADR-002 through the latest in `docs/adr/`).

## Before writing

1. Read `docs/adr/` to find the current highest ADR number and use the next one.
2. Read at least one existing ADR (e.g. the most recent) to match tone, depth and section structure exactly.
3. Confirm the decision genuinely has real alternatives and a non-trivial cost to reverse — per AGENTS.md and this project's established pattern, ADRs are not written for trivial or easily-reversible choices. If unsure whether this decision warrants an ADR, ask rather than assume.

## Required structure

Every ADR uses this exact section order:

```markdown
# ADR-<NNN> — <Title>

## Status

Accepted

## Date

<YYYY-MM-DD>

## Context

<Why this decision is needed now: what triggered it, what constraints or prior decisions apply>

## Considered Options

### Option 1 — <name>
### Option 2 — <name>
### Option 3 — <name> (if applicable)

## Decision

We will use:

**<chosen option>**

## Consequences

### Advantages

### Disadvantages

## Rejected Alternatives

### Option <N> — <name>

<Why it was rejected — a real reason, not just "less popular">

## Related documents

- <cross-references to other ADRs, ARCH docs, Functional Map, MVP, etc.>
```

## Content rules

- **Context** must state what already exists (prior ADRs, documents) that this decision builds on or is constrained by — do not write it as if in a vacuum.
- **Considered Options** must include the option actually chosen plus every alternative genuinely weighed — not a straw man. If only one option was seriously considered, say so honestly rather than inventing alternatives to fill the section.
- **Rejected Alternatives** must give the *actual* reason each alternative was not chosen, tied to this project's specific context (scale, team size, existing decisions) — not generic pros/cons copied from documentation elsewhere.
- Prefer reusing terminology and cross-references already established in other ADRs and ARCH-00X documents rather than introducing new names for the same concepts.
- Keep the tone consistent with existing ADRs: direct, reasoned, no marketing language.

## After writing

1. Save the file as `docs/adr/ADR-<NNN> - <Title>.md` (matching the existing naming pattern).
2. Add the new ADR to the list of authoritative documents in `README.md`.
3. Add a "Related documents" cross-reference from any existing document whose decision this ADR extends, corrects, or depends on (e.g. if it extends ARCH-002, add a reference there too) — do not leave the new ADR as an orphan only linked from README.
4. If the new decision resolves an "open decision" or "explicit non-decision" noted elsewhere (e.g. Design System — Open decisions, ARCH-002 — Explicit non-decisions), update that note to reference the new ADR instead of leaving it as still-open.
