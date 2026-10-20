# ADR-002 — Authentication Strategy

## Status

Accepted

## Date

2026-08-16

## Context

YouPetMe requires an authentication mechanism for its web application and future mobile application.

The system must support:

- User registration
- Login
- Logout
- Protected API endpoints
- Password recovery
- Multiple user sessions/devices
- Session revocation
- Future mobile clients

The backend is designed as a modular monolith using NestJS and TypeScript.

---

## Considered Options

### Option 1 — Server-side Sessions

The server maintains session state and the client receives a session cookie.

### Option 2 — Single JWT

The client receives a JWT and sends it with API requests until expiration.

### Option 3 — Access Token + Refresh Token

The client uses a short-lived access token and a longer-lived refresh token to obtain new access tokens.

---

## Decision

We will use:

**Short-lived JWT access tokens + rotating refresh tokens.**

Refresh tokens will be associated with individual user sessions.

---

## Password Hashing

TS-IAM-001 defers the password hashing algorithm and its parameters to this ADR; this section is that decision.

**Algorithm: Argon2id.** It is OWASP's current recommended default for password hashing, and is resistant to both GPU-cracking (unlike bcrypt/scrypt at low memory settings) and side-channel attacks (unlike the pure data-independent Argon2i or pure data-dependent Argon2d variants) by design.

**Parameters (starting point, to be load-tested before production):**

- Memory cost: 19 MiB (OWASP minimum recommendation for Argon2id)
- Iterations: 2
- Parallelism: 1

These parameters follow OWASP's current minimum guidance and are deliberately conservative for a development machine; they should be re-validated against real deployment hardware before going live, per this ADR's own "Consequences" reasoning below.

The implementation uses a hashing abstraction (per TS-IAM-001), not a direct library call from the use case, so the algorithm or its parameters can change later without touching application logic — consistent with the hexagonal boundary already established for persistence.

**Password policy:** minimum 8 characters, per TS-IAM-001's registration form; no maximum beyond a sane upper bound (e.g. 128 characters) to avoid arbitrarily blocking legitimate long passphrases. No mandatory complexity rules (uppercase/number/symbol) are enforced — modern guidance (OWASP, NIST) favours length over forced complexity, which tends to encourage predictable substitutions rather than genuinely stronger passwords. This client- and server-side rule is the single source of truth referenced by TS-IAM-001 and the Design System's password field guidance.

---

## Web Client

For the web application:

- Access tokens will be kept in application memory.
- Refresh tokens will be protected using Secure, HttpOnly cookies.
- Cookie configuration will use an appropriate SameSite policy.
- CSRF protections will be implemented where required.
- CORS will explicitly allow trusted frontend origins.

---

## Mobile Client

Future mobile applications will use the same authentication API.

Refresh tokens will be stored using the platform's secure storage mechanisms.

---

## Refresh Token Rotation

Each refresh operation should issue a new refresh token.

The previous refresh token will be invalidated.

This reduces the usefulness of a stolen refresh token.

## Token Lifetimes

- **Access token:** 15 minutes (`JWT_ACCESS_EXPIRATION=15m`). Short enough that a stolen access token is of little use.
- **Refresh token:** 7 days (`JWT_REFRESH_EXPIRATION=7d`). Each rotation issues a new refresh token with a new 7-day lifetime, so an actively used session stays signed in, and an unused one expires after a week.

These values are the MVP defaults, chosen as a balance between convenience and security. They live in configuration, not in code, so they can be tuned without a code change. A longer-lived "remember me" session is future functionality and is not part of the MVP.

---

## Session Model

A user may have multiple active sessions.

Conceptually:

User
    |
    +-- UserSession
    +-- UserSession
    +-- UserSession

This allows the platform to revoke individual or all sessions.

---

## Logout

Logout will revoke the relevant user session and remove client-side authentication state.

---

## Password Changes

Changing a password will revoke existing sessions to reduce the risk of unauthorized access.

---

## Security Considerations

The implementation must consider:

- XSS
- CSRF
- CORS
- Token theft
- Token expiration
- Refresh token rotation
- Session revocation
- Secure cookie configuration
- Password hashing

---

## Consequences

### Advantages

- Suitable for web and mobile clients.
- Short-lived access tokens reduce exposure.
- Refresh token rotation improves security.
- Sessions can be revoked.
- The backend can support multiple clients.

### Disadvantages

- More complex than simple sessions.
- Requires refresh token management.
- Requires careful cookie and CSRF configuration.
- Requires additional persistence for sessions.

---

## Rejected Alternatives

### Server-side Sessions

Rejected as the primary strategy because the project is intended to support multiple client types, including a future mobile application.

### Single Long-lived JWT

Rejected because token revocation and security become more difficult when tokens remain valid for long periods.