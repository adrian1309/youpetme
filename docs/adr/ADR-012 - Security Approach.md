# ADR-012 — Security Approach: SDL Principles and Tooling

## Status

Accepted

## Date

2026-08-29

## Context

YouPetMe already has several security-relevant practices spread across different documents: authentication and session handling (ADR-002), a security baseline for validation, CORS and media uploads (ARCH-002, Non Functional Requirements), agent-facing rules against logging secrets or storing plaintext passwords (AGENTS.md), and a Definition of Ready/Done that already requires assessing "security, privacy and authorization impact" before and after implementing a User Story (ARCH-003, Requirements Overview). What is missing is (a) an explicit, named process tying these together across the project's lifecycle, including what happens if a vulnerability is found after release, and (b) a decision on automated tooling to catch known vulnerabilities (in dependencies) and common code-level issues before they reach `main`.

## Considered Options

### Process: adopting a Security Development Lifecycle (SDL)

- **Option 1 — Full, formal SDL** (Microsoft-style: Training, Requirements, Design, Implementation, Verification, Release, Response), with dedicated documentation and sign-offs per phase.
- **Option 2 — SDL principles adapted to project scale**, mapped onto documentation and workflow already in place, filling only the genuinely missing piece (a Response process for post-release vulnerabilities), rather than introducing new formal artifacts for phases already covered.
- **Option 3 — No named security methodology**, continuing with the existing scattered practices as-is.

### Tooling: automated vulnerability and code scanning

- **Option A — Snyk** for dependency (SCA), static code (SAST) and container/IaC scanning, as a dedicated third-party service.
- **Option B — GitHub-native tooling**: Dependabot (dependency vulnerability alerts and update PRs), secret scanning, and CodeQL (static analysis for TypeScript/JavaScript), all already available for a GitHub-hosted repository (ARCH-003) with no separate account or paid plan required for this project's needs.
- **Option C — Both**, using GitHub-native tooling as a baseline and adding Snyk for additional coverage.

## Decision

We will use:

**Option 2 (SDL principles adapted to project scale)** for process, and **Option B (GitHub-native tooling)** as the baseline for automated scanning.

### SDL mapping (Option 2)

Rather than introducing new phase documents, existing project artifacts are recognized as already covering most SDL phases:

| SDL phase | Already covered by |
|---|---|
| Requirements | Definition of Ready's "Security, privacy and authorization impact have been assessed" (ARCH-003, Requirements Overview) |
| Design | ADR-002 (auth), Non Functional Requirements — Security, AGENTS.md security rules |
| Implementation | AGENTS.md (no plaintext secrets, hashing, no logging sensitive data) |
| Verification | Required CI checks (ARCH-003): lint, type check, tests; extended by Option B tooling below |
| Release | Branch protection and required PR review (ARCH-003) |
| **Response** | **Not previously defined — see below.** |

**Response process (the genuinely new piece):** if a security vulnerability is found post-release, it is reported and tracked as a `fix` branch with elevated priority, following the existing branching/PR workflow (ARCH-003), with the Pull Request explicitly noting the vulnerability and its impact instead of a normal feature summary. No separate disclosure program or dedicated security contact is established for the MVP, consistent with the project's current single-developer, academic-project scale (Non Functional Requirements — Availability and reliability already applies the same reasoning to uptime SLAs).

## Consequences

### Advantages

- Delivers the real gap (a Response process) without inventing formal documentation for phases the project already effectively covers, avoiding busywork that would not change any actual behaviour.
- GitHub-native tooling (Option B) requires no new account, service or cost, and integrates directly with the existing CI/branch-protection workflow (ARCH-003) — Dependabot can open PRs for vulnerable dependencies through the same review process already defined, and CodeQL runs as another required or informational CI check alongside the existing ones (lint, type check, tests).
- Secret scanning directly reinforces an existing AGENTS.md rule ("Never commit secrets, credentials or real `.env` files") with automated enforcement instead of relying solely on developer discipline.

### Disadvantages

- GitHub-native tooling is less feature-rich than a dedicated platform like Snyk for some use cases (e.g. detailed license compliance reporting, broader IaC scanning) — acceptable for this project's current needs, but a real trade-off if those needs grow.
- The Response process defined here is intentionally lightweight; it would need to be revisited (e.g. a real disclosure policy, dedicated triage) if the project moves beyond a TFM towards a real user base.

## Rejected Alternatives

### Option 1 — Full, formal SDL

Rejected because most of its phases are already substantively covered by existing documents and workflow; introducing formal phase-gate documentation on top of that would duplicate effort without changing what is actually built or verified, for a single-developer, TFM-scale project.

### Option 3 — No named methodology

Rejected because the Response phase is genuinely missing today (if a vulnerability were found, there is no defined process for it), and naming the adapted approach makes the project's existing scattered security practices legible as a coherent whole, which also has value for how the project is presented and evaluated as a TFM.

### Option A — Snyk (alone)

Rejected as the starting choice because it introduces a third-party account and workflow for coverage that GitHub-native tooling already provides for this project's actual needs (dependency vulnerabilities, secrets, common code issues), consistent with this project's general preference for fewer moving parts (see ADR-006, and the LangChain/Gradio/multi-agent/Terraform entries in ARCH-002 — Explicit non-decisions). Not ruled out permanently — see below.

### Option C — Both, from the start

Rejected as a starting point for the same reason as Option A: adding Snyk alongside GitHub-native tooling before any concrete gap is identified is speculative. **Snyk remains an explicit future candidate** if a real need appears that GitHub-native tooling does not cover (e.g. detailed license compliance, or specific SAST coverage gaps found in practice), or independently, if learning it holds career value the author wants to pursue — but that is a distinct reason from a technical necessity of the project.

## Related documents

- ADR-002 — Authentication Strategy
- ARCH-003 — Development and Delivery Workflow
- AGENTS.md — Security and data rules
- Non Functional Requirements — Security
- ARCH-002 — Explicit non-decisions
