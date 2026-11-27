# YouPetMe Design System

## Status

**Version:** 0.2 — MVP visual identity  
**Status:** Provisional design baseline for the MVP  
**Last reviewed:** 2026-11-27

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

The MVP visual identity is "warm and close" (SCRUM-56): a raspberry primary colour on a warm cream page, white surfaces, soft rounded shapes (cards with a 16 px radius, pill-shaped controls and tags) and line icons. Typography, logo and illustration style remain open decisions.

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

### MVP token values

The "warm and close" palette lives only in the web app's global stylesheet (`@theme` in `global.css`); components consume the tokens and never hard-code colours. `tokens.spec.ts` checks the contrast of every text and background pair listed here.

| Token | Value | Use |
|---|---|---|
| `page` | `#fbf3ec` | Page background (warm cream). |
| `surface` | `#ffffff` | Cards, header, footer, dialogs. |
| `border-subtle` | `#ecdfd6` | Decorative borders of cards and the header line only (1.3:1 on white, so never the only cue for a control). |
| `brand-primary` | `#b0215c` | Primary actions, links, active states. |
| `accent-soft` / `on-accent-soft` | `#f7e3ea` / `#8a1848` | Soft raspberry backgrounds, hover and active navigation pill, Diango's bubbles. |
| `accent-warm` / `on-accent-warm` | `#fbe0b8` / `#6b4208` | Warm secondary accent, pending status, decorative shapes. |
| `success-soft`, `error-soft`, `neutral-soft` | `#e2f2e7`, `#fce4e7`, `#efe9ec` | Soft backgrounds of status badges, with a green, red or secondary text colour. |
| `text` / `text-muted` | `#2a1a20` / `#5b4650` | Body text and supporting text. |
| Radii | card 16 px, pill 999 px | Cards and dialogs; buttons, tags and inputs of choice. |
| Shadow | `soft` | A very soft elevation; used sparingly. |

Form fields keep a darker border (`#7a6f73`, 4.83:1 on white) because it identifies the control. Verified contrast: `text` on `page` 15.1:1, `text-muted` on `page` 7.85:1, `brand-primary` on `page` 5.95:1, white on `brand-primary` 6.53:1, `on-accent-soft` on `accent-soft` 7.43:1, `on-accent-warm` on `accent-warm` 6.83:1, and the status badge text colours on `success-soft` 5.63:1, `error-soft` 6.07:1 and `neutral-soft` 7.20:1.

### Iconography

The MVP uses `lucide-react`, pinned to an exact version, importing each icon by name. Icons are decorative (`aria-hidden`) and never replace text. A button that has only an icon has an accessible name (for example "Cerrar chat" or "Enviar mensaje"). Status and compatibility are never conveyed by an icon or colour alone: they always come with text.

### Buttons and links

- **Primary:** raspberry fill with white text. **Secondary:** raspberry border on a white fill. Both are pill-shaped and at least 44 px high.
- **Large** (`size="lg"`): at least 56 px high, `text-lg` and wide horizontal padding. It is used only for the main actions of public screens (home, "Buscar", "Solicitar adopción", "Encontrar mi compañero"); the header and secondary actions keep the normal size.
- A button that looks like a link is a pill button; "Reintentar" and "Cerrar" are never underlined text.
- **No link is underlined.** Content links are bold and in the brand colour, so they do not depend on colour alone (WCAG 1.4.1); navigation links show an `accent-soft` pill on hover and on the active route (`aria-current="page"`). Keyboard focus always shows a ring of 3 px.

## Layout and navigation

### Layout primitives

- **Container:** constrains readable content width and page alignment.
- **Section:** separates meaningful page regions vertically.
- **Grid:** arranges responsive groups of cards, controls or content.
- **Stack:** arranges related elements in a vertical rhythm.

### Navigation

Use a primary navigation bar for global destinations and contextual navigation only where a section contains multiple related views. On mobile, a "Menú" button with `aria-expanded` reveals the same list of links.

Navigation must expose the current location and remain usable by keyboard and assistive technology.

The header is white, full width, at least 76 px high and has a single thin line below. It holds the logo with a paw icon, the links at 18 px and, on the right, "Entrar" (secondary) and "Registrarse" (primary). When signed in it shows an avatar with the initial, the greeting and "Cerrar sesión" with an icon. An ADMIN sees "Panel" instead of "Solicitudes". The footer is simple: the name and a short phrase. Page content is centred with a maximum width of 6xl and equal margins on both sides.

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

In the MVP, Diango's welcome is a modal dialog: an `accent-soft` card with a thin raspberry border, a 16 px radius, the title in `on-accent-soft`, a small speech-bubble tail pointing to a large Diango, a translucent raspberry backdrop (not grey) and an "Entendido" button with a check icon. Focus is trapped on that button and Escape closes it. The chat is a non-modal panel opened from a fixed button at the bottom right. Its header shows a small Diango, the name and a status line, and an icon-only "Cerrar chat" button. The user's bubbles are raspberry and aligned to the right; Diango's are `accent-soft` and aligned to the left; the conversation is a live log that scrolls to the last message. The input is a pill with a round "Enviar mensaje" button, which cannot be used without text or while sending. While Diango answers, "Diango está pensando…" appears with three animated dots in a polite live region that announces it once. The error is recoverable with "Reintentar". On mobile the panel takes almost the whole screen. The tail-wag, the bounce and the dots are CSS and are disabled under `prefers-reduced-motion`. In the MVP, the Recommendation Card of AI Matching is the catalogue card with a fit label and a "Por qué encaja" list.

The AI Matching page ("Encuentra tu compañero") has a centred header with a large Diango, a title ("Cuéntale a Diango cómo eres") and four short hints with icons. The text area sits in a card with a `0/1000` counter, followed by example chips that append their text without exceeding the limit, and a large primary button. While it waits, a status region (`role="status"`, `aria-live="polite"`) announces "Buscando tu compañero" once; a bouncing Diango, a rotating message hidden from screen readers and three skeleton cards are shown, and the button shows a spinning icon and is disabled. With reduced motion nothing moves and the message stays fixed. The results appear under "Tus mejores matches" with the cards described above.

The home page has a hero with `accent-soft` and `accent-warm` shapes and faint paws (decorative), an `h1` and two large buttons ("Ver animales" and "Encuentra tu compañero"), followed by "Cómo funciona" (three cards), "Algunos de nuestros amigos" (up to three available animals, hidden if there are none or the request fails) and a final band with the same buttons. A signed-in user sees "Hola, {name}" with the buttons; an ADMIN sees "Ir al panel" and "Ver animales".

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

- Validate a field on `blur` (when the user leaves it), not on every `onChange` keystroke — per-keystroke validation shows errors while the user is still typing, which reads as overly aggressive. Once an error is shown, clear it as soon as the user re-focuses the field, so a stale error is not shown while they are actively correcting it. If the field is left by pressing the pointer or tapping another control, its error is shown once the pointer is released and the click has been delivered (at most one second later), so the layout never moves under a click in progress.
- A full-form validation also runs on submit, to catch anything not yet touched (e.g. a field the user skipped entirely).
- Error messages follow a consistent structure: what is wrong, and how to fix it (e.g. "Password must be at least 8 characters" rather than "Invalid password"). Tone is helpful, not blaming ("must be", not "you entered").

### Input types and mobile keyboards

- Use the semantically correct HTML input type for each field (`email`, `tel`, `date`, `number`, `url`), not a generic `text` input, so mobile devices show the matching keyboard (e.g. `email` shows the `@` key, `tel` shows a numeric keypad).
- Input width should roughly match the expected content length (e.g. a postal code field narrower than a street address field) so the user can anticipate what is expected.

### Autofill and required fields

- Forms and their inputs set the appropriate `autocomplete` value (e.g. `name`, `email`, `tel`, `street-address`) so the browser's autofill can complete them correctly, reducing user effort.
- When most fields in a form are required, mark the exceptions ("optional") instead of marking every required field, to reduce visual noise.

### Password fields

- Provide a visible show/hide toggle for password fields; do not hide the value with no way to reveal it. It is an icon-only button (eye / eye-off, decorative) named "Mostrar contraseña" / "Ocultar contraseña" with `aria-pressed`. It is 36 px high inside the field and its focus ring is drawn inward, so it never overflows the field border.
- Do not disable paste on password fields — this breaks compatibility with password managers.
- Where a password policy applies (see TS-IAM-001), show its requirements near the field and indicate which are already met as the user types.

### Mobile form considerations

- Touch targets (buttons, inputs) are at least 44x44px.
- Input `font-size` is at least 16px, to avoid iOS Safari automatically zooming in when a field receives focus.
- Forms use a single-column layout on mobile viewports, consistent with the Responsive behaviour table above.
- On a long form displayed with the keyboard open, the primary action button remains reachable (e.g. fixed to the viewport) rather than requiring the user to dismiss the keyboard to reach it.

## Animal information patterns

Animal characteristics should be concise, scannable and meaningful for adoption decisions. Use badges or tags for species, size, age group, temperament, compatibility with children or other animals, and health or care considerations where appropriate.

Each tag must have understandable text. Icons can reinforce meaning but must not replace it. Information that requires nuance must appear with an explanation rather than relying on an ambiguous label. Unknown compatibility is shown explicitly (for example, "Con niños: no se sabe") in the animal detail and omitted from catalogue cards, so that "unknown" is never read as "no".

### Animal photo

`AnimalPhoto` shows the image with `object-cover`. If there is no photo or it fails to load, it shows a fallback on `accent-soft` with a large paw and the animal's name, never the browser's broken-image icon. With an empty `alt`, the fallback is decorative.

### Animal card

A white card with a 16 px radius. The photo is 4:3 with a gentle zoom on hover (only without `prefers-reduced-motion`) and a pill with the species icon (dog, cat or paw) and its text. Below: the name at 20 px, size and age with an icon, at most two character tags and the compatibility icons with text for screen readers. The whole card is one stretched link named with the animal's name; "Conócelo" is visual only, so there is no second link. In the catalogue and in the AI Matching results the card is the same.

### Catalogue filters

The catalogue shows a white filter card with four groups: Especie, Tamaño, Edad and "Otros". Each single-choice group is a `fieldset` with a `legend` and an icon, and its options are pills built on visually hidden radios, with an "Todos" option. "Otros" holds "Bien con niños" and "Bien con otros animales" as checkbox pills. The chosen option is shown with a raspberry fill and a check, and a focus ring on the pill; an error is shown with a red border and a message linked with `aria-describedby`. Filters are not applied until "Buscar" is pressed; "Quitar filtros" clears them. The same pill components are used by the animal registration form and the request status filter. The groups are laid out in one column on mobile, 2x2 on tablet and four columns on large screens.

### Animal detail

On wide screens the detail has two columns. On the left, the main photo and, if there are several (up to 5), thumbnails that are buttons named "Ver foto N de {name}" with `aria-pressed`. On the right: the name, the breed as a subtitle, the tags, "Carácter", "Convivencia" (a check, a warning or a question icon, always with text) and "Salud y cuidados" in its own card when present. The adoption action is at the bottom of the data column, in a "¿Te lo llevas a casa?" card, not at the top of the page. "Volver al catálogo" is a secondary button with an arrow at the top.

### Empty states of the catalogue

An empty state is a centred card with a large icon in an `accent-soft` circle. "Todavía no hay animales publicados" appears only when no filter is applied; "Ningún animal encaja con tu búsqueda" appears only when filters are applied and includes "Quitar filtros". The choice depends on the filters applied in the URL, not on the draft selection of the pills.

## Adoption request patterns

The "Solicitar adopción" action is shown only for an `AVAILABLE` animal and never to an ADMIN, who manages requests instead (the API is unchanged). It opens a modal dialog (native `<dialog>`), named by its title "Solicitar la adopción de {name}", with the animal's small photo, an optional message (up to 1000 characters, with a visible `0/1000` counter) and "Enviar solicitud" / "Cancelar". Focus is trapped, Escape or "Cancelar" closes it and focus returns to the button. Success is confirmed with a message (`role="status"`): "¡Solicitud enviada! El refugio se pondrá en contacto contigo", and the button becomes "Solicitud enviada" with `aria-disabled`. A duplicate request is reported with an Alert ("Ya tienes una solicitud activa para este animal."). A visitor who presses the action is taken to the login page and returned to the animal page after signing in.

An ADMIN lands on the administration panel (`/admin`) after signing in, unless they came from another page. The panel has two cards of equal weight: "Registrar animal" and "Solicitudes de adopción", the latter with the number of pending requests (read from the filtered list; if it cannot be read, the card shows no number). The header link is "Panel". The animal registration form is a centred card with three titled blocks ("Datos básicos", "Foto y raza" and "Carácter y convivencia"); species, size, age and compatibility (Sí / No / No se sabe) are radio pills, character traits are checkbox pills, and a valid https photo URL shows a preview with `AnimalPhoto`.

In the admin requests list, a header shows an icon, the title and the count, and the status filter is a group of pills ("Todas" plus the five statuses). Each request is a white card with a 16 px radius: the animal's name as a link, a status badge, an avatar with the applicant's initial (decorative), the name and email, the dates with icons and the message as a quote. Only the actions valid for its status are shown as buttons with an icon (Aprobar is primary, Rechazar has a danger tone, Completar adopción is primary and Cancelar aprobación is secondary), and each accessible name includes the applicant and the animal. With no requests, the empty state says "Aún no hay solicitudes".

The status badge is a pill with an icon, a colour and the text "Estado: X"; the text carries the meaning. Pendiente: clock on `accent-warm`. Aprobada: check-circle on `success-soft`. Rechazada: x-circle on `error-soft`. Completada: double check on `accent-soft`. Cancelada: ban on `neutral-soft`. Every action ends with a Notice (`role="status"`) or an Alert (`role="alert"`). They can receive focus by code so that they are read, but they draw no focus ring: their own border marks them, so there is never a double border.

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

- Typography family and scale.
- Logo and illustration style.
- Exact breakpoints and spacing scale.
- Visual treatment and calculation basis for AI Match Score.
- Future: whether to adopt Storybook (or an equivalent tool) to document and standardize component usage interactively, beyond this document's conceptual inventory. Not planned for the MVP; revisit if component reuse and cross-team communication needs grow.

Resolved for the MVP (SCRUM-56): the colour palette and semantic tokens, iconography (`lucide-react`) and the mobile navigation pattern (see MVP token values, Iconography and Layout and navigation).

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
