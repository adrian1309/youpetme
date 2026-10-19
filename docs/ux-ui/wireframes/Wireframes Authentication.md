# Authentication Wireframes

## Registration

### Desktop

```text
Create your account

First name              Last name
[____________]          [____________]

Email
[____________________________]

Password
[________________________ 👁]

Confirm password
[________________________ 👁]

☐ I agree to the Terms of Service
  and Privacy Policy.

[ Create account ]

Already have an account?

Login
```

---

### Mobile

```text
Create your account

First name
[________________________]

Last name
[________________________]

Email
[________________________]

Password
[________________________ 👁]

Confirm password
[________________________ 👁]

☐ I agree to the Terms of Service
  and Privacy Policy.

[ Create account ]

Already have an account?

Login
```

---

## Registration Data

Required:

- First name
- Last name
- Email
- Password
- Password confirmation
- Terms acceptance

The password confirmation is used only for validation and must not be persisted.

---

## Data Not Collected During Registration

The following information belongs to the user profile or adoption profile:

- Phone
- Address
- Housing type
- Children
- Existing pets
- Experience with animals
- Adoption preferences
- Lifestyle
- Other matching information

This follows a data minimization principle.

---

## UI States

Inputs:

- Default
- Focus
- Error
- Disabled

Button:

- Default
- Loading
- Disabled

Form:

- Success
- Validation error
- Server error
