# Authentication Flow

## Objective

Define the user journey for account registration, login and password recovery.

---

## Actors

- Visitor
- Authenticated User

---

## Main Flow

```text
Visitor
    ↓
Home
    ↓
Register / Login
```

---

## Registration

```text
Visitor
    ↓
Register
    ↓
Client validation
    ↓
API
    ↓
Server validation
    ↓
Create account
    ↓
Authenticate
    ↓
Authenticated Home
```

---

## Login

```text
Visitor
    ↓
Login
    ↓
Client validation
    ↓
API
    ↓
Credentials validation
    ↓
Authentication
    ↓
Authenticated Home
```

---

## Password Recovery

```text
Login
    ↓
Forgot password
    ↓
Enter email
    ↓
Request reset
    ↓
Email
    ↓
Reset password
    ↓
Login
```

---

## Error States

The system must handle:

- Invalid form data
- Invalid email
- Password mismatch
- Invalid credentials
- Network errors
- Server errors
- Authentication errors

---

## Future Considerations

- Email verification
- Social login
- MFA
- Passwordless authentication
