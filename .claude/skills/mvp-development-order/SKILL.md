---
name: mvp-development-order
description: Determines which YouPetMe User Story (Jira issue) to work on next and in what sequence, and whether to do its Backend or Frontend subtask first. Use this whenever asked to start, continue, or pick up work on a User Story, to implement a feature for YouPetMe's MVP, or to say what to build next — even if the person just says "let's keep building" or "what should I work on now" without naming a specific story. Also consult this before creating any new User Story for the MVP, to place it correctly relative to the existing ones.
---

# MVP Development Order

YouPetMe's MVP has 14 User Stories in Jira (project SCRUM), grouped into five dependency-ordered blocks. This skill exists because the stories' `Blocks` links in Jira capture *which* stories must exist first, but not the *reasoning* for the recommended build order within that — that reasoning lives here.

## Why this order, not just "follow the Jira links"

The Jira `Blocks` links are necessary but not sufficient: several stories have no hard technical dependency on each other yet still have a sensible order (e.g. Browse/Filter Catalogue and Edit Animal both only depend on Register Animal, but Browse/Filter should come first because it makes the MVP demoable end-to-end sooner). This skill captures that judgment call so it does not have to be re-derived, or worse, silently guessed differently, each time.

## The five blocks

1. **Identity foundation** — Create Account → Login → Logout. Nothing else can be built or tested without an authenticated `ADMIN`, so this always comes first.
2. **Complete Identity** — Profile, then Password Recovery. Profile has no external dependency. Password Recovery is placed after it because it depends on a Resend account existing (ADR-014) — an external setup step, not a technical blocker, so it is a good candidate to prepare in parallel while other block-1/2 work happens.
3. **Minimal viable catalogue** — Register Animal → Browse/Filter Catalogue → View Animal Detail. This block's goal is a demoable, end-to-end slice (add an animal, see it, open it) as early as possible — Edit Animal is deliberately deferred out of this block even though it depends on the same prerequisite, because it does not contribute to that demoable slice.
4. **Close Animals + Adoption** — Edit Animal, then Submit Adoption Request, then Manage Adoption Request. Completes the full adoption lifecycle once the core catalogue already works.
5. **AI** — Welcome Introduction → AI Matching → AI Assistant Chatbot. Placed last on purpose: AI Matching and the Chatbot's catalogue-search tool are far more useful to build and test against a real, populated catalogue than against mocked data, so the catalogue work in blocks 3–4 should exist first. Welcome Introduction has no real dependency but is grouped here since it is the other Diango-related story.

## Before starting a story

1. Query Jira for the story's current status and its `Blocks` links (don't assume the block order above overrides a `Blocks` link — a hard dependency always wins over the softer sequencing judgment above).
2. If the story that should logically come first per the blocks above is not yet Done, say so and suggest starting there instead, rather than silently starting the requested story out of order. The person may have a good reason to jump ahead — surface the concern, don't block on it.
3. If a genuinely new User Story needs creating for the MVP (not one of the 14), place it in the block matching its actual dependencies, not by guessing — check the Domain Model and existing ADRs for what it actually needs to exist first.

## Within a story: Backend before Frontend

Each story's two subtasks (Backend, Frontend) are also ordered, and for the same reason as the blocks above: building the Frontend against an API whose shape is still settling means rework. Concretely:

1. Do the Backend subtask first, test-first per **Test-Driven Development is mandatory** (AGENTS.md, ADR-013) — each Given/When/Then scenario in the story's Acceptance Criteria becomes a failing test, then the minimal implementation, then refactor.
2. Only start the Frontend subtask once the Backend subtask's endpoint(s) are implemented and passing their tests — building against a real, working API rather than an assumed contract.
3. When the story's Definition of Done is met (both subtasks complete), use the `end-of-story-summary` skill. If anything decided along the way looks like it needs its own ADR, use the `create-adr` skill before moving to the next story — don't carry an undocumented decision forward into the next one.
