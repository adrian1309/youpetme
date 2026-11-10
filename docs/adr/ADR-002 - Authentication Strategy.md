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

## Token Design

- Access tokens are JWTs signed with HS256 and valid for 15 minutes. They carry the user id (`sub`), the session id (`sid`) and the role (`role`).
- Refresh tokens are JWTs signed with HS256 with a secret different from the access token's, and valid for 7 days. They carry the user id (`sub`), the session id (`sid`) and a unique token id (`jti`). They are delivered only in the cookie described below.
- The server never stores a refresh token. It stores only its SHA-256 hash, in `UserSession.refreshTokenHash`.
- Each refresh rotates the token inside the same `UserSession`: the stored hash and `expiresAt` are replaced, so the previous token stops working. The rotation is a conditional update, so two simultaneous refreshes with the same token cannot both succeed. The 7 days therefore count from the last refresh (sliding window) with no absolute maximum lifetime, and a session unused for 7 days expires. It is marked `EXPIRED` on the first refresh attempt after it lapses.
- A login creates a new `UserSession`. A refresh never does.
- A `UserSession` is `ACTIVE`, `REVOKED` or `EXPIRED`. Only an `ACTIVE` session can be refreshed.
- A normal refresh publishes no domain event.
- Symmetric signing is adequate while a single API issues and verifies the tokens. It should be revisited if another service ever has to verify them.

## Refresh Token Reuse

If a refresh token that was already rotated is presented, the server answers `401` and revokes the `UserSession`. Reuse is treated as a possible theft: neither the legitimate holder nor the attacker keeps access, and the user signs in again. A refresh against a `REVOKED` or `EXPIRED` session is also rejected with `401`.

The server gives no grace period for a token that has just been rotated (see Client-side Refresh Coordination).

## Cookie and CSRF Policy (Web)

- The refresh cookie is named `refresh_token`, is `HttpOnly`, has `Path=/api/v1/auth` and expires together with the session (`expiresAt`).
  - `Secure` is on by default (`COOKIE_SECURE`) and mandatory in production: the API refuses to start otherwise. It can be switched off only for local development over HTTP.
  - `SameSite` is `Strict` by default (`COOKIE_SAMESITE`). `None` is accepted only together with `Secure`.
- No CSRF token is used. CSRF is mitigated by three measures:
  - `SameSite=Strict` keeps the browser from sending the cookie on cross-site requests.
  - The register, login and refresh endpoints (guarded by `TrustedBrowserRequestGuard`) reject with `403` a request whose `Origin` header is present and differs from `WEB_ORIGIN`. A request without `Origin` (curl, tests, non-browser clients) is accepted.
  - The same endpoints reject with `415` a request whose `Content-Type` is present and is not `application/json` (parameters such as `charset` are ignored). A request without `Content-Type`, such as the body-less refresh, is accepted.
  - Read-only public endpoints, such as the terms version, are not covered by the guard.
- In development the web server runs on a fixed port (5173, `strictPort`). Another port would make the `Origin` guard reject the requests.

**Consequence for deployment.** `SameSite=Strict` only sends the cookie when the web application and the API are on the same site. The deployment ADR must put both under the same registrable domain, or revisit `SameSite` and the CSRF protection before going live. Locally it works because both run on `localhost`.

## Client-side Refresh Coordination (Web)

Because refresh tokens rotate and reuse revokes the session, two refreshes sent at the same time with the same cookie would revoke the session. The web client therefore:

- allows a single refresh in flight per tab, shared by every caller, and
- serialises refreshes across tabs with the Web Locks API (`navigator.locks`).

The web client also broadcasts the logout to the other tabs of the same browser through `BroadcastChannel('youpetme:auth')`. They fall back to the visitor state immediately and stay on their current route. Where `BroadcastChannel` is unavailable, they fall back to visitor state at their next refresh.

**Known limitation.** Where Web Locks are unavailable (very old browsers, or non-secure origins such as HTTP on a host other than `localhost`), the client refreshes without the cross-tab lock. If two tabs refresh at overlapping moments, the second is seen as a reuse, the session is revoked and both tabs fall back to visitor state, so the user signs in again. Production runs on HTTPS, so this is accepted.

Alternatives not adopted: a fallback lock based on `BroadcastChannel` or `localStorage`, and a server-side grace period for just-rotated tokens, which would weaken reuse detection.

## Access Token Guard

Protected endpoints use a **stateless** guard: it verifies the signature and the expiry of the access token and does not query the database. This is consistent with the short lifetime of the access token (15 minutes).

**Consequence.** An access token that was already issued stays valid until it expires, even if its `UserSession` has been revoked (logout, reuse detection, or a password change). Revocation prevents the session from being refreshed, so the exposure lasts at most 15 minutes. If immediate revocation ever becomes a requirement, the guard can additionally check that the session identified by the `sid` claim is `ACTIVE`, at the cost of a database read on every protected request. That change would amend this section.

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

Added 2026-11-10, from the implementation of TS-IAM-003:

- `POST /api/v1/auth/logout` requires a valid access token. The session to revoke is the one identified by the refresh token cookie, and only if it belongs to the same user as the access token. Otherwise the answer is `401` and nothing is revoked. Only the current session is revoked.
- Logout is idempotent: with no cookie, an invalid cookie, or a session that is already `REVOKED` or `EXPIRED`, it answers `204`, clears the cookie and publishes no event.
- The client never depends on the server for signing out. It waits for the response for at most 5 seconds, then cancels the request and clears its authentication state anyway.
- A refresh that finishes after the logout is ignored, so it cannot bring the session back.
- **Known limitation.** If the request fails because of the network, the cookie and the server-side session stay active. The client shows the visitor state, but reloading the page restores the session through the refresh while the cookie is still valid.

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

---

## Amendments

- **2026-11-06:** added Token Design, Refresh Token Reuse, Cookie and CSRF Policy and Client-side Refresh Coordination, from the implementation of TS-IAM-002 (login and refresh). The API error format is decided in ADR-017.
- **2026-11-10:** added Access Token Guard (stateless) and the Logout rules, and the cross-tab logout in Client-side Refresh Coordination, from the implementation of TS-IAM-003.
