# ADR-015 — Local Object Storage for Development

## Status

Accepted, subject to the verification step described in the Decision section.

## Date

2026-10-20

## Context

ARCH-002 specified MinIO, running in Docker alongside PostgreSQL, as the local S3-compatible object storage for animal photos (signed upload URLs, no files proxied through the API). While initializing the repository, MinIO's Community Edition was found to be no longer viable:

- The management console was removed from the Community Edition (May 2025).
- Docker images and pre-built binaries stopped being published (October 2025).
- The repository was marked as no longer maintained and archived (February 2026); no new releases or patches are expected.

These facts come from community sources rather than an official announcement, and should be re-checked if the decision is revisited.

Photo storage is not needed until the animal catalogue work begins, so this decision does not block the first User Stories. It must be settled before that work starts. Only the local development and test environment is affected: the deployed environment is a managed S3-compatible provider (ARCH-002 — Deployment candidates), and application code reaches storage only through a port.

## Considered Options

### Option 1 — SeaweedFS

Apache 2.0 licence. The most mature of the three alternatives, with broad S3 support. It runs as several cooperating components (master, volume, filer), so it has more operational surface than the others, and its governance rests largely on one lead maintainer.

### Option 2 — Garage

AGPLv3 licence. A single, lightweight binary designed for small self-hosted setups. Its S3 API is deliberately narrower (no object versioning or bucket lifecycle policies in the current stable release). The AGPL has no practical impact on a development-only container.

### Option 3 — RustFS

Apache 2.0 licence. The newest and fastest-growing option. Its performance figures are published by the project itself, and a commercial entity with a planned paid tier is forming around it, which is a governance signal to monitor.

### Option 4 — Use the deployed provider (for example Cloudflare R2) in development as well

Removes the local container entirely, but makes local development and CI depend on an external account and network access, which contradicts the principle already applied to email (ADR-014).

## Decision

We will use **Option 1 — SeaweedFS** as the local S3-compatible storage in `infra/docker`, replacing MinIO.

**Verification before adoption:** none of the sources consulted confirm presigned-URL support for any of the candidates, and presigned upload URLs are the exact mechanism ARCH-002 requires. When the first story that needs photo upload begins, a short spike must confirm that the API can issue a presigned upload URL and that a client can upload to it. If SeaweedFS fails this check or proves too heavy to run locally, **Option 2 — Garage** is the fallback and this ADR is updated accordingly.

Application code must continue to access storage only through the storage port, so the choice of local server does not leak into the domain or application layers.

## Consequences

### Advantages

- Removes a dependency on an archived, unmaintained project.
- Permissive licence and a mature, widely adopted project.
- No change to the architecture: storage remains behind a port and the deployed provider is unaffected.

### Disadvantages

- More components to run locally than a single-binary alternative.
- The presigned-URL requirement is unverified until the spike is done.
- Single-maintainer governance is a long-term risk, mitigated by the port abstraction and by this tool being used only for development and tests.

## Rejected Alternatives

### MinIO Community Edition

Rejected: archived, with no published images or security patches.

### RustFS

Not chosen: too new, with vendor-published benchmarks and an evolving governance model. It remains a candidate if SeaweedFS and Garage both fail verification.

### Using the deployed provider in development

Rejected for the reasons given in Option 4.

## Related documents

- ARCH-002 — Application Stack (Media storage)
- ADR-014 — Transactional Email Delivery (same principle: no external dependency in local development)
