# TS-IAM-003 — Logout

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
  → Logout action (header)
  → POST /api/v1/auth/logout
  → Access token guard (stateless: verifies the JWT, ADR-002)
  → RevokeSession use case
      → Identify current UserSession from the refresh token cookie
      → Check the session belongs to the user of the access token
      → Mark UserSession status as REVOKED
      → Publish SessionRevoked event
  → Server clears the refresh token cookie
  → Client clears the access token (memory) and notifies the other tabs
  → Public/unauthenticated state
```

Logout revoca únicamente la sesión actual, no todas las sesiones del usuario (eso solo ocurre en un cambio de contraseña, per ADR-002).

## API

### `POST /auth/logout`

Ruta completa bajo el prefijo de la API: `POST /api/v1/auth/logout`.

Revoca la sesión autenticada actual.

#### Request

Requiere un access token vigente; no necesita body. La sesión a revocar se identifica a partir del refresh token de la cookie `Secure`, `HttpOnly` (ADR-002). La guarda de `Origin` y de `Content-Type` de ADR-002 (Cookie and CSRF Policy) se aplica también a este endpoint.

#### Response exitosa — `204 No Content`

Sin cuerpo de respuesta. El servidor elimina la cookie del refresh token (`Set-Cookie` con caducidad inmediata).

#### Reglas de revocación

- Se revoca la sesión de la cookie solo si pertenece al mismo usuario que el access token. Si pertenece a otro usuario, la respuesta es `401` y no se revoca nada.
- El logout es idempotente: sin cookie, con una cookie inválida o con una sesión ya `REVOKED` o `EXPIRED`, responde `204`, borra la cookie y no publica ningún evento. Así el logout nunca deja al usuario a medias.
- La guarda del access token no consulta la base de datos (ADR-002 — Access Token Guard). Un access token ya emitido sigue siendo válido hasta que caduca, hasta 15 minutos, aunque la sesión se haya revocado. Lo que se impide es renovar la sesión.

#### Errores esperados

| Código | Caso | Respuesta esperada |
|---|---|---|
| `401 Unauthorized` | No hay un access token válido, o la cookie pertenece a la sesión de otro usuario (no se revoca nada). | Error genérico. |
| `403 Forbidden` | La petición trae una cabecera `Origin` distinta de `WEB_ORIGIN` (guarda de ADR-002). | Error genérico. |
| `415 Unsupported Media Type` | La petición trae un `Content-Type` que no es `application/json`. | Error genérico. |
| `500 Internal Server Error` | Error inesperado. | Error genérico; no revelar detalles internos. |

## Modelo de datos

No se introduce ninguna entidad nueva. Se actualiza el `status` de la `UserSession` correspondiente a `REVOKED` (Domain Model, ADR-002).

## Frontend

La cabecera expondrá, en las vistas autenticadas, una acción de "Cerrar sesión":

- Llama a `POST /api/v1/auth/logout` y espera la respuesta como máximo 5 segundos. Pasado ese tiempo cancela la petición y cierra la sesión igualmente.
- Independientemente de la respuesta del servidor (error de red, sin respuesta o límite de espera), limpia el estado de autenticación en cliente (access token en memoria) para no dejar al usuario en un estado inconsistente.
- Redirige a la home `/` en estado visitante, que ofrece los enlaces "Crear cuenta" e "Iniciar sesión".
- Una renovación de sesión que termina después del logout se ignora y no reabre la sesión.
- Avisa a las demás pestañas del mismo navegador mediante `BroadcastChannel('youpetme:auth')`: pasan a visitante al instante y mantienen su ruta. Si el navegador no lo soporta, caen a visitante en su próximo refresh (ADR-002 — Client-side Refresh Coordination).

**Limitación conocida.** Si la petición falla por red, la cookie y la sesión del servidor siguen activas. El cliente queda como visitante, pero al recargar la página la sesión se restaura mediante el refresh mientras la cookie siga vigente.

## Evento de dominio

Al completar correctamente la revocación se publica `SessionRevoked`, con `sessionId`, `userId` y `occurredAt`. Sin datos sensibles. No se publica si la sesión ya estaba revocada o caducada, ni si no hay una cookie válida.

## Testing

### Unit tests
- El use case marca la sesión correcta como `REVOKED` y ninguna otra sesión del mismo usuario.
- No revoca la sesión de otro usuario.
- Idempotencia: sin cookie, con cookie inválida o con sesión ya revocada o caducada, no cambia nada y no publica evento.

### Integration tests
- Endpoint `POST /api/v1/auth/logout` con PostgreSQL (Testcontainers): la sesión queda `REVOKED` en base de datos tras la llamada.
- Una petición posterior con el refresh token ya revocado es rechazada.
- Respuesta `204` idempotente y cookie borrada en los casos sin sesión que revocar.
- `401` sin access token válido o con la cookie de otro usuario.

### End-to-end tests
Se implementan en SCRUM-55, con Playwright.

- Logout completo desde una vista autenticada (la home y `/terms`) hasta quedar en estado público, con la sesión `REVOKED` en base de datos, la cookie borrada y el usuario como visitante tras recargar.
- Solo se revoca la sesión actual, con dos contextos de navegador.
- Fallo de red y servidor sin respuesta, con el límite de 5 segundos.
- Una renovación que termina después del logout no reabre la sesión.
- La segunda pestaña del mismo navegador pasa a visitante al instante.
- La guarda de `Origin` y de `Content-Type`, el `401` sin token y el `204` idempotente.

## Definition of Done

- [x] Un usuario autenticado puede cerrar sesión desde cualquier vista autenticada.
- [x] La `UserSession` correspondiente queda `REVOKED` en base de datos.
- [x] El estado de autenticación en cliente se limpia siempre, incluso si la petición de red falla.
- [x] Se publica `SessionRevoked` sin datos sensibles.
- [x] Un refresh token ya revocado no permite obtener nuevos access tokens.
- [x] Las pruebas unitarias, de integración y E2E definidas pasan.

## Referencias

- US-IAM-003 — Logout
- ADR-002 — Authentication Strategy
