TS-IAM-004 — Password Recovery

## Identificación

| Campo | Valor |
|---|---|
| Identificador | TS-IAM-004 |
| Historia relacionada | US-IAM-004 — Password Recovery |
| Módulo | Identity and Access Management (IAM) |
| Prioridad | MVP / Alta |
| Estado | Ready for Development |
| ADR relacionado | ADR-002 — Authentication Strategy, ADR-014 — Transactional Email Delivery |

## Envío de email

El envío del email con el enlace de reseteo usa **Resend**, detrás del puerto `EmailSender` (**ADR-014 — Transactional Email Delivery**). El caso de uso `RequestPasswordReset` depende únicamente del puerto, nunca de Resend directamente — mismo patrón hexagonal que `UserRepository`/`PrismaUserRepository`. En desarrollo local y en tests, se usa un adaptador distinto (consola/log o in-memory) en vez de enviar correos reales, según define ADR-014.

## Objetivo técnico

Permitir que un visitante que ha olvidado su contraseña la restablezca de forma segura, mediante un token de un solo uso y con expiración, enviado por email.

## Flujo funcional

```text
Login
  → Forgot password
  → Enter email
  → POST /auth/password-reset/request
  → RequestPasswordReset use case
      → Normalize email
      → Find user by email (without revealing existence)
      → Generate reset token; persist only its hash (PasswordResetToken)
      → Send email with the plaintext token/link via the EmailSender port (Resend, ADR-014)
  → 202 Accepted (always, regardless of whether the email exists)
  → User clicks the email link
  → Reset password
  → POST /auth/password-reset/confirm
  → ResetPassword use case
      → Validate token (exists, ACTIVE, not expired)
      → Validate new password against the policy (ADR-002)
      → Hash and persist the new password
      → Mark PasswordResetToken as USED
      → Revoke all existing UserSessions for this user (ADR-002 — Password Changes)
      → Publish PasswordReset event
  → Login
```

## API

### `POST /auth/password-reset/request`

Ruta completa bajo el prefijo de la API: `POST /api/v1/auth/password-reset/request`.

Solicita el envío de un email de recuperación.

#### Request body

```json
{ "email": "john@example.com" }
```

#### Reglas de entrada

| Campo | Reglas |
|---|---|
| `email` | Obligatorio; formato de correo válido; se normaliza. |

#### Response — `202 Accepted`

Siempre se responde `202 Accepted`, **exista o no una cuenta con ese email**, para no revelar qué correos están registrados (misma lógica de seguridad que el `401` genérico de TS-IAM-002).

```json
{ "message": "If an account exists for this email, a reset link has been sent." }
```

### `POST /auth/password-reset/confirm`

Ruta completa bajo el prefijo de la API: `POST /api/v1/auth/password-reset/confirm`.

Confirma el reseteo con el token recibido por email.

#### Request body

```json
{
  "token": "<reset-token>",
  "password": "my-new-passphrase",
  "confirmPassword": "my-new-passphrase"
}
```

#### Reglas de entrada

| Campo | Reglas |
|---|---|
| `token` | Obligatorio. |
| `password` | Obligatorio; misma política que registro (ADR-002 — mínimo 8 caracteres). |
| `confirmPassword` | Obligatorio; debe coincidir con `password`; no se persiste, igual que en TS-IAM-001. |

#### Response exitosa — `200 OK`

```json
{ "message": "Password has been reset successfully." }
```

#### Errores esperados

| Código | Caso | Respuesta esperada |
|---|---|---|
| `400 Bad Request` | Datos ausentes/inválidos, contraseñas no coinciden, contraseña no cumple la política. | Error estructurado por campo. |
| `400 Bad Request` | Token inexistente, ya `USED`, o `EXPIRED`. | Mensaje de negocio genérico ("this reset link is no longer valid"), sin distinguir el motivo exacto. |
| `500 Internal Server Error` | Error inesperado. | Error genérico. |

## Modelo de datos

Usa la nueva entidad `PasswordResetToken` (Domain Model, añadida junto con esta especificación). `tokenHash` sigue el mismo principio que `UserSession.refreshTokenHash`: el token en texto plano nunca se persiste, solo su hash.

## Reglas de seguridad y expiración

- El token expira a las **2 horas** de su creación (valor de partida razonable; revisar si se define una política de expiración distinta).
- Un token solo puede usarse una vez (`status: USED` tras consumirse).
- Al resetear la contraseña, se revocan **todas** las sesiones activas del usuario (ADR-002), no solo la actual.
- La solicitud (`/request`) no debe permitir enumerar cuentas por temporización tampoco: el tiempo de respuesta debe ser similar exista o no la cuenta (evitar timing attacks triviales).

## Frontend

- `/forgot-password`: formulario con `email`, envía la solicitud y muestra siempre el mismo mensaje de confirmación.
- `/reset-password?token=...`: formulario con `password` y `confirmPassword`; si el token es inválido/expirado al cargar la página o al enviar, muestra un error genérico con enlace para solicitar uno nuevo.

## Evento de dominio

Al completar correctamente el reseteo se publica `PasswordReset`, con `userId`, `occurredAt`. Sin datos sensibles (nunca el token ni la contraseña).

## Testing

### Unit tests
- Generación y hash del token.
- Validación de token: activo, expirado, ya usado.
- La respuesta de `/request` es idéntica exista o no la cuenta.

### Integration tests
- Endpoint completo con PostgreSQL (Testcontainers): creación del token, consumo, expiración.
- Todas las `UserSession`s del usuario quedan `REVOKED` tras un reset exitoso.

### End-to-end tests
- Flujo completo simulando la recepción del token (sin depender de un proveedor de email real en el entorno de test — inyectar el token directamente en el test).

## Definition of Done

- [ ] Un usuario puede solicitar y completar un reseteo de contraseña con un token válido.
- [ ] La respuesta de `/request` no revela si el email existe.
- [ ] Un token expirado o ya usado es rechazado con un mensaje genérico.
- [ ] Todas las sesiones del usuario se revocan tras un reset exitoso.
- [ ] `confirmPassword` se valida y nunca se persiste.
- [ ] Se publica `PasswordReset` sin datos sensibles.
- [ ] Las pruebas unitarias, de integración y E2E definidas pasan.

## Referencias

- US-IAM-004 — Password Recovery
- ADR-002 — Authentication Strategy
- ADR-014 — Transactional Email Delivery
- TS-IAM-001 — User Registration
