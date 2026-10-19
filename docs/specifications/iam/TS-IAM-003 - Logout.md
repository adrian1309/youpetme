TS-IAM-003 — Logout

## Identificación

| Campo | Valor |
|---|---|
| Identificador | TS-IAM-003 |
| Historia relacionada | US-IAM-003 — Logout |
| Módulo | Identity and Access Management (IAM) |
| Prioridad | MVP / Alta |
| Estado | Ready for Development |
| ADR relacionado | ADR-002 — Authentication Strategy |

## Objetivo técnico

Permitir que un usuario autenticado cierre su sesión actual, revocando la sesión correspondiente en el servidor y limpiando el estado de autenticación en el cliente (ADR-002 — "Logout will revoke the relevant user session and remove client-side authentication state").

## Flujo funcional

```text
Authenticated user
  → Logout action
  → POST /auth/logout
  → RevokeSession use case
      → Identify current UserSession from the refresh token
      → Mark UserSession status as REVOKED
      → Publish SessionRevoked event
  → Client clears access token (memory) and refresh token (cookie)
  → Public/unauthenticated state
```

Logout revoca únicamente la sesión actual, no todas las sesiones del usuario (eso solo ocurre en un cambio de contraseña, per ADR-002).

## API

### `POST /auth/logout`

Revoca la sesión autenticada actual.

#### Request

Requiere una sesión autenticada válida (access token vigente); no necesita body — la sesión a revocar se identifica a partir del refresh token asociado (cookie `Secure`, `HttpOnly`, ADR-002).

#### Response exitosa — `204 No Content`

Sin cuerpo de respuesta.

#### Errores esperados

| Código | Caso | Respuesta esperada |
|---|---|---|
| `401 Unauthorized` | No hay sesión autenticada válida. | Error genérico. |
| `500 Internal Server Error` | Error inesperado. | Error genérico; no revelar detalles internos. |

## Modelo de datos

No se introduce ninguna entidad nueva. Se actualiza el `status` de la `UserSession` correspondiente a `REVOKED` (Domain Model, ADR-002).

## Frontend

Cualquier vista autenticada expondrá una acción de "Cerrar sesión":

- Llama a `POST /auth/logout`.
- Independientemente de la respuesta del servidor, limpia el estado de autenticación en cliente (access token en memoria) para no dejar al usuario en un estado inconsistente si la petición de red falla.
- Redirige a una vista pública (p. ej. Home o `/login`).

## Evento de dominio

Al completar correctamente la revocación se publica `SessionRevoked`, con `sessionId`, `userId` y `occurredAt`. Sin datos sensibles.

## Testing

### Unit tests
- El use case marca la sesión correcta como `REVOKED` y ninguna otra sesión del mismo usuario.

### Integration tests
- Endpoint `POST /auth/logout` con PostgreSQL (Testcontainers): la sesión queda `REVOKED` en base de datos tras la llamada.
- Una petición autenticada posterior con el refresh token ya revocado es rechazada.

### End-to-end tests
- Logout completo desde una vista autenticada hasta quedar en estado público.

## Definition of Done

- [ ] Un usuario autenticado puede cerrar sesión desde cualquier vista autenticada.
- [ ] La `UserSession` correspondiente queda `REVOKED` en base de datos.
- [ ] El estado de autenticación en cliente se limpia siempre, incluso si la petición de red falla.
- [ ] Se publica `SessionRevoked` sin datos sensibles.
- [ ] Un refresh token ya revocado no permite obtener nuevos access tokens.
- [ ] Las pruebas unitarias, de integración y E2E definidas pasan.

## Referencias

- US-IAM-003 — Logout
- ADR-002 — Authentication Strategy
