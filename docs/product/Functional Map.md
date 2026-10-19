# Functional Map

## 1. Authentication & Identity

- Register
- Login
- Logout
- Password recovery
- User profile

Future:

- Email verification
- Social login
- MFA

---

## 2. Animals

- Browse animals
- Search animals
- Filter animals
- View animal details
- View animal photos
- View animal characteristics
- View animal shelter

Future:

- View animal videos
- Advanced animal profiles
- AI-generated avatars
- Animal personality profiles
- Favourites: available to GUEST users, stored client-side (browser localStorage); if the guest registers, favourites are persisted server-side against their account
- Notes on animals (free text to document interest and compare before deciding): available only to authenticated USERS, persisted server-side

---

## 3. Adoption

- Start adoption process
- Complete adoption form
- Submit adoption request
- View adoption request status

Future:

- Adoption tracking
- Digital documentation
- Shelter communication
- Adoption history

---

## 4. AI Matching

- Collect adopter information
- Analyse preferences
- Recommend animals
- Explain recommendation

Future:

- Advanced compatibility model
- Multiple-animal compatibility
- Household compatibility
- Interactive matching experience

---

## 5. AI Assistant

- Answer questions about the platform
- Explain adoption processes
- Help users navigate the platform
- Provide information about animals
- One-time welcome introduction on first visit (see ADR-011)

Future:

- Personalized assistant
- Voice interaction
- Proactive assistance
- Context-aware recommendations
- Choice of mascot: letting the user pick between different mascot animals/breeds to represent the assistant, instead of the single fixed MVP mascot (Diango, a black Labrador — see Design System, AI-assisted experiences)
- Persistent cross-session memory and context learned from past interaction history (see ADR-011)
- Versioned update announcements, extending the welcome trigger beyond first-visit only (see ADR-011)

---

## 6. Shelters

- Shelter profile
- Animal management
- Animal availability
- Adoption management

Future:

- Shelter registration (external shelters)
- External database/API integration
- Automated synchronization
- Shelter analytics
- External shelter accounts (`SHELTER_MANAGER` role) managing their own animal inventory
- Reactive moderation: published animals are not pre-approved; an admin reviews a listing only if it is reported

---

## 7. Stores

Future functionality:

- Store profiles
- Product catalogue
- Discounts
- Promotions
- Special offers for animals

---

## 8. Veterinary Clinics

Future functionality:

- Veterinary profiles
- Location
- Services
- External website
- Promotional information

---

## 9. Social

Future functionality:

- Adoption posts
- Success stories
- Photos
- Videos
- Comments
- Adoption statistics

---

## 10. Temporary Pet Care

Future functionality:

- Caregiver profiles
- Availability
- Pet care requests
- Matching
- Booking

---

## 11. Administration

- User management
- Animal management
- Shelter management
- Content moderation
- Platform configuration

---

## 12. AI-generated Animal Avatars

Future functionality:

- Generate animal avatar
- Create adopted-animal collection
- Visualize multiple animals together
- Create virtual environments
