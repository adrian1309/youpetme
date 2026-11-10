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
- `details` lists the per-field validation issues. Each one has exactly three properties: `field`, `code` (one of the validation codes below) and `message` (an English text for developers, never shown to the user). Errors that are not validation errors carry no `details`.
- `code` is optional, stable and meant for programs. It appears only on the three business errors listed below. Every other error, such as the `409` of a duplicated email, the `403` of the `Origin` guard or the `415`, has no `code` and is identified by its status.

### Stable codes

| Kind | Codes |
|---|---|
| Validation (inside `details`) | `REQUIRED`, `INVALID_FORMAT`, `INVALID_TYPE`, `TOO_SHORT`, `TOO_LONG`, `MISMATCH`, `MUST_BE_TRUE` |
| Business (`code`) | `INVALID_CREDENTIALS`, `ACCOUNT_NOT_AVAILABLE`, `SESSION_NOT_RENEWABLE` |

| Business code | Status | Endpoint and case |
|---|---|---|
| `INVALID_CREDENTIALS` | `401` | Login: unknown email or wrong password, with exactly the same body in both cases. |
| `ACCOUNT_NOT_AVAILABLE` | `403` | Login: the account is not `ACTIVE` (returned only if the password is correct). Refresh: the account is not `ACTIVE`. |
| `SESSION_NOT_RENEWABLE` | `401` | Refresh: no cookie, invalid or expired token, unknown, revoked or expired session, or an already rotated token. |

The codes live in `packages/contracts` (`ValidationErrorCode` and `ErrorCode`), shared by the API and the web client. `ErrorCode` accepts only the three business codes above.

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

- A new business error that the client must tell apart needs a new code, kept in sync between API and client (mitigated by sharing them through `packages/contracts`).
- Errors without a `code` rely on the status.

## Rejected Alternatives

### Option 1 — Status and message only

Rejected because of the `403` ambiguity above and because it ties client behaviour to message text.

## Related documents

- ARCH-002 — Application Stack (Validation and HTTP errors)
- TS-IAM-001 — User Registration
- TS-IAM-002 — Login
- ADR-002 — Authentication Strategy
