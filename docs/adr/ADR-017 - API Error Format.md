# ADR-017 — API Error Format

## Status

Accepted

## Date

2026-11-06

## Context

The registration and login endpoints return errors that the web client must tell apart: validation failures per field, a duplicated email, wrong credentials, an account that is not available, a session that cannot be renewed and requests rejected by the `Origin` guard. ARCH-002 requires the API to map errors to "a documented, stable error shape". Until now that shape was defined only in the code.

Distinguishing cases by HTTP status alone is ambiguous: a `403` can mean that the account is not available (login) or that the `Origin` guard rejected the request.

## Considered Options

### Option 1 — Status and message only

The client decides by HTTP status and, where needed, by the text of the message.

### Option 2 — Stable `code` on business errors

The existing error shape gains an optional, stable `code` field. The client decides by `code`, and falls back to the HTTP status when there is none.

## Decision

We use **Option 2**.

### Error shape

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": []
}
```

- `statusCode` and `error` are the HTTP status and its name.
- `message` is a safe, generic text. The client never shows it directly: user-facing copy comes from the client's own translation files.
- `details` lists the per-field validation issues. Each one identifies the field and carries one of the stable validation codes below. It is empty or absent when the error is not a validation error.
- `code` is optional, stable and meant for programs. It is present on business errors.

### Stable codes

| Kind | Codes |
|---|---|
| Validation (inside `details`) | `REQUIRED`, `INVALID_FORMAT`, `INVALID_TYPE`, `TOO_SHORT`, `TOO_LONG`, `MISMATCH`, `MUST_BE_TRUE` |
| Business (`code`) | `INVALID_CREDENTIALS`, `ACCOUNT_NOT_AVAILABLE`, `SESSION_NOT_RENEWABLE` |

The validation codes live in `packages/contracts` (`ValidationErrorCode`), shared by the API and the web client.

### Rules

- Adding a code is compatible. Renaming or removing one is a breaking change of the API contract.
- No error exposes internal details: no stack traces, no database or framework messages, no hashes or tokens (ARCH-002 — Security baseline).
- `INVALID_CREDENTIALS` is the same whether the email does not exist or the password is wrong, so that accounts cannot be enumerated (TS-IAM-002).

## Consequences

### Advantages

- The client no longer guesses from the status: the `403` of an unavailable account and the `403` of the `Origin` guard are different cases.
- Texts can change, or be translated, without touching the logic that depends on them.
- The error contract is documented in one place.

### Disadvantages

- Every business error needs a code, and the codes must be kept in sync between API and client (mitigated by sharing them through `packages/contracts`).
- Errors from before this decision that carry no `code` rely on the status fallback.

## Rejected Alternatives

### Option 1 — Status and message only

Rejected because of the `403` ambiguity above and because it ties client behaviour to message text.

## Related documents

- ARCH-002 — Application Stack (Validation and HTTP errors)
- TS-IAM-001 — User Registration
- TS-IAM-002 — Login
- ADR-002 — Authentication Strategy
