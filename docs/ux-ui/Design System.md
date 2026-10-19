# YouPetMe Design System

## Status

**Version:** 0.1 — Foundation  
**Status:** Provisional design baseline for the MVP  
**Last reviewed:** 2026-08-26

This is the canonical reference for YouPetMe's visual language and reusable interface patterns. It provides a coherent MVP baseline without prematurely fixing visual choices that still need exploration.

## Purpose and scope

The Design System supports a consistent, accessible and trustworthy experience across public and authenticated web flows.

It defines:

- Design principles and accessibility expectations.
- Initial token categories and component inventory.
- Component states and feedback patterns.
- Responsive behaviour for web interfaces.
- Product-specific patterns for animals and AI-assisted experiences.

It does not yet define final brand assets, exact token values, an implementation library or a complete component catalogue. Those decisions will be added after validation.

## Design principles

### Clarity over decoration

Every screen must make its purpose and next action immediately understandable. Visual decoration must never obscure content, hierarchy or task completion.

### Animal first

Animal photos, welfare-relevant characteristics and adoption context are primary information. The interface should help users understand an animal before encouraging an action.

### Trust and safety

Adoption is a meaningful decision. The interface must communicate reliability through clear information, predictable behaviour, transparent status and respectful handling of personal data.

### Progressive disclosure

Show the information required for the current decision first. Reveal optional detail, advanced filters and complex explanations only when the user needs them.

### Accessibility by default

Interfaces must support keyboard navigation, visible focus, semantic structure, clear labels and understandable errors. Colour must not be the only way to convey meaning or state.

### Consistency

The same component and interaction pattern must behave consistently wherever it appears. New patterns should be introduced only when existing ones cannot express the need clearly.

## Brand direction

The visual direction is friendly, modern, calm and emotionally warm. The product should feel animal-oriented without becoming childish or visually noisy.

The provisional colour direction is a raspberry or berry primary colour with neutral light backgrounds. Final brand colour, typography, logo, iconography and illustration style remain open decisions.

## Design tokens

Tokens will be the single source of reusable visual values once implementation starts.

| Group | Purpose |
|---|---|
| Colours | Brand, neutral, semantic and surface colours. |
| Typography | Font families, sizes, weights, line heights and text roles. |
| Spacing | Consistent gaps, padding and layout rhythm. |
| Border radius | Shape consistency for controls, cards and overlays. |
| Shadows | Elevation and separation where necessary. |
| Breakpoints | Responsive layout thresholds. |
| Motion | Duration and easing for purposeful transitions. |

Semantic tokens must describe purpose rather than a raw colour name. For example, prefer `color-feedback-error` over `red-600` in component decisions.

## Layout and navigation

### Layout primitives

- **Container:** constrains readable content width and page alignment.
- **Section:** separates meaningful page regions vertically.
- **Grid:** arranges responsive groups of cards, controls or content.
- **Stack:** arranges related elements in a vertical rhythm.

### Navigation

Use a primary navigation bar for global destinations and contextual navigation only where a section contains multiple related views. The final mobile navigation pattern remains an open decision.

Navigation must expose the current location and remain usable by keyboard and assistive technology.

## Component inventory

### Foundations

- Typography
- Iconography
- Button and Link
- Divider
- Container, Section, Grid and Stack

### Forms

- Text input and Password input
- Select
- Checkbox and Radio group
- Textarea
- Form field wrapper with label, hint and error message

### Content and data display

- Card and Animal Card
- Badge and Tag
- Avatar
- Empty state
- Description list or key-value information block

### Navigation and overlays

- Navbar
- Tabs, when needed
- Modal or dialog
- Drawer, if required for mobile navigation or contextual actions

### Feedback

- Alert and Toast
- Loading indicator and Skeleton
- Error state
- Success confirmation

### AI-assisted experiences

- Assistant message
- Recommendation Card
- Match Score
- Recommendation explanation panel

AI-related UI must distinguish clearly between factual platform information and generated recommendations or explanations.

**Mascot:** for the MVP, the AI Assistant is represented by a mascot character: **Diango**, a black Labrador. On a user's first visit, Diango appears centred on screen with a single speech-bubble welcome message, distinct from its regular chatbot presence; once dismissed, Diango moves to its normal always-available position, guides a short personality-matching flow, and remains visible on screen so the user can ask questions at any point (consistent with the AI Assistant functionality in Functional Map). The mascot includes a tail-wagging animation while displaying its speech bubbles, reinforcing the "Animal first" and "Trust and safety" principles above. Diango's underlying behaviour (tool use against the live catalogue, session-only memory for the MVP) is defined in ADR-011. A future option to choose between different mascot animals/breeds is tracked in Functional Map — AI Assistant.

## Component states

Interactive components must define their visual and behavioural states before implementation.

| State | Requirement |
|---|---|
| Default | Clearly communicates the normal available action or value. |
| Hover | Offers a subtle pointer-device affordance without replacing focus feedback. |
| Focus | Is clearly visible for keyboard users. |
| Active | Provides immediate feedback during interaction. |
| Disabled | Explains unavailability through context when the reason is not obvious. |
| Loading | Prevents accidental duplicate actions while preserving context. |
| Error | Identifies the issue and explains how the user can recover. |
| Success | Confirms a completed action without unnecessarily interrupting the user. |

Not every component requires every state. Each component must define only the states meaningful for its role.

## Form and validation guidelines

- Every input has a persistent, visible label; placeholder text is not a substitute for a label.
- Validation errors appear close to the affected field and explain how to correct the issue.
- Required fields are identified consistently.
- Submit actions prevent duplicate requests while a submission is pending.
- Server validation errors are presented safely and mapped to meaningful UI feedback.
- Sensitive values, including passwords and tokens, must never be exposed in error messages or telemetry.

The registration form requires first name, last name, email, password and password confirmation. Password confirmation exists only for interaction validation and is never persisted.

### Validation timing

- Validate a field on `blur` (when the user leaves it), not on every `onChange` keystroke — per-keystroke validation shows errors while the user is still typing, which reads as overly aggressive. Once an error is shown, clear it as soon as the user re-focuses the field, so a stale error is not shown while they are actively correcting it.
- A full-form validation also runs on submit, to catch anything not yet touched (e.g. a field the user skipped entirely).
- Error messages follow a consistent structure: what is wrong, and how to fix it (e.g. "Password must be at least 8 characters" rather than "Invalid password"). Tone is helpful, not blaming ("must be", not "you entered").

### Input types and mobile keyboards

- Use the semantically correct HTML input type for each field (`email`, `tel`, `date`, `number`, `url`), not a generic `text` input, so mobile devices show the matching keyboard (e.g. `email` shows the `@` key, `tel` shows a numeric keypad).
- Input width should roughly match the expected content length (e.g. a postal code field narrower than a street address field) so the user can anticipate what is expected.

### Autofill and required fields

- Forms and their inputs set the appropriate `autocomplete` value (e.g. `name`, `email`, `tel`, `street-address`) so the browser's autofill can complete them correctly, reducing user effort.
- When most fields in a form are required, mark the exceptions ("optional") instead of marking every required field, to reduce visual noise.

### Password fields

- Provide a visible show/hide toggle for password fields; do not hide the value with no way to reveal it.
- Do not disable paste on password fields — this breaks compatibility with password managers.
- Where a password policy applies (see TS-IAM-001), show its requirements near the field and indicate which are already met as the user types.

### Mobile form considerations

- Touch targets (buttons, inputs) are at least 44x44px.
- Input `font-size` is at least 16px, to avoid iOS Safari automatically zooming in when a field receives focus.
- Forms use a single-column layout on mobile viewports, consistent with the Responsive behaviour table above.
- On a long form displayed with the keyboard open, the primary action button remains reachable (e.g. fixed to the viewport) rather than requiring the user to dismiss the keyboard to reach it.

## Animal information patterns

Animal characteristics should be concise, scannable and meaningful for adoption decisions. Use badges or tags for species, size, age group, temperament, compatibility with children or other animals, and health or care considerations where appropriate.

Each tag must have understandable text. Icons can reinforce meaning but must not replace it. Information that requires nuance must appear with an explanation rather than relying on an ambiguous label.

## Feedback, empty and error states

Every relevant view must define:

- **Loading:** the system is retrieving or processing information.
- **Empty:** the request succeeded but there is no content to show.
- **Error:** the request failed; provide a safe explanation and recovery action where possible.
- **Success:** an important user action completed successfully.

Error messages must use plain language, avoid internal technical detail and retain the user's entered information whenever it is safe to do so.

## Perceived performance patterns

These patterns support the perceived-performance principles defined in Non Functional Requirements — Performance. They describe *how* a component should behave, complementing the component states already defined above.

- **Skeleton over blank:** any Loading state expected to take longer than roughly 300ms uses a Skeleton matching the eventual content's structure, never a blank area. This applies in particular to the animal catalogue and animal detail views.
- **Optimistic interactions:** low-risk, reversible, non-critical actions (e.g. a future favourite toggle) update their visual state immediately and reconcile with the server in the background; if the request fails, the control reverts to its previous state and an Alert/Toast explains the failure. This pattern must not be used for critical or hard-to-reverse actions (registration, login, adoption request submission), which use the standard Loading → Success/Error states instead.
- **Progressive disclosure of content, not just options:** consistent with the "Progressive disclosure" design principle above, views with a clear critical/secondary content split (e.g. animal detail vs. related recommendations) render the critical content first and let secondary content load in independently, rather than blocking the whole view.
- **Smooth, not abrupt, transitions:** state and content changes (e.g. a Skeleton being replaced by real content, a list appearing) use a brief transition (opacity/position) rather than an instant swap, to feel deliberate rather than jarring.

## Microcopy and tone of voice

Microcopy — button labels, error and success messages, empty states, helper text, placeholders — is small in size but has an outsized effect on how trustworthy and clear the platform feels, consistent with the "Trust and safety" and "Clarity over decoration" principles above. It complements the component states already defined (Loading, Empty, Error, Success): this section defines how their text is written, not just that they exist.

### Tone principles

- Human, not robotic: write as a person explaining something, not as a system reporting an internal state.
- Helpful, not judgmental: guide the user towards a fix rather than pointing out their mistake ("Email must include @", not "You entered an invalid email").
- Clear, not clever: prioritize immediate understanding over wordplay, especially for anything related to an animal's wellbeing or the adoption process.
- Concise: as short as possible without sacrificing clarity.

### Buttons and calls to action

- Buttons use a Verb + Noun pattern that names the outcome of clicking, not a generic label: "Submit a request" is a request; "Save profile", "Add to favourites" are outcomes. Avoid generic labels such as "Submit", "OK" or "Continue" with no object.
- The same generic action (e.g. confirming a dialog) uses different, context-specific copy depending on what it actually does in that screen.

### Error and success messages

- Error messages follow the same what's-wrong / how-to-fix structure defined under Validation timing above, and never expose technical detail (status codes, stack traces, internal exception names) to the user — consistent with the Form and validation guidelines and NFR's security requirements.
- Success messages are specific about what happened, not generic ("Adoption request sent" rather than "Success"), and state the next step where relevant (e.g. that the shelter will make contact).

### Empty states

- An empty state (e.g. no animals match the current filters, no adoption requests yet) uses positive, action-oriented framing and offers a concrete next step (e.g. a button to clear filters or browse the catalogue), rather than a bare statement of absence such as "No results".

### Using AI to draft microcopy

AI tools may be used to generate candidate microcopy (e.g. several phrasings for a button label or an empty state), but a human reviews and selects the final wording. AI-generated copy does not know YouPetMe's brand voice or business context on its own, so it is a drafting aid, not an autonomous source of shipped copy.

## Responsive behaviour

The MVP targets responsive web usage across desktop, tablet and mobile browsers.

| Viewport | Design expectation |
|---|---|
| Mobile | Single-column, touch-friendly controls and prioritised content. |
| Tablet | Flexible layouts that preserve reading order and task clarity. |
| Desktop | Wider layouts may use multiple columns without reducing readability. |

Responsive behaviour is not limited to widths. Content hierarchy, navigation, filters and form layouts must be reconsidered for smaller screens.

## Accessibility baseline

- Use semantic HTML before adding ARIA attributes.
- Ensure all interactive controls are reachable and operable by keyboard.
- Provide a visible focus indicator.
- Maintain sufficient contrast for text and interactive elements.
- Pair colour-based status with text, icons or another non-colour cue.
- Provide alternative text for meaningful images; decorative images should not add noise for screen readers.
- Use clear headings and logical reading order.
- Announce important asynchronous feedback appropriately.

Accessibility requirements are acceptance criteria, not a final visual review task.

## Open decisions

- Final primary, secondary and semantic colour palette.
- Typography family and scale.
- Logo, iconography and illustration style.
- Exact breakpoints and spacing scale.
- Visual treatment and calculation basis for AI Match Score.
- Final mobile navigation pattern.
- Future: whether to adopt Storybook (or an equivalent tool) to document and standardize component usage interactively, beyond this document's conceptual inventory. Not planned for the MVP; revisit if component reuse and cross-team communication needs grow.

Resolved: component styling and interactive-primitive foundation — Tailwind CSS for styling, Radix UI for accessible interactive primitives (see ADR-009). Components are implemented in-house, styled with Tailwind and, where an interactive pattern already has a Radix primitive, built on it rather than reimplemented from scratch. During development, components may be sourced from Tailwind/Radix-based registries such as 21st.dev as a starting point and then edited in place, since the resulting code composes directly with this foundation.

Until an item above is decided, implementation must follow these principles and avoid hard-coding provisional visual choices across features.

## Related documents

- Product Definition.
- MVP Scope.
- Authentication Flow.
- Authentication Wireframes.
- TS-IAM-001 — User Registration.
- ADR-009 — Styling and Accessible Component Foundation.
- ADR-011 — AI Assistant (Diango) Behaviour.
