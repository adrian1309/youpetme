TS-IAM-002 — Login

## Identificación

| Campo | Valor |
|---|---|
| Identificador | TS-IAM-002 |
| Historia relacionada | US-IAM-002 — Login |
| Módulo | Identity and Access Management (IAM) |
| Prioridad | MVP / Alta |
| Estado | Ready for Development |
| ADR relacionado | ADR-002 — Authentication Strategy |

## Objetivo técnico

Implementar el inicio de sesión de un usuario ya registrado en YouPetMe. Un visitante con credenciales válidas queda autenticado al finalizar el proceso.

Esta especificación incluye también la renovación de sesión (`POST /api/v1/auth/refresh`): como el access token vive 15 minutos y solo en memoria, sin este endpoint la sesión se perdería a los 15 minutos o al recargar la página (ADR-002).

## Flujo funcional

```text
Visitor
  → /login
  → Client validation
  → POST /api/v1/auth/login
  → LoginUser use case
      → Normalize email
      → Find user by normalized email
      → Verify password hash (Argon2id, ADR-002)
      → Check user status is ACTIVE
      → Create UserSession
      → Generate authentication tokens
      → Publish UserLoggedIn event
  → Authenticated application
```

Si la validación de cliente falla, no se realizará la petición. El servidor valida de nuevo toda la entrada; la validación de cliente no sustituye la validación de servidor.

## API

### `POST /auth/login`

Ruta completa bajo el prefijo de la API: `POST /api/v1/auth/login`.

Autentica a un usuario existente y crea una sesión autenticada.

#### Request body

```json
{
  "email": "john@example.com",
  "password": "my-secure-passphrase"
}
```

#### Reglas de entrada

| Campo | Reglas |
|---|---|
| `email` | Obligatorio; formato de correo válido; se normaliza para la búsqueda. |
| `password` | Obligatorio; no se valida contra la política de contraseña aquí (eso es solo en registro y reseteo) — cualquier valor no vacío se comprueba contra el hash almacenado. |

#### Response exitosa — `200 OK`

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "status": "ACTIVE"
  },
  "authentication": {
    "accessToken": "<access-token>"
  }
}
```

Igual que en TS-IAM-001, el refresh token **no** viaja en el cuerpo: el servidor lo entrega en una cookie `HttpOnly` y `Secure` mediante `Set-Cookie`, y el access token se mantiene en memoria en el cliente (ADR-002). Nunca se incluyen secretos, hashes o datos internos de sesión en la respuesta.

#### Errores esperados

| Código | Caso | Respuesta esperada |
|---|---|---|
| `400 Bad Request` | Datos ausentes o con formato inválido. | Error estructurado por campo. |
| `401 Unauthorized` | Email no encontrado, o contraseña incorrecta. | Mensaje de negocio genérico ("credenciales inválidas"), **sin revelar** si el email existe o no — para no facilitar enumeración de cuentas. |
| `403 Forbidden` | La cuenta existe pero su `status` no es `ACTIVE` (p. ej. `SUSPENDED`). Solo se devuelve si la contraseña es correcta, para no revelar qué emails existen. | Mensaje de negocio sin detalle interno del motivo exacto. |
| `500 Internal Server Error` | Error inesperado. | Error genérico; no revelar detalles internos. |

Cada error de negocio incluye además un campo `code` estable (ADR-017): `INVALID_CREDENTIALS` en el `401` y `ACCOUNT_NOT_AVAILABLE` en el `403`. El cliente distingue los casos por `code`, no por el texto del mensaje, y así no confunde este `403` con el de la guarda de `Origin`, que no lleva `code`. Tampoco lo llevan el `415`, el `400` (los códigos de validación van dentro de `details`) ni el `500`.

### `POST /auth/refresh`

Ruta completa bajo el prefijo de la API: `POST /api/v1/auth/refresh`.

Renueva el access token y rota el refresh token de la sesión actual (ADR-002 — Refresh Token Rotation).

#### Request

Sin body. El refresh token se lee de la cookie `HttpOnly` y `Secure`; el cliente no lo gestiona.

#### Response exitosa — `200 OK`

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "status": "ACTIVE"
  },
  "authentication": {
    "accessToken": "<access-token>"
  }
}
```

- El objeto `user` tiene la misma forma que en el login. Lo necesita el cliente para recuperar los datos del usuario al recargar la página, porque el access token vive solo en memoria.
- Se emite un nuevo access token (15 minutos) y un nuevo refresh token, entregado de nuevo solo en cookie `Set-Cookie`. La sesión y la cookie caducan en `min(ahora + JWT_REFRESH_EXPIRATION, createdAt + SESSION_ABSOLUTE_EXPIRATION)`: 7 días desde el último uso, pero nunca más de 30 días desde el inicio de sesión (ADR-002).
- El refresh token anterior queda invalidado: se actualiza el hash almacenado en la `UserSession` y `expiresAt` pasa a reflejar la nueva caducidad.
- Los valores de caducidad provienen de configuración (`JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION`, `SESSION_ABSOLUTE_EXPIRATION`).

#### Errores esperados

| Código | Caso | Respuesta esperada |
|---|---|---|
| `401 Unauthorized` | Cookie ausente, refresh token inválido, caducado o ya rotado, `UserSession` no activa (`REVOKED`/`EXPIRED`), o `UserSession` que ha superado su vida máxima (`SESSION_ABSOLUTE_EXPIRATION` desde su creación). Una sesión caducada, por la ventana o por el tope, queda marcada `EXPIRED`. | Error genérico, sin detalle del motivo. El servidor borra además la cookie y el cliente pasa a estado no autenticado. |
| `403 Forbidden` | La cuenta del usuario no está `ACTIVE`. | Mensaje de negocio sin detalle interno. No borra la cookie ni revoca la sesión. |
| `500 Internal Server Error` | Error inesperado. | Error genérico; no revelar detalles internos. |

Los errores del refresh llevan un campo `code` estable (ADR-017): `SESSION_NOT_RENEWABLE` en el `401` y `ACCOUNT_NOT_AVAILABLE` en el `403`.

Si se presenta un refresh token que ya fue rotado (reutilización), se rechaza con `401` y se revoca la `UserSession` correspondiente, porque indica un posible robo del token. No hay periodo de gracia para un token recién rotado (ADR-002 — Refresh Token Reuse).

#### Reglas de seguridad específicas

- La cookie del refresh token usa los atributos definidos en ADR-002 (Cookie and CSRF Policy): `HttpOnly`, `Secure`, `SameSite=Strict` y `Path=/api/v1/auth`. Al ser un endpoint basado en cookie, aplica la protección CSRF de ese mismo apartado.
- No se publica evento de dominio en el refresh normal (alto volumen y sin valor de negocio).

## Modelo de datos

No se introduce ninguna entidad nueva. Se reutilizan `User` y `UserSession` (Domain Model), y se crea una nueva fila de `UserSession` por cada login exitoso (consistente con "a user may have multiple active sessions", ADR-002). El refresh actualiza el `refreshTokenHash` y `expiresAt` de la misma `UserSession`, sin crear una nueva. `createdAt` no cambia nunca y marca el inicio de la vida máxima de la sesión; no requiere migración.

## Reglas de seguridad

- La comparación de contraseña usa la función de verificación del algoritmo de hashing (Argon2id, ADR-002), nunca una comparación de igualdad de strings en texto plano.
- El mensaje de error `401` es idéntico tanto si el email no existe como si la contraseña es incorrecta, para no filtrar qué campo falló.
- Intentos de login fallidos no bloquean explícitamente la cuenta en el MVP (no hay rate-limiting de login definido); esto queda anotado como una posible mejora futura de seguridad, no bloqueante para el MVP.

## Frontend

La ruta pública `/login` incluirá un formulario para `email` y `password`, con enlaces a `/register` y a la recuperación de contraseña (TS-IAM-004).

- Validará los datos antes de enviar.
- Deshabilitará o protegerá el envío repetido mientras la petición esté en curso.
- Mostrará el error `401`/`403` de forma genérica y segura, sin distinguir el motivo exacto.
- Tras una respuesta exitosa, guardará el access token solo en memoria (ADR-002) y redirigirá al área autenticada: la home `/` en estado autenticado.
- Al arrancar la aplicación o recargar la página, intentará restaurar la sesión llamando a `POST /api/v1/auth/refresh`; si responde `401`, el usuario queda como visitante sin mostrar error.
- Si la renovación falla por red o por un `5xx`, al arrancar el usuario queda como visitante sin mostrar error. En una petición ya autenticada se conserva la sesión y el error llega a quien hizo la petición.
- Ante un `401` en una petición autenticada, intentará un único refresh y reintentará la petición una vez; si el refresh falla, limpiará el estado de autenticación y redirigirá a `/login`. Peticiones concurrentes comparten un único refresh en curso.
- Las renovaciones se coordinan entre pestañas con Web Locks, para que dos pestañas no usen a la vez el mismo refresh token (ADR-002 — Client-side Refresh Coordination).

## Evento de dominio

Al completar correctamente el login se publicará el evento `UserLoggedIn`, con `userId`, `occurredAt` y un identificador de correlación cuando esté disponible. Sin datos sensibles.

## Testing

### Unit tests
- Normalización de email reutilizada de TS-IAM-001.
- Verificación de contraseña contra el hash almacenado (casos correcto/incorrecto).
- Rechazo cuando `status` no es `ACTIVE`.
- Mensaje de error idéntico para email inexistente vs contraseña incorrecta.
- Refresh: rotación del token, rechazo de token caducado, ya rotado o de sesión revocada, y revocación de la sesión ante reutilización; tope absoluto: rechazo y marca `EXPIRED` al superarlo, y caducidad limitada al tope cerca de él.

### Integration tests
- Endpoint `POST /api/v1/auth/login` con PostgreSQL (Testcontainers) y Prisma.
- Creación de `UserSession` tras login exitoso.
- El refresh token llega solo en la cookie `HttpOnly` y no en el cuerpo de la respuesta.
- Endpoint `POST /api/v1/auth/refresh`: devuelve un nuevo access token y una nueva cookie, y el refresh token anterior deja de funcionar.
- Una sesión más antigua que el tope recibe `401` `SESSION_NOT_RENEWABLE`, pierde la cookie y queda `EXPIRED`; cerca del tope, `expiresAt` y la cookie caducan en el tope.

### End-to-end tests
Se implementan en una subtarea aparte de SCRUM-6.

- Login completo desde `/login` hasta el área autenticada.
- Errores de credenciales inválidas visibles en el formulario.
- Recargar la página con sesión activa mantiene al usuario autenticado (restauración vía refresh).

## Definition of Done

- [ ] Un usuario con credenciales válidas puede iniciar sesión desde `/login`.
- [ ] Cliente y servidor validan los campos requeridos.
- [ ] El error de credenciales inválidas no distingue email inexistente de contraseña incorrecta.
- [ ] Una cuenta con `status` distinto de `ACTIVE` no puede iniciar sesión.
- [ ] Se crea una nueva `UserSession` por cada login exitoso, conforme a ADR-002.
- [ ] Se publica `UserLoggedIn` sin datos sensibles tras un login exitoso.
- [ ] `POST /api/v1/auth/refresh` renueva el access token y rota el refresh token; un refresh token ya rotado, caducado o de una sesión revocada es rechazado.
- [ ] Recargar la página con sesión activa no obliga a volver a iniciar sesión.
- [ ] Ninguna sesión puede renovarse más allá de `SESSION_ABSOLUTE_EXPIRATION` desde el inicio de sesión.
- [ ] Las pruebas unitarias, de integración y E2E definidas pasan.
- [ ] No aparecen contraseñas, hashes ni tokens en interfaz, consola o registros accesibles.

## Referencias

- US-IAM-002 — Login
- ADR-002 — Authentication Strategy
- TS-IAM-001 — User Registration
