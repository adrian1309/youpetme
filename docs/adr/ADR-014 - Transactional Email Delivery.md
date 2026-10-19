# ADR-014 — Transactional Email Delivery

## Status

Accepted

## Date

2026-09-14

## Context

TS-IAM-004 (Password Recovery) requires sending a transactional email containing a password reset link, and is currently blocked on this decision. ARCH-001 already anticipates a cross-cutting `Notifications` module ("Welcome email, Analytics, Onboarding, Notifications" as potential `UserCreated` consumers, and `Notifications` listed among the MVP's cross-cutting modules). No document has decided a concrete email provider or how sending is abstracted behind the existing hexagonal boundary pattern (`UserRepository`/`PrismaUserRepository`, `AIProvider`, media storage).

## Considered Options

### Option 1 — Resend

A developer-focused transactional email API with a generous free tier (3,000 emails/month, 100/day), a simple REST API, first-party TypeScript SDK, and native support for React-based email templates (React Email), which fits `apps/web`'s existing React stack.

### Option 2 — SendGrid (Twilio)

A long-established transactional email platform with a free tier (100 emails/day) and broad enterprise adoption, but a heavier dashboard/API surface and known stricter sender-reputation onboarding for new accounts.

### Option 3 — Amazon SES

The cheapest option at scale, but requires an AWS account, starts in a sandbox mode requiring manual approval to send to unverified addresses, and pulls the project toward the AWS ecosystem this project has generally avoided (see ARCH-002 — Deployment candidates, which explicitly did not favour a full cloud provider for this project's scope).

### Option 4 — Self-hosted SMTP

Running or configuring a self-managed SMTP relay, avoiding any third-party email API.

## Decision

We will use:

**Option 1 — Resend**, accessed behind a new application-level port (e.g. `EmailSender`), following the same hexagonal pattern already used for persistence, AI, and media storage. `Notifications` (already anticipated as a cross-cutting module, ARCH-001) owns this port and its Resend-backed infrastructure adapter; IAM's `RequestPasswordReset`/`ResetPassword` use cases depend only on the port, never on Resend directly.

**Local development and automated tests do not call Resend.** A different infrastructure adapter implementing the same `EmailSender` port is used instead:
- **Local development**: a console/log adapter that prints the email content (including the reset link) instead of sending it, so the flow is testable without any account or network call.
- **Integration/E2E tests**: a fake/in-memory adapter, or a local SMTP catcher (e.g. Mailpit) if testing actual email formatting/delivery mechanics is later judged necessary — not required for the MVP's test scope.

## Consequences

### Advantages

- Unblocks TS-IAM-004 with a concrete, low-friction provider; free tier is more than sufficient for a TFM-scale MVP.
- The `EmailSender` port keeps IAM's use cases free of any dependency on Resend specifically, consistent with AGENTS.md's dependency direction rule and this project's established pattern for external providers.
- React Email's fit with the existing React/TypeScript stack (ADR-007) avoids introducing a second templating technology just for emails.
- Avoids AWS account setup and its sandbox-mode approval friction (Option 3), consistent with this project's existing preference against a full cloud provider (ARCH-002 — Deployment candidates).
- Local development and tests never depend on a real email account or network access, keeping the developer loop fast and CI reliable.

### Disadvantages

- Introduces a new third-party dependency and account (Resend) that did not exist before.
- The free tier's volume limits (3,000/month, 100/day) are fine for a TFM but would need revisiting before any real launch with genuine user volume.

## Rejected Alternatives

### Option 2 — SendGrid

Rejected in favour of Resend because Resend's API and TypeScript-first developer experience are simpler for this project's scale and stack, with a comparable or better free tier, and without SendGrid's historically heavier new-sender reputation onboarding.

### Option 3 — Amazon SES

Rejected because it requires an AWS account and starts in sandbox mode (manual approval needed to email unverified addresses), and because this project has already leaned away from a full cloud provider for deployment (ARCH-002) — introducing AWS just for email would contradict that reasoning for no corresponding benefit at this scale.

### Option 4 — Self-hosted SMTP

Rejected because operating a reliable, well-deliverability SMTP relay is meaningful ongoing infrastructure work (IP reputation, SPF/DKIM/DMARC configuration, bounce handling) that a managed transactional email API already solves, for a single-developer TFM-scale project where that operational burden has no offsetting benefit.

## Related documents

- TS-IAM-004 — Password Recovery
- ARCH-001 — Architecture Foundation (Notifications module)
- ARCH-002 — Deployment candidates
- ADR-007 — Frontend Framework Selection
