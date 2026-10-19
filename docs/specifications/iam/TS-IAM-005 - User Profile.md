TS-IAM-005 — User Profile

## Identificación

| Campo | Valor |
|---|---|
| Identificador | TS-IAM-005 |
| Historia relacionada | US-IAM-005 — View and Edit Profile |
| Módulo | Identity and Access Management (IAM) |
| Prioridad | MVP / Media |
| Estado | Ready for Development |
| ADR relacionado | ADR-002 — Authentication Strategy |

## Objetivo técnico

Permitir que un usuario autenticado consulte y edite los datos básicos de su propio perfil (`firstName`, `lastName`).

## Alcance del MVP

Solo `firstName` y `lastName` son editables en el MVP. Explícitamente fuera de alcance:

- **Cambiar el email**: requeriría re-verificación (email verification es future, Authentication Flow) y complica la unicidad; no se implementa en el MVP.
- **Cambiar la contraseña desde el perfil** (distinto del reseteo por token, TS-IAM-004): no está en el alcance del MVP; se documentará como su propia especificación si se decide incluirla.
- **Campos de `AdopterProfile`** (teléfono, dirección, tipo de vivienda, experiencia con animales, etc.): pertenecen a un perfil futuro distinto (Domain Model — Profiles, "Future profiles may include AdopterProfile"), explícitamente no recogidos en el registro (Wireframes Authentication — "Data Not Collected During Registration") ni en esta especificación. No inventar estos campos aquí.

## Flujo funcional

```text
Authenticated user
  → GET /users/me
  → ViewProfile use case → return current UserProfile
  → User edits firstName/lastName
  → PATCH /users/me
  → UpdateProfile use case
      → Validate input
      → Update UserProfile
      → Publish UserProfileUpdated event
  → Updated profile shown
```

## API

### `GET /users/me`

Devuelve el perfil del usuario autenticado.

#### Response exitosa — `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "status": "ACTIVE"
}
```

#### Errores esperados

| Código | Caso |
|---|---|
| `401 Unauthorized` | No hay sesión autenticada válida. |

### `PATCH /users/me`

Actualiza el nombre y apellidos del usuario autenticado.

#### Request body

```json
{
  "firstName": "John",
  "lastName": "Smith"
}
```

#### Reglas de entrada

| Campo | Reglas |
|---|---|
| `firstName` | Obligatorio; texto válido tras eliminar espacios iniciales y finales; mismo criterio que en TS-IAM-001. |
| `lastName` | Obligatorio; mismo criterio. |

#### Response exitosa — `200 OK`

Devuelve el perfil actualizado, mismo formato que `GET /users/me`.

#### Errores esperados

| Código | Caso | Respuesta esperada |
|---|---|---|
| `400 Bad Request` | Datos ausentes o inválidos. | Error estructurado por campo. |
| `401 Unauthorized` | No hay sesión autenticada válida. | Error genérico. |
| `500 Internal Server Error` | Error inesperado. | Error genérico. |

## Modelo de datos

No se introduce ninguna entidad nueva; se actualiza `UserProfile.firstName` / `UserProfile.lastName` (Domain Model).

## Autorización

Un usuario solo puede leer y modificar su propio perfil (`userId` tomado de la sesión autenticada, nunca de un parámetro de la petición) — no existe en el MVP ningún endpoint para que un usuario consulte o edite el perfil de otro.

## Frontend

Una vista de perfil autenticada (p. ej. `/profile`):

- Muestra los datos actuales.
- Formulario de edición para `firstName`/`lastName`, con las mismas validaciones de cliente que el registro.
- Confirma el éxito de la actualización (Design System — Success state).

## Evento de dominio

Al completar correctamente la actualización se publica `UserProfileUpdated`, con `userId`, los campos modificados (nombres de campo, no valores sensibles) y `occurredAt`.

## Testing

### Unit tests
- Validación de `firstName`/`lastName`.
- El use case actualiza únicamente los campos permitidos.

### Integration tests
- Endpoints `GET`/`PATCH /users/me` con PostgreSQL (Testcontainers).
- Un usuario no puede leer ni modificar el perfil de otro usuario (intentar forzar un `userId` distinto vía payload es ignorado; se usa siempre el de la sesión).

### End-to-end tests
- Ver y editar el perfil propio desde la interfaz autenticada.

## Definition of Done

- [ ] Un usuario autenticado puede ver su propio perfil.
- [ ] Un usuario autenticado puede editar `firstName`/`lastName`.
- [ ] No es posible leer ni modificar el perfil de otro usuario.
- [ ] Los campos fuera de alcance (email, contraseña, `AdopterProfile`) no se implementan aquí.
- [ ] Se publica `UserProfileUpdated` sin datos sensibles.
- [ ] Las pruebas unitarias, de integración y E2E definidas pasan.

## Referencias

- US-IAM-005 — View and Edit Profile
- TS-IAM-001 — User Registration
- Domain Model — Profiles
- Wireframes Authentication — Data Not Collected During Registration
