# ARCH-003 — Development and Delivery Workflow

## Status

Accepted for MVP development.

## Objective

Define a consistent path from a product requirement to an integrated, deployable change. This workflow applies to all YouPetMe source code, technical documentation and database migrations.

## Delivery lifecycle

```text
User Story
  → Definition of Ready
  → Technical Specification and ADRs
  → Short-lived branch
  → Implementation and local verification
  → Pull Request
  → Automated CI checks and review
  → Merge to main
  → Deployment through the environment pipeline
  → Verification and story closure
```

## Definition of Ready

A user story is ready to begin development only when all applicable items are complete:

- [ ] The user story has an identifier, goal, acceptance criteria and priority.
- [ ] Relevant business rules, UX decisions and error states are defined.
- [ ] A technical specification exists when the change has meaningful technical complexity.
- [ ] Related ADRs are accepted, or any unresolved decision is explicitly called out.
- [ ] API request, response and error behaviour are known for a cross-application feature.
- [ ] Database impact and migration need have been assessed.
- [ ] Security, privacy and authorization impact have been assessed.
- [ ] Test scenarios are identified, including expected failure paths.
- [ ] The work is small enough to be reviewed as one coherent Pull Request; otherwise it is split into independently useful slices.

Being ready does not mean that every implementation detail is pre-decided. It means the team has sufficient product and technical clarity to start without inventing behaviour during implementation.

## Branching policy

`main` is the only permanent branch and must remain deployable. Direct pushes, force pushes and deletions are prohibited.

Every change begins from the current `main` on a short-lived branch. Naming format:

```text
codex/<type>/<scope>-<short-description>
```

Examples:

```text
codex/feature/iam-user-registration
codex/fix/iam-email-normalization
codex/docs/architecture-foundation
codex/chore/api-tooling
```

| Type | Use |
|---|---|
| `feature` | New user-facing or business functionality. |
| `fix` | Correction of faulty behaviour. |
| `docs` | Documentation-only change. |
| `chore` | Tooling, maintenance or non-functional housekeeping. |
| `refactor` | Internal structural improvement without intended behaviour change. |
| `test` | Test-only addition or correction. |

Branches should be deleted after merge. Long-running branches and a permanent `develop` branch are not used for the MVP.

## Commit convention

Commits follow Conventional Commits:

```text
<type>(<scope>): <imperative summary>
```

Examples:

```text
feat(iam): add user registration use case
fix(iam): normalize email before duplicate check
test(iam): cover duplicate registration response
docs(architecture): define delivery workflow
chore(web): configure linting
```

Rules:

- Use English, imperative summaries and no ending period.
- Keep each commit focused and independently understandable.
- Use an optional body to explain non-obvious context or consequences.
- Use `BREAKING CHANGE:` only when the public contract has an incompatible change.
- Do not commit generated secrets, local environment files, credentials or unrelated formatting changes.

## Changelog

`CHANGELOG.md` lives at the repository root and follows the [Keep a Changelog](https://keepachangelog.com/) format, grouped by version under `Added` / `Changed` / `Fixed` / `Removed`, with an `Unreleased` section at the top for changes not yet released.

It is generated from Conventional Commits (already required above), not written by hand: a tool such as `standard-version` or `changesets` parses commit types (`feat`, `fix`, `BREAKING CHANGE`) to produce entries and determine the next version automatically (following semantic versioning — `fix` → patch, `feat` → minor, `BREAKING CHANGE` → major). This keeps the changelog accurate without adding a manual step to every PR, and is why Conventional Commits are enforced as more than a stylistic convention.

The changelog is regenerated as part of the release process (when merging to `main` for a release, not on every feature PR), so a feature branch does not need to touch `CHANGELOG.md` itself — the commit messages are the source of truth it is generated from.

## Pull Request workflow

Every branch is integrated through a Pull Request (PR) to `main`.

### PR content

Each PR must include:

- A concise problem and solution summary.
- Links to the user story, technical specification and ADRs where applicable.
- The accepted behaviour and notable edge cases.
- Database migration impact, or an explicit statement that there is none.
- Testing evidence: commands or CI results and manual checks where relevant.
- Screenshots or recordings for visible UI changes.
- Explicitly stated follow-ups or known limitations.

Use a draft PR when collaboration or early feedback is useful but the change is not ready for formal review.

### Review standard

A reviewer checks correctness, security, architecture boundaries, readability, test relevance and documentation impact. Review comments should distinguish blocking issues from optional suggestions.

Before merge, a PR must have:

- [ ] A focused scope with no unrelated changes.
- [ ] All required CI checks passing.
- [ ] At least one approval when another reviewer is available.
- [ ] All blocking discussions resolved.
- [ ] Current base branch incorporated if required by GitHub or CI.
- [ ] Updated documentation and migrations when applicable.

For solo work, the author performs a documented self-review using the same checklist; the PR remains useful as the auditable integration record.

## Continuous Integration

CI runs for each Pull Request and for merges to `main`.

### Required PR checks

```text
install from lockfile
→ formatting verification
→ lint
→ TypeScript type check
→ unit and component tests
→ API integration tests
→ production build
```

E2E tests run for changes affecting critical journeys, and at minimum before a release candidate. Their execution may be split into a separate CI job due to browser runtime requirements.

The CI workflow uses the lockfile and pinned Node.js version. Dependency installation must fail when the lockfile and manifests diverge. No CI check may require production credentials.

## Database migration workflow

Any persistent data-model change requires a reviewed Prisma migration in the same PR.

```text
Schema change
→ Generate migration
→ Inspect generated SQL
→ Test against isolated PostgreSQL
→ Commit schema and migration together
→ Apply through deployment pipeline
```

Migration files are immutable once merged. A correction is made with a new migration, not by rewriting a migration that may already have run elsewhere.

Destructive or data-transforming migrations require an explicit rollback or recovery plan before approval.

## Definition of Done

A user story is complete only when all applicable items are true:

- [ ] Acceptance criteria are implemented and verified.
- [ ] Failure paths, validation and authorization rules have been covered.
- [ ] Relevant unit, integration, component and E2E tests pass.
- [ ] Manual validation has been performed for user-visible or security-sensitive flows.
- [ ] Linting, formatting, type checks and production build pass in CI.
- [ ] No secrets, internal errors or sensitive data are exposed.
- [ ] Documentation, API contract and ADR references are updated.
- [ ] Database migrations are present and verified when persistence changes.
- [ ] The PR has been reviewed or self-reviewed and all blocking comments resolved.
- [ ] The change is merged into `main` and verified in the target environment.

## Protection of main

The repository should configure a GitHub ruleset or branch-protection rule for `main` with:

- Pull Requests required before merging.
- Required status checks for CI.
- Required conversation resolution.
- No direct pushes, force pushes or branch deletion.
- One approving review when a reviewer is available.

GitHub supports requiring PR reviews, passing status checks and resolved conversations through protected branch rules or rulesets.

## References

- [ARCH-001 — Architecture Foundation](./ARCH-001%20-%20Architecture%20Foundation.md)
- [ARCH-002 — Application Stack](./ARCH-002%20-%20Application%20Stack.md)
- [Conventional Commits Specification](https://www.conventionalcommits.org/en/v1.0.0/)
- [GitHub protected branches documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
