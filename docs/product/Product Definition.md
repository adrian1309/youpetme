# Product Definition

## Product Name

YouPetMe

The name is provisional and may change during the project.

---

## Product Type

Web-based animal adoption platform.

The architecture will allow a future mobile application to consume the same backend API.

---

## Primary User

The primary user is a person interested in adopting an animal.

---

## Secondary Users

The platform may support several types of participants:

- Adopters
- Shelters
- Stores
- Veterinary clinics
- Caregivers
- Administrators

Not all user types will be implemented in the MVP.

---

## Value Proposition

YouPetMe aims to make animal adoption easier, more personalized and more engaging.

Instead of simply presenting a catalogue of animals, the platform will attempt to help users discover animals that may be compatible with their personality, lifestyle and circumstances.

---

## Differentiating Concept

The main differentiating concept is an AI-assisted matching experience.

Instead of requiring the user to manually select an animal, the system may ask the user about:

- Personality
- Lifestyle
- Preferences
- Experience with animals
- Living situation
- Availability
- Expectations

The AI can then recommend animals that may be compatible.

The experience should feel more personal and emotional than a conventional catalogue.

---

## Ecosystem

YouPetMe will act as an ecosystem rather than only an adoption catalogue.

Potential ecosystem participants include:

- YouPetMe shelter
- External shelters
- Pet stores
- Veterinary clinics
- Caregivers
- Adopters

---

## Adoption Model

### MVP: YouPetMe's own catalogue

For the MVP, YouPetMe does not operate a real physical shelter. The animals shown in the catalogue belong to a single internal catalogue ("the YouPetMe shelter") managed directly by the project's `ADMIN` role, who registers each animal manually.

The animal data and photos used for this catalogue must be either fictitious or used with explicit permission from their source. Real third-party animal data or photos must never be used without authorization, even for an academic demo.

The end-to-end adoption interaction for the MVP works as follows:

1. The `ADMIN` registers an animal manually through a form.
2. The animal appears in the public catalogue.
3. A user browses the catalogue and views the animal's detail page.
4. The user submits an **Adoption Request** for that animal through the platform, optionally with a free-text message explaining their interest. This request **is** the contact channel between the user and the shelter for the MVP — see Domain Model, `AdoptionRequest` — not a separate email or contact form.
5. The `ADMIN` reviews the request and either rejects it or approves it. Approving a request reserves the animal (see Domain Model, `Animal` status) and the `ADMIN` coordinates a meeting with the applicant outside the platform.
6. If the adoption proceeds after the meeting, the `ADMIN` manages the real-world process (paperwork, agreement) outside the platform's technical scope.
7. The `ADMIN` marks the request as completed, which updates the animal's status accordingly (see Domain Model, `AdoptionRequest` status meaning).

No automated workflow, contract generation or external notification is part of the MVP for this flow; the platform's role is limited to catalogue publication, discovery and the request itself as the contact point.

### Future: external shelters

Animals belonging to external shelters will be displayed through collaboration with those organizations. The final adoption process for an external animal will remain under the responsibility of the organization that owns or manages the animal.

YouPetMe will facilitate discovery and communication but will not replace the external shelter's responsibility. The chosen model, its rejected alternatives and the reasoning behind it are documented in **ADR-003 — External Shelter Adoption Model**.

---

## MVP Principle

The MVP must demonstrate the core value of the platform without attempting to implement the entire future ecosystem.

The MVP should prioritize:

1. User accounts
2. Animal catalogue
3. Animal search and filtering
4. Animal detail
5. Adoption request
6. Basic shelter management
7. Basic AI assistant
8. Initial AI matching concept
