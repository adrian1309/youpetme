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

## Flujo funcional

```text
Visitor
  → /login
  → Client validation
  → POST /auth/login
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
| `403 Forbidden` | La cuenta existe pero su `status` no es `ACTIVE` (p. ej. `SUSPENDED`). | Mensaje de negocio sin detalle interno del motivo exacto. |
| `500 Internal Server Error` | Error inesperado. | Error genérico; no revelar detalles internos. |

## Modelo de datos

No se introduce ninguna entidad nueva. Se reutilizan `User` y `UserSession` (Domain Model), y se crea una nueva fila de `UserSession` por cada login exitoso (consistente con "a user may have multiple active sessions", ADR-002).

## Reglas de seguridad

- La comparación de contraseña usa la función de verificación del algoritmo de hashing (Argon2id, ADR-002), nunca una comparación de igualdad de strings en texto plano.
- El mensaje de error `401` es idéntico tanto si el email no existe como si la contraseña es incorrecta, para no filtrar qué campo falló.
- Intentos de login fallidos no bloquean explícitamente la cuenta en el MVP (no hay rate-limiting de login definido); esto queda anotado como una posible mejora futura de seguridad, no bloqueante para el MVP.

## Frontend

La ruta pública `/login` incluirá un formulario para `email` y `password`, con enlaces a `/register` y a la recuperación de contraseña (TS-IAM-004).

- Validará los datos antes de enviar.
- Deshabilitará o protegerá el envío repetido mientras la petición esté en curso.
- Mostrará el error `401`/`403` de forma genérica y segura, sin distinguir el motivo exacto.
- Tras una respuesta exitosa, actualizará el estado de autenticación conforme a ADR-002 y redirigirá al área autenticada.

## Evento de dominio

Al completar correctamente el login se publicará el evento `UserLoggedIn`, con `userId`, `occurredAt` y un identificador de correlación cuando esté disponible. Sin datos sensibles.

## Testing

### Unit tests
- Normalización de email reutilizada de TS-IAM-001.
- Verificación de contraseña contra el hash almacenado (casos correcto/incorrecto).
- Rechazo cuando `status` no es `ACTIVE`.
- Mensaje de error idéntico para email inexistente vs contraseña incorrecta.

### Integration tests
- Endpoint `POST /auth/login` con PostgreSQL (Testcontainers) y Prisma.
- Creación de `UserSession` tras login exitoso.
- El refresh token llega solo en la cookie `HttpOnly` y no en el cuerpo de la respuesta.

### End-to-end tests
- Login completo desde `/login` hasta el área autenticada.
- Errores de credenciales inválidas visibles en el formulario.

## Definition of Done

- [ ] Un usuario con credenciales válidas puede iniciar sesión desde `/login`.
- [ ] Cliente y servidor validan los campos requeridos.
- [ ] El error de credenciales inválidas no distingue email inexistente de contraseña incorrecta.
- [ ] Una cuenta con `status` distinto de `ACTIVE` no puede iniciar sesión.
- [ ] Se crea una nueva `UserSession` por cada login exitoso, conforme a ADR-002.
- [ ] Se publica `UserLoggedIn` sin datos sensibles tras un login exitoso.
- [ ] Las pruebas unitarias, de integración y E2E definidas pasan.
- [ ] No aparecen contraseñas, hashes ni tokens en interfaz, consola o registros accesibles.

## Referencias

- US-IAM-002 — Login
- ADR-002 — Authentication Strategy
- TS-IAM-001 — User Registration
