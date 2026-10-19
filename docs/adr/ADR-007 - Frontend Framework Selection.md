# ADR-007 — Frontend Framework Selection

## Status

Accepted

## Date

2026-08-28

## Context

`apps/web` needs a frontend framework for a client-rendered single-page application, with a REST API designed to also serve a future mobile client (see ARCH-002 and README — "Future Mobile Application"). The project's author has prior development experience mostly in mobile frontend (Android Studio / native Android), limited prior web frontend experience, and had recently completed a React-focused course partly motivated by its job-market demand.

## Considered Options

### Option 1 — React

A component-based library with a large ecosystem, TypeScript support, and — relevantly for this project — a direct migration path to React Native for a future mobile client, reusing component logic, state-management patterns and team knowledge.

### Option 2 — Vue

A framework with a comparatively gentler learning curve for developers without prior web experience, a smaller but still active ecosystem, and less direct alignment with a React Native mobile strategy (a Vue-to-mobile path would require a different toolkit, such as NativeScript-Vue or Ionic, without the same first-party continuity).

## Decision

We will use:

**React**, with TypeScript and Vite (tooling covered separately in ARCH-002).

## Consequences

### Advantages

- Builds directly on the author's recent, dedicated learning investment (a React-focused course), avoiding the cost of ramping up on a second framework before development starts.
- React's ecosystem size and job-market demand were an explicit factor in choosing what to learn in the first place, which also benefits the project: a large pool of examples, libraries (many already selected in ARCH-002, e.g. TanStack Query, React Hook Form, React Router) and community support.
- Enables a lower-friction future path to a mobile application via React Native, reusing component patterns, TypeScript types and, where applicable, business logic — relevant given the author's own mobile development background and the project's stated intent to eventually ship a mobile client consuming the same API (README, "Future Mobile Application").
- The author's mobile frontend background (state, UI composition, component lifecycles) transfers conceptually to React's component model more directly than to some alternative frameworks' reactivity models.

### Disadvantages

- Vue is often considered to have a gentler learning curve for developers without prior web experience; React's choice does not optimize for the shortest possible ramp-up time, though this is mitigated by the course already completed.
- React requires more explicit architectural decisions (routing, server-state management, form handling) than more "batteries-included" frameworks, which is why ARCH-002 makes those choices explicit rather than relying on framework defaults.

## Rejected Alternatives

### Option 2 — Vue

Rejected primarily because the author had already invested in learning React specifically (motivated by job-market demand) before this architectural decision was made, and because React's path to a future mobile client via React Native aligns better with the project's own stated future scope and the author's existing mobile development background, compared to Vue's less direct mobile continuity.

## Related documents

- ARCH-002 — Application Stack
- README — Future Mobile Application
