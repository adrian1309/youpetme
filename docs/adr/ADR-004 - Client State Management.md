# ADR-004 — Client State Management

## Status

Accepted

## Date

2026-08-28

## Context

`apps/web` is a React application that needs to manage two distinct kinds of state: data that originates from the API (server state) and state that exists only in the browser for the current interaction (UI state). A decision is needed on how each is managed, and specifically whether a global client-state library is introduced from the start of the MVP.

## Considered Options

### Option 1 — Redux (or another global client-state store) for all state

A single global store holds both server-derived data (fetched from the API) and local UI state, giving every component a consistent way to read and update shared state.

### Option 2 — TanStack Query for server state; React component state for UI state; no global store initially

Server state (data fetched from the API) is owned entirely by TanStack Query, which handles requests, caching, invalidation, retries and loading/error states. UI state that is local to a component or a small section stays in React's own component state (`useState`/`useReducer`). No global client-state library is introduced unless a concrete cross-cutting need arises.

### Option 3 — Zustand (or similar lightweight store) from the start, alongside TanStack Query

A lightweight global store is introduced from day one for any state that might eventually need to be shared, in addition to TanStack Query for server state.

## Decision

We will use:

**Option 2 — TanStack Query for server state, React component state for UI state, no global client-state library initially.**

A lightweight library such as Zustand may be adopted later, but only surgically, for a concrete cross-cutting client-state need shared between components that are not related in the component tree (for example, a future floating AI assistant widget triggered from multiple places in the UI). It would complement, not replace, TanStack Query, and would not be applied globally across the application.

## Consequences

### Advantages

- Avoids duplicating server-derived data in two places (a global store and TanStack Query's cache), which is a common source of stale-data and synchronization bugs.
- Keeps the mental model simple for most of the MVP: "does this data come from the API? Use TanStack Query. Is it local to this screen? Use component state."
- Avoids introducing and maintaining a dependency (Redux or similar) before a real, concrete need justifies it.
- Leaves the door open to adopt a lightweight store later, exactly where it is useful, without committing to it upfront or having to migrate away from a heavier solution.

### Disadvantages

- If a genuine cross-cutting UI state need appears before a store is introduced, the interim solution may rely on React Context or prop drilling, which can be more verbose for that specific case until the store is added.
- The team must recognize when a case has crossed from "local UI state" into "cross-cutting state" to introduce a store at the right time, rather than too early or too late.

## Rejected Alternatives

### Option 1 — Redux (or another global store) for all state

Rejected because most of the MVP's state is either server state (already well handled by TanStack Query) or state local to a single component or section. A global store for all state would duplicate server data unnecessarily and add complexity without a corresponding benefit at this stage.

### Option 3 — Zustand from the start, alongside TanStack Query

Rejected as a day-one decision because the MVP does not yet have a concrete cross-cutting client-state need. Introducing a store speculatively risks it being used inconsistently or for state that would be simpler as local component state. The library remains a strong option to adopt later, once a real case (e.g. the floating AI assistant) makes the need explicit.

## Related documents

- ARCH-002 — Application Stack
