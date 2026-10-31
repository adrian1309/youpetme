# ADR-011 — AI Assistant (Diango) Behaviour

## Status

Accepted

## Date

2026-08-29

## Context

The AI Assistant (Functional Map — AI Assistant; MVP — AI, "Basic AI assistant") is represented by the mascot **Diango** (Design System — AI-assisted experiences). Diango needs two distinct interaction modes: a one-time welcome/introduction moment for new users, and an ongoing chatbot-style assistant available at any time. A decision is needed on how Diango accesses information (static reasoning only vs. tool use against live data), what it remembers and for how long, and what user context it uses — and which of these belong in the MVP versus later.

## Considered Options

### Interaction mechanism

- **Option 1 — Plain LLM responses only.** Diango answers from its system prompt and the conversation alone, with no access to live platform data.
- **Option 2 — Agent with tool use.** Diango can call defined tools (e.g. "search animals in the catalogue") to fetch live data from PostgreSQL when a question requires it (e.g. "do you have any small dogs available?"), in addition to answering general platform questions from its system prompt.
- **Option 3 — Retrieval-Augmented Generation (RAG).** Diango retrieves relevant chunks from a vector store before answering.

### Memory

- **Option A — No memory beyond a single message.** Each message is answered independently.
- **Option B — Session memory.** The current conversation's message history is resent with each call, so Diango has context within one chat session, but nothing persists once the session ends.
- **Option C — Persistent cross-session memory.** Diango recalls prior conversations across separate visits, stored server-side against the user's account.

### User context

- **Option X — No context.** Diango does not know anything about who it is talking to.
- **Option Y — Basic profile context.** Diango's system prompt is seeded with already-available data about the current user (e.g. `UserProfile` fields, the adopter profile saved by AI Matching, `UserProfile.matchingPreferences`) for the current interaction, without any new data collection or storage.
- **Option Z — Learned context from interaction history.** Diango adapts based on the user's past conversations over time, which depends on Option C (persistent memory) being in place first.

## Decision

For the **MVP**, we will use: **Option 2 (agent with tool use)** for the interaction mechanism, **Option B (session memory only)** for memory, and **Option Y (basic profile context)** for user context.

**Rejected/deferred for the MVP:** Option 1 and Option 3 for interaction mechanism; Option C and Option Z for memory/context — see Future scope below.

### Welcome/introduction moment (MVP)

In addition to the ongoing chatbot behaviour, the MVP includes a one-time **welcome trigger**: on a user's first visit, Diango appears centred on screen with a single speech-bubble message, distinct from the regular chatbot surface. Once dismissed, Diango returns to its normal always-available presence (Design System — AI-assisted experiences) and behaves as the agent described above. Whether the user has already seen this welcome moment is tracked per authenticated user (the `UserProfile.hasSeenWelcome` flag) or, for a guest, client-side (localStorage). The guest mark is stored under the key `youpetme:diango-welcome-seen` with the value `"true"`, defined as a single constant in the web client. When a guest who has already seen the welcome registers, the client sends that mark and the new profile is created with `hasSeenWelcome = true`, consistent with the guest/authenticated persistence split already established for Favourites (Functional Map — Animals, Future).

## Consequences

### Advantages

- Tool use (Option 2) keeps animal-related answers accurate and current without any indexing/embedding pipeline: Diango queries the live catalogue directly, so there is no staleness window and no new infrastructure, consistent with the same reasoning already applied to AI Matching (ADR-010) and to not adopting LangChain (ARCH-002 — Explicit non-decisions); Diango uses the same `AIProvider` port and the Anthropic SDK directly.
- Session memory (Option B) gives a coherent, natural conversation within a single chat without requiring any new persistence, storage design, or a Right-to-erasure review beyond what already exists.
- Basic profile context (Option Y) makes Diango feel personalized (it can reference the user's name or prior matching preferences) using data the platform already has, with no new data collection.
- Scoping the welcome moment to a simple per-user/per-guest flag keeps it cheap to build while still delivering the "feels alive from the first visit" experience described.

### Disadvantages

- Without persistent memory, Diango will not recall a conversation from a previous visit, which is a real limitation for a "personal companion" feel — accepted as a deliberate MVP trade-off, not an oversight.
- Tool use requires defining and maintaining a small set of tools (e.g. animal search) and their contracts, which is more upfront design than a plain prompt-only assistant, though it is bounded and already anticipated by the domain's existing structure (Animals module, ARCH-001).

### Future scope (explicitly deferred, not MVP)

- **Persistent cross-session memory (Option C)** and **learned context from interaction history (Option Z)**: recalling past conversations across visits. Deferred because it requires its own design (what is stored, retention, retrieval) and a dedicated privacy/GDPR review before implementation — Non Functional Requirements' data minimization and right-to-erasure principles would need to explicitly cover stored conversation history, which they do not today. This must not be implemented as an incidental side effect of another feature; it requires its own ADR when addressed.
- **Versioned update announcements**: extending the welcome trigger so Diango can also announce specific platform updates to returning users (not just a first-visit welcome), which requires tracking which announcement version each user has seen — a small but real extension of the current single "has seen welcome" flag.
- **RAG (Option 3)**: only reconsidered if the assistant needs to reason over a large body of unstructured content (e.g. an extensive help/policy corpus) that no longer fits reasonably in a system prompt — not a current need.

## Rejected Alternatives

### Option 1 — Plain LLM responses only (no tool use)

Rejected because "Provide information about animals" (Functional Map) requires accurate, current catalogue data; a plain prompt-only assistant would either need catalogue data baked into the prompt (unmaintainable and quickly stale) or would answer from outdated or hallucinated information.

### Option 3 — RAG

Rejected for the same reasons already established in ADR-010 for AI Matching: no unstructured content volume today justifies the added infrastructure (vector store, embeddings pipeline), and tool use already solves the concrete need (accurate animal data) more simply.

### Option C / Option Z — Persistent memory and learned context, in the MVP

Rejected for the MVP specifically because of the unresolved privacy design work required (retention, erasure, what is stored) — not because the feature lacks value. Building it without that review would risk conflicting with the project's own GDPR-aligned commitments (Non Functional Requirements — Privacy and data protection).

## Related documents

- Functional Map — AI Assistant
- MVP — AI
- Design System — AI-assisted experiences (Diango)
- ADR-010 — AI Matching Approach
- ARCH-002 — Explicit non-decisions (LangChain)
- Non Functional Requirements — Privacy and data protection
