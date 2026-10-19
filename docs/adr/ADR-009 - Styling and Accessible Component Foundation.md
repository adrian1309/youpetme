# ADR-009 — Styling and Accessible Component Foundation

## Status

Accepted

## Date

2026-08-29

## Context

`apps/web` needs a concrete way to implement the Design System's token categories (Colours, Typography, Spacing, Border radius, Shadows, Breakpoints, Motion) and its component inventory (Foundations, Forms, Content and data display, Navigation and overlays, Feedback, AI-assisted experiences), including interactive components with real accessibility requirements (modal/dialog, tabs, dropdowns). Design System already lists "Whether a component library will be used or components will be built in-house" as an open decision. Non Functional Requirements already commits to **WCAG 2.1 AA** as an accessibility target, and the author's prior development experience is mostly in mobile frontend (Android Studio) rather than web CSS or web accessibility implementation specifically.

## Considered Options

### Option 1 — Plain CSS / CSS Modules, components built fully in-house

Styling is written by hand (plain CSS or CSS Modules) and every interactive component (dialog, dropdown, tabs) is built from scratch, including its own keyboard navigation, focus management and ARIA attributes.

### Option 2 — A pre-styled, paid component library

Adopt a commercial React component library that ships both styling and interactive behaviour out of the box.

### Option 3 — Tailwind CSS for styling + Radix UI for accessible interactive primitives

Tailwind CSS provides utility classes for implementing the Design System's tokens (colour, spacing, typography, breakpoints) directly in JSX. Radix UI provides unstyled interactive primitives (dialog, dropdown, tabs, etc.) with keyboard navigation, focus management and ARIA already implemented, which are then styled with Tailwind. This is the same underlying pattern used by shadcn/ui and, by extension, component registries built on it such as 21st.dev.

## Decision

We will use:

**Option 3 — Tailwind CSS for styling, Radix UI for accessible interactive primitives.**

This resolves the "component library vs. in-house" open decision from Design System as a middle path: components are not a pre-styled dependency (they remain fully editable, in-house-owned code), but the accessibility-critical interaction logic for complex components is not reimplemented from scratch either.

## Consequences

### Advantages

- Directly supports the NFR's WCAG 2.1 AA target for the components where accessibility is hardest to get right by hand — dialogs, dropdowns, tabs — since Radix already implements correct keyboard navigation, focus trapping/restoration and ARIA attributes for these patterns.
- Tailwind's utility classes map naturally onto the Design System's semantic token categories (colour, spacing, typography, breakpoints, border radius, shadows), keeping implementation close to the tokens already defined rather than inventing a separate styling convention.
- Both are free and open source, consistent with ARCH-002's exclusion of a paid component library dependency.
- Component code is copied/owned in the repository rather than imported as an opaque dependency, preserving full editability — consistent with the project's existing preference (ARCH-002) against adopting a closed, versioned component library.
- Lowers implementation risk given the author's stronger background in mobile (Android Studio) than in hand-written web CSS and web accessibility patterns specifically.
- Enables using component registries built on the same foundation (e.g. 21st.dev) as an accelerant during development: components sourced this way are Tailwind + Radix based, so they compose directly with this stack without introducing a second styling convention.

### Disadvantages

- Tailwind's utility-class approach produces longer class lists in JSX, which has its own readability learning curve compared to named CSS classes.
- Radix only adds value for interactive components with real accessibility complexity; simple presentational components (e.g. a static badge) do not need it and should stay plain.
- Introduces two additional dependencies (Tailwind, Radix) and their own configuration, instead of zero styling dependencies.

## Rejected Alternatives

### Option 1 — Plain CSS / CSS Modules, fully in-house

Rejected because correctly implementing keyboard navigation, focus management and ARIA for complex interactive components (dialog, dropdown, tabs) by hand is easy to get subtly wrong, and the project has already committed to WCAG 2.1 AA as a formal target. Given the author's limited prior experience with web accessibility implementation specifically, this risk is material rather than theoretical.

### Option 2 — A pre-styled, paid component library

Rejected because it conflicts with ARCH-002's existing "Explicit non-decisions" exclusion of a component library with a paid dependency, and because it would trade away component ownership/editability for convenience the project does not need, given Option 3 achieves the accessibility benefit without that trade-off.

## Related documents

- ARCH-002 — Application Stack
- Design System — Open decisions, Accessibility baseline
- Non Functional Requirements — Accessibility
