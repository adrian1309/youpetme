# TS-ADOPTION-001 — Adoption Requests

## Identificación

| Campo | Valor |
|---|---|
| Identificador | TS-ADOPTION-001 |
| Historias relacionadas | SCRUM-14 (enviar solicitud de adopción), SCRUM-15 (gestionar solicitudes, ADMIN) |
| Módulo | Adoptions |
| Prioridad | MVP / Alta |
| Estado | Implemented |
| Documentos relacionados | Domain Model (Adoption domain), TS-ANIMALS-001, ADR-002 — Authentication Strategy, ADR-017 — API Error Format |

## Objetivo técnico

Permitir que un usuario autenticado solicite la adopción de un animal disponible y que un administrador revise, apruebe, rechace, complete o cancele esas solicitudes, manteniendo coherente el estado de la solicitud y el del animal.

## Alcance

Dentro del alcance: envío de solicitud, listado y filtrado para el ADMIN, y las cuatro transiciones (aprobar, rechazar, completar, cancelar).

Fuera del alcance: retirada de la solicitud por el solicitante, notificaciones, motivo de la decisión, pantalla «mis solicitudes» y rechazo automático de las demás solicitudes `PENDING` al aprobar una.

## API

Todas las rutas cuelgan del prefijo `/api/v1`.

### `POST /adoption-requests`

`Authorization: Bearer`, cualquier rol. Cuerpo `{ "animalId": "...", "message": "..." }`. Responde `201 Created` con un `AdoptionRequestItem`. La solicitud se crea en `PENDING`.

### `GET /adoption-requests`

Solo `ADMIN`. Parámetros opcionales: `status`, `animalId`, `page` y `pageSize` (12 por defecto, máximo 50). Ordena de la más nueva a la más antigua y responde `200 OK` con `{ items, page, pageSize, total }`. Filtrar por `animalId` da el historial de solicitudes de un animal.

### `POST /adoption-requests/:id/{approve|reject|complete|cancel}`

Solo `ADMIN`, sin cuerpo. Responde `200 OK` con el `AdoptionRequestItem` actualizado.

### `AdoptionRequestItem`

`id`, `status`, `message`, `createdAt`, `decidedAt`, `animal { id, name, status }` y `applicant { firstName, lastName, email }`.

## Reglas de entrada

| Campo | Reglas |
|---|---|
| `animalId` | Obligatorio; UUID (`REQUIRED` o `INVALID_FORMAT`). |
| `message` | Opcional; hasta 1000 caracteres tras quitar espacios (`TOO_LONG`, `INVALID_TYPE`). Si queda vacío se guarda como `null`. |

## Reglas de negocio

- Solo se puede solicitar un animal `AVAILABLE`.
- Un usuario no puede tener a la vez dos solicitudes `PENDING` o `APPROVED` sobre el mismo animal. `REJECTED` y `CANCELLED` no bloquean una solicitud nueva.
- Transiciones permitidas: `PENDING` → `APPROVED` | `REJECTED` y `APPROVED` → `COMPLETED` | `CANCELLED`. Las demás se rechazan.

| Acción | Solicitud | Animal |
|---|---|---|
| `approve` | `PENDING` → `APPROVED` | `AVAILABLE` → `RESERVED` |
| `reject` | `PENDING` → `REJECTED` | sin cambios |
| `complete` | `APPROVED` → `COMPLETED` | `RESERVED` → `ADOPTED` |
| `cancel` | `APPROVED` → `CANCELLED` | `RESERVED` → `AVAILABLE` |

Cada transición se ejecuta en una sola transacción con actualizaciones condicionales: si la solicitud o el animal ya no están en el estado esperado, no se cambia nada. Se guardan `decidedByUserId` (el `sub` del token) y `decidedAt`. Aprobar una solicitud no modifica las demás `PENDING` del mismo animal; el ADMIN las decide una a una.

## Errores

Formato de ADR-017.

| Caso | Respuesta |
|---|---|
| Validación | `400` con `details`. |
| Sin token | `401`, sin `code`. |
| Rol distinto de `ADMIN` en listado y transiciones | `403`, sin `code`. |
| Animal inexistente; solicitud inexistente, id mal formado o acción desconocida | `404`. |
| Animal no `AVAILABLE` (al crear, o al aprobar) | `409` `ANIMAL_NOT_AVAILABLE`. |
| Ya existe una solicitud `PENDING` o `APPROVED` del usuario para ese animal | `409` `ADOPTION_REQUEST_ACTIVE`. |
| Transición no permitida, o la solicitud o el animal han cambiado entretanto | `409`, sin `code`. |

## Modelo de datos

- Tabla `adoption_requests`, con claves foráneas a `animals` y `users` (solicitante y `decided_by_user_id`, que admite `null`), `CHECK` sobre la longitud del mensaje y el enum `AdoptionRequestStatus`.
- Índices sobre `(status, created_at)` y `(animal_id)`.
- Índice único parcial `(animal_id, applicant_user_id) WHERE status IN ('PENDING','APPROVED')`, escrito en SQL dentro de la migración. Garantiza la ausencia de duplicados aunque lleguen dos peticiones simultáneas. Prisma no lo borra en migraciones posteriores (comprobado).

## Autorización

Endpoints con Bearer; no usan la cookie de refresh, por lo que no llevan `TrustedBrowserRequestGuard` (ADR-002). El listado y las transiciones usan `AdminGuard`, el mismo que el alta de animales.

## Frontend

| Ruta | Acceso | Contenido |
|---|---|---|
| `/animals/:id` (sección de solicitud) | Público; enviar requiere sesión | Botón «Solicitar adopción» y formulario con mensaje opcional. |
| `/admin/adoption-requests` | Solo `ADMIN` (`RequireAdmin`) | Lista paginada; filtros `status`, `animalId` y `page` en la URL. |

- El botón solo aparece si el animal está `AVAILABLE`. Si deja de estarlo mientras el usuario rellena el formulario, la página recarga el animal y explica el motivo.
- Un visitante que pulsa el botón va a `/login` y vuelve a la ficha tras iniciar sesión (TS-IAM-002).
- En la lista de ADMIN cada solicitud muestra solo los botones válidos para su estado. Un `409` muestra un mensaje y recarga la lista.
- Los enlaces «Solicitudes» (cabecera) y «Ver las solicitudes de adopción de…» (ficha) solo los ve un ADMIN. La protección es de experiencia de usuario; la API es la que autoriza.
- Patrones visuales: Design System — Adoption request patterns.

## Testing

### Unit tests

Entidad (todas las transiciones, válidas e inválidas) y casos de uso con un repositorio en memoria.

### Integration tests

Con Testcontainers: el índice parcial, las dos carreras (dos solicitudes simultáneas del mismo usuario y dos aprobaciones simultáneas sobre el mismo animal), cada transición con su efecto en el animal, las transiciones no permitidas, aprobar con el animal ya `RESERVED`, permisos (`401` y `403`), filtros y datos del solicitante.

### Component tests

Con axe: la sección de solicitud de la ficha (botón según estado y sesión, envío, duplicado, vuelta tras el login) y la pantalla de admin (botones por estado, una transición, filtro, `RequireAdmin`).

### End-to-end tests

Un recorrido: un visitante pulsa el botón, inicia sesión, vuelve a la ficha y envía la solicitud; el admin la aprueba y la completa; el animal queda `ADOPTED` y sale del catálogo.

## Limitaciones del MVP

- El repositorio de adopciones lee y actualiza la tabla `animals` y lee `users` y `user_profiles` para que la solicitud y el animal cambien en la misma transacción; la infraestructura de un módulo toca tablas de otros dos. Es un atajo asumido.
- No hay emails ni notificaciones, ni retirada de la solicitud por el solicitante, ni motivo de rechazo o cancelación.
- No hay pantalla «mis solicitudes»: el solicitante no puede ver sus solicitudes.
- Las demás solicitudes `PENDING` de un animal aprobado no cambian automáticamente.
- La lista de ADMIN no tiene búsqueda de texto.

## Definition of Done

- [x] Los endpoints cumplen esta especificación.
- [x] Listado y transiciones solo para `ADMIN`.
- [x] Solicitud y animal cambian de forma atómica; los duplicados son imposibles por índice.
- [x] Los errores usan el formato de ADR-017, con los dos códigos nuevos documentados.
- [x] Tests unitarios, de integración, de componente y E2E en verde.

## Referencias

- Domain Model — Adoption domain (MVP)
- TS-ANIMALS-001 — Animal Catalogue
- TS-IAM-002 — Login
- ADR-002 — Authentication Strategy
- ADR-017 — API Error Format
- Design System — Adoption request patterns
