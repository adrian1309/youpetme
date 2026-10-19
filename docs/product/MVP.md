# MVP

## Objective

The MVP must demonstrate the core value of YouPetMe while remaining achievable within the TFM scope.

---

## Included

### Identity

- Registration
- Login
- Logout
- Password recovery
- Basic user profile

### Animals

- Animal catalogue
- Search
- Filtering
- Animal detail
- Animal characteristics
- Photos

### Adoption

- Adoption form
- Adoption request
- Request status

### Shelters

- YouPetMe shelter: a single internal catalogue managed by the `ADMIN` role. There is no `SHELTER_MANAGER` account and no external shelter onboarding in the MVP (see Product Definition — Adoption Model).
- Basic animal management: `ADMIN` registers each animal manually, one at a time, through a form. Bulk import and external system integration remain future functionality.
- The `ADMIN` is also responsible for manually updating an animal's status once an adoption is completed offline (see Product Definition — Adoption Model, MVP flow).

### AI

- Basic AI assistant
- Initial AI matching experience

---

## Excluded from MVP

The following are documented but should not block the MVP:

- Mobile application
- External shelter database synchronization
- External shelter accounts (`SHELTER_MANAGER` role) and their own inventory management
- Veterinary marketplace
- Store marketplace
- Temporary pet care
- Social network
- Advanced avatar system
- Virtual pet environment
- Advanced AI matching
- Voice assistant
- Social login
- MFA

---

## Rule

A future feature must not enter the MVP only because it is technically interesting.

It must provide significant value to the core product and fit within the project scope.
