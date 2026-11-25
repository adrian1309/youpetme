TS-IAM-004 — Password Recovery

## Identificación

| Campo | Valor |
|---|---|
| Identificador | TS-IAM-004 |
| Historia relacionada | US-IAM-004 — Password Recovery |
| Módulo | Identity and Access Management (IAM) |
| Prioridad | MVP / Alta |
| Estado | Ready for Development |
| ADR relacionado | ADR-002 — Authentication Strategy, ADR-014 — Transactional Email Delivery, ADR-016 — Domain Event Delivery, ADR-017 — API Error Format |

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
      → Ignore the request if the account is not ACTIVE, or if it already has a link created less than a minute ago
      → Generate reset token; persist only its hash (PasswordResetToken)
      → Supersede the user's previous ACTIVE tokens
      → Send email with the plaintext token/link via the EmailSender port (Resend, ADR-014), after responding and without blocking the response; a delivery failure is logged and the response stays 202
  → 202 Accepted (always, regardless of whether the email exists)
  → User clicks the email link
  → Reset password
  → POST /auth/password-reset/confirm
  → ResetPassword use case
      → Validate token (exists, ACTIVE, not expired, and its account is ACTIVE)
      → Validate new password against the policy (ADR-002)
      → Hash and persist the new password
      → Mark PasswordResetToken as USED and supersede the user's other ACTIVE tokens
      → Revoke all existing UserSessions for this user (ADR-002 — Password Changes)
      → Publish PasswordReset event after the transaction commits (ADR-016)
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
| `password` | Obligatorio; misma política que registro (ADR-002 — mínimo 8 y máximo 128 caracteres). |
| `confirmPassword` | Obligatorio; debe coincidir con `password`; no se persiste, igual que en TS-IAM-001. |

#### Response exitosa — `200 OK`

```json
{ "message": "Password has been reset successfully." }
```

#### Errores esperados

| Código | Caso | Respuesta esperada |
|---|---|---|
| `400 Bad Request` | Datos ausentes/inválidos, contraseñas no coinciden, contraseña no cumple la política. | Error con `details` por campo (ADR-017): `REQUIRED`, `INVALID_FORMAT`, `INVALID_TYPE`, `TOO_SHORT`, `TOO_LONG`, `MISMATCH`. |
| `400 Bad Request` | Token inexistente, ya `USED`, `EXPIRED`, sustituido por un enlace posterior (`SUPERSEDED`), o cuenta que ya no está `ACTIVE`. | Mensaje de negocio genérico ("this reset link is no longer valid") con `code` `RESET_TOKEN_INVALID` (ADR-017), sin distinguir el motivo exacto. |
| `403 Forbidden` | La petición trae una cabecera `Origin` distinta de `WEB_ORIGIN` (guarda de ADR-002; aplica a los dos endpoints). | Error genérico, sin `code`. |
| `415 Unsupported Media Type` | La petición trae un `Content-Type` que no es `application/json` (guarda de ADR-002). | Error genérico, sin `code`. |
| `500 Internal Server Error` | Error inesperado. | Error genérico. |

## Modelo de datos

Usa la nueva entidad `PasswordResetToken` (Domain Model, añadida junto con esta especificación). `tokenHash` sigue el mismo principio que `UserSession.refreshTokenHash`: el token en texto plano nunca se persiste, solo su hash.

## Reglas de seguridad y expiración

- El token expira a las **2 horas** de su creación, configurable con `PASSWORD_RESET_EXPIRATION` (2h por defecto).
- Un token solo puede usarse una vez (`status: USED` tras consumirse).
- Al resetear la contraseña, se revocan **todas** las sesiones activas del usuario (ADR-002), no solo la actual.
- La solicitud (`/request`) no debe permitir enumerar cuentas por temporización tampoco: el tiempo de respuesta debe ser similar exista o no la cuenta (evitar timing attacks triviales). Por eso el correo se envía después de responder.
- Cada solicitud nueva sustituye (`SUPERSEDED`) los enlaces `ACTIVE` anteriores del usuario: solo vale el último.
- Si la cuenta ya tiene un enlace creado hace menos de un minuto, no se crea otro ni se envía otro correo, y la respuesta es el mismo `202`.
- Una cuenta que no está `ACTIVE` no recibe enlace; la respuesta es el mismo `202`.

## Frontend

- `/forgot-password`: formulario con `email`, envía la solicitud y muestra siempre el mismo mensaje de confirmación: «Si hay una cuenta con ese email, te hemos enviado un enlace. Caduca en 2 horas. Si no lo ves en unos minutos, revisa la carpeta de spam o vuelve a intentarlo.» Con sesión iniciada redirige a `/`.
- `/reset-password?token=...`: formulario con `password` y `confirmPassword`. Al cargar, el token pasa de la URL a `history.state` (la barra queda en `/reset-password`) y la página usa `referrer` `no-referrer`. Si el token es inválido o ha caducado, el error se conoce al enviar, porque no hay endpoint de validación previa; si falta el token, se sabe al cargar. En ambos casos se muestra un error genérico con enlace para solicitar uno nuevo.
- Tras el éxito no se inicia sesión: si había una, se cierra, y se redirige a `/login` con un aviso de contraseña actualizada.

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
- Flujo completo: el test lee el enlace del correo capturado por el adaptador de archivo (`EMAIL_DELIVERY=file`), que la configuración rechaza en producción. No depende de un proveedor de email real.

## Limitaciones

- No hay límite por IP: solo el enfriamiento de un correo por minuto y por cuenta.
- Cualquiera que conozca el email de otra persona puede invalidar su enlace pendiente, pidiendo uno nuevo, y hacer que reciba como máximo un correo por minuto.
- La primera petición `GET /reset-password?token=...` llega al servidor que sirve la web y puede quedar en sus logs de acceso. Se mitiga con la caducidad de 2 horas y el uso único.
- El token queda en el historial de esa pestaña (`history.state`) hasta que se cierra.
- Si el proceso se detiene entre la respuesta `202` y el envío, el correo se pierde; el usuario puede pedirlo de nuevo.
- Los access tokens ya emitidos siguen siendo válidos hasta 15 minutos tras el reseteo (ADR-002 — Access Token Guard).

## Definition of Done

- [x] Un usuario puede solicitar y completar un reseteo de contraseña con un token válido.
- [x] La respuesta de `/request` no revela si el email existe.
- [x] Un token expirado o ya usado es rechazado con un mensaje genérico.
- [x] Todas las sesiones del usuario se revocan tras un reset exitoso.
- [x] `confirmPassword` se valida y nunca se persiste.
- [x] Se publica `PasswordReset` sin datos sensibles.
- [x] Las pruebas unitarias, de integración y E2E definidas pasan.

## Referencias

- US-IAM-004 — Password Recovery
- ADR-002 — Authentication Strategy
- ADR-014 — Transactional Email Delivery
- ADR-016 — Domain Event Delivery
- ADR-017 — API Error Format
- TS-IAM-001 — User Registration
