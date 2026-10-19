# ADR-010 — AI Matching Approach

## Status

Accepted

## Date

2026-08-29

## Context

YouPetMe's AI Matching functionality (Functional Map — AI Matching; Product Definition — Differentiating Concept) collects free-text or guided input from the adopter (personality, lifestyle, preferences, experience with animals, living situation, availability, expectations — see Requirements Overview, AI matching as a guest) and recommends compatible animals with an explanation. MVP.md scopes this as an "Initial AI matching experience". A decision is needed on the underlying mechanism: whether matching relies on vector/semantic similarity search (which would require a vector database, e.g. pgvector) or on a simpler structured approach, and what role, if any, an LLM plays in that pipeline.

## Considered Options

### Option 1 — Structured filtering only, no AI in the loop

The adopter fills structured fields (species, size, energy level, compatibility with children, etc.) directly, and animals are filtered or scored against those fields with ordinary application logic. No LLM is involved at matching time.

### Option 2 — LLM-based structured extraction + rule-based filtering/scoring + LLM-generated explanation

The adopter describes themselves and what they are looking for in free text (or a guided conversational flow). An LLM call extracts structured attributes from that text (e.g. housing size, activity level, experience with animals) into the same taxonomy used for the `Animal` catalogue's own attributes. Matching itself is then ordinary structured filtering/scoring against those extracted attributes, run against PostgreSQL — no vector search involved. A second LLM call generates a short natural-language explanation of why a given animal was recommended, using the adopter's extracted profile and the matched animal's attributes as input.

### Option 3 — Semantic/embeddings-based matching with a vector database

Both the adopter's free-text input and each animal's free-text description are embedded, and matching is done via vector similarity search (e.g. pgvector, Qdrant, Pinecone), instead of — or in addition to — structured attribute filtering.

## Decision

We will use:

**Option 2 — LLM-based structured extraction, structured filtering/scoring, and an LLM-generated explanation.** No vector database is introduced for the MVP.

## Consequences

### Advantages

- Preserves the free-text, conversational interaction that is the product's differentiating concept (Product Definition), without requiring the adopter to fill out a rigid form of checkboxes, while still reducing that input to reliable, filterable structured data before any matching decision is made.
- Matching itself remains simple, explainable and debuggable: it is ordinary structured filtering/scoring against PostgreSQL, not a similarity search whose results are harder to reason about or unit test.
- Requires no new infrastructure: no vector database, no embeddings pipeline, no additional service to deploy or pay for, consistent with the modular monolith's minimal-infrastructure philosophy (ADR-006) and with reusing PostgreSQL (ADR-008) rather than adding a dedicated store.
- Matches the scope MVP.md sets for this feature ("Initial AI matching experience") without over-building for a scale (millions of listings) the project does not have.
- The AI Assistant's mascot-narrated explanation (Design System — AI-assisted experiences, Diango) fits naturally as the surface for the LLM-generated explanation text produced in this flow.

### Disadvantages

- Matching quality depends on how well the extraction step maps free text onto the fixed structured taxonomy; nuance not captured by that taxonomy (e.g. a subtle personality trait with no corresponding field) is lost, unlike a semantic approach that could, in principle, capture it directly from the animal's free-text description.
- Two LLM calls per matching interaction (extraction, then explanation) add latency and per-request AI cost, which is already a recognized concern for guest usage (Non Functional Requirements — AI usage, cost and abuse protection) and must be covered by the same rate-limiting requirement.
- If the animal catalogue or the desired matching nuance grows significantly, the structured taxonomy may need frequent extension to keep capturing what matters, which is more manual upkeep than a semantic approach would require.

## Rejected Alternatives

### Option 1 — Structured filtering only, no AI in the loop

Rejected because it would remove the free-text, conversational interaction that Product Definition identifies as YouPetMe's main differentiating concept; reducing AI Matching to a plain filter form does not deliver that experience, even though it would be the simplest option technically.

### Option 3 — Semantic/embeddings-based matching with a vector database

Rejected for the MVP because the project's expected catalogue scale (hundreds to low thousands of animals for a TFM-stage product) does not need similarity search to find good matches, and because it would introduce infrastructure (a vector database or extension, an embeddings pipeline) with no corresponding benefit at this scale. If a genuine future need arises for nuance the structured taxonomy cannot capture, **pgvector** (as a PostgreSQL extension) is the preferred starting candidate over a separate vector database service such as Pinecone or Qdrant, since it avoids adding new infrastructure and is consistent with ADR-008 and ADR-006; at YouPetMe's realistic scale, published benchmarks show pgvector performance is not a material concern, and any gap versus dedicated vector databases matters mainly at multi-million-vector scale with highly selective filtered search, which is not this project's profile.

## Related documents

- Functional Map — AI Matching
- Product Definition — Differentiating Concept
- MVP — AI
- Requirements Overview — Access Model (AI matching as a guest)
- Non Functional Requirements — AI usage, cost and abuse protection
- ADR-006 — Modular Monolith Architecture
- ADR-008 — Primary Database Selection
- Design System — AI-assisted experiences
