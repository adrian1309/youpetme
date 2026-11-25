# TS-ANIMALS-001 — Animal Catalogue

## Identificación

| Campo | Valor |
|---|---|
| Identificador | TS-ANIMALS-001 |
| Historias relacionadas | SCRUM-10 (alta de animal), SCRUM-12 (catálogo con filtros), SCRUM-13 (ficha del animal) |
| Módulo | Animals |
| Prioridad | MVP / Alta |
| Estado | Implemented |
| Documentos relacionados | Domain Model (Animals domain), ADR-002 — Authentication Strategy, ADR-017 — API Error Format, ARCH-002 — Media storage |

## Objetivo técnico

Permitir que un administrador dé de alta animales de YouPetMe y que cualquier visitante los consulte en un catálogo público con filtros y abra la ficha de cada uno.

## Alcance

Dentro del alcance: alta de animal (ADMIN), listado público con filtros y paginación, ficha pública del animal.

Fuera del alcance: edición, borrado y cambios de estado de un animal (SCRUM-11 y el flujo de adopción), subida de fotos y búsqueda de texto.

## API

Todas las rutas cuelgan del prefijo `/api/v1`.

### `POST /animals`

Da de alta un animal. Requiere `Authorization: Bearer <accessToken>` y rol `ADMIN`. Responde `201 Created` con un `AnimalDetail`. El animal se crea con estado `AVAILABLE` y se asocia al único `Shelter` del MVP.

### `GET /animals`

Público. Devuelve solo animales `AVAILABLE`, del más nuevo al más antiguo. Responde `200 OK`:

```json
{ "items": [], "page": 1, "pageSize": 12, "total": 0 }
```

`items` es una lista de `AnimalSummary` (los datos que necesita la tarjeta del catálogo).

Parámetros de consulta, todos opcionales:

| Parámetro | Valores |
|---|---|
| `species` | `DOG`, `CAT`, `OTHER` |
| `size` | `SMALL`, `MEDIUM`, `LARGE` |
| `ageGroup` | `PUPPY_KITTEN`, `YOUNG`, `ADULT`, `SENIOR` |
| `compatibleWithChildren` | `true`, `false` |
| `compatibleWithOtherAnimals` | `true`, `false` |
| `page` | entero ≥ 1; por defecto 1 |
| `pageSize` | entero entre 1 y 50; por defecto 12 |

Los filtros se combinan con AND. Los de compatibilidad buscan el valor exacto: un animal con compatibilidad desconocida (`null`) nunca coincide con `true` ni con `false`. Cualquier valor no permitido da `400`.

### `GET /animals/:id`

Público. Responde `200 OK` con un `AnimalDetail`, **en cualquier estado** (`AVAILABLE`, `RESERVED` o `ADOPTED`), para que un enlace a un animal ya reservado o adoptado siga funcionando.

## Reglas de entrada (alta)

| Campo | Reglas |
|---|---|
| `name` | Obligatorio; entre 1 y 100 caracteres tras quitar espacios. |
| `species`, `size`, `ageGroup` | Obligatorios; valores de la taxonomía del Domain Model. |
| `photoUrls` | Obligatorio; entre 1 y 5 URLs `https`, de hasta 2048 caracteres cada una. |
| `breed` | Opcional; hasta 100 caracteres. |
| `careNotes` | Opcional; hasta 2000 caracteres. |
| `temperament` | Opcional; valores del vocabulario del Domain Model; los duplicados se eliminan. |
| `compatibleWithChildren`, `compatibleWithOtherAnimals` | Opcionales; `true`, `false` o `null`, donde `null` significa «no se sabe». |

Un texto opcional vacío se guarda como `null`.

## Errores

Formato de ADR-017. No se añade ningún código de negocio nuevo.

| Caso | Respuesta |
|---|---|
| Validación del cuerpo o de los parámetros | `400` con `details`, usando `REQUIRED`, `INVALID_FORMAT` (valor fuera de la taxonomía o URL inválida), `INVALID_TYPE` o `TOO_LONG`. |
| Alta sin token | `401`, sin `code`. |
| Alta con rol distinto de `ADMIN` | `403`, sin `code`. |
| `GET /animals/:id` con un id inexistente o mal formado | `404` «Animal not found». |

## Modelo de datos

- Tablas `shelters` y `animals`, creadas por la migración `animals`.
- La migración inserta el `Shelter` «YouPetMe» con un id fijo, que la API conoce.
- `animals` guarda las fotos como una lista de URLs (`photoUrls`). Es una decisión del MVP: no hay subida de ficheros (ARCH-002, Media storage).
- `CHECK` sobre la longitud del nombre y sobre el número de fotos (1 a 5).
- Índice sobre `(status, created_at)`, que sirve el listado público.

## Autorización

`AdminGuard` protege el alta: sin token responde `401` y con rol `USER`, `403`. Las respuestas de login, refresh y registro incluyen `role` para que la web decida qué mostrar; quien decide siempre es la API (ADR-002).

El primer administrador se crea con el script `seed:admin`, que lee `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME` y `ADMIN_LAST_NAME` del entorno. Se puede ejecutar varias veces sin duplicar y **no** convierte en `ADMIN` a un usuario que ya existe.

## Frontend

| Ruta | Acceso | Contenido |
|---|---|---|
| `/animals` | Público | Catálogo con filtros y paginación. |
| `/animals/:id` | Público | Ficha del animal. |
| `/admin/animals/new` | Solo `ADMIN` | Formulario de alta. |

- Los filtros y la página viven en la query string de la URL, de modo que un listado filtrado se puede compartir. Al cambiar un filtro se vuelve a la página 1.
- Un `ADMIN` entra al formulario de alta desde el catálogo. Un visitante sin sesión que intenta abrir `/admin/animals/new` va a `/login`; un `USER` va a `/animals`. La protección de la ruta es solo experiencia de usuario: la API es la que autoriza.
- El formulario envía una sola foto por animal. La compatibilidad se elige entre «No se sabe», «Sí» y «No».
- La compatibilidad desconocida se muestra explícitamente en la ficha («Con niños: no se sabe») y se omite en las tarjetas del catálogo (Design System, Animal information patterns).

## Testing

### Unit tests

Entidad `Animal` y casos de uso de alta, listado y ficha, con un adaptador en memoria del repositorio.

### Integration tests

Con Testcontainers: un test por filtro, combinación de filtros, paginación, permisos (`401` y `403`) y `404`.

### End-to-end tests

Un administrador da de alta un animal; un visitante lo encuentra con filtros y abre su ficha.

## Limitaciones del MVP

- No hay subida real de fotos: son URLs `https` de imágenes ya alojadas en otro sitio. La API no comprueba que la URL apunte realmente a una imagen.
- No se pueden editar, borrar ni cambiar de estado los animales desde la aplicación; el estado lo gobernará el flujo de adopción.
- No hay búsqueda de texto.
- `seed:admin` no promueve a un usuario ya registrado.

## Definition of Done

- [x] Los tres endpoints cumplen esta especificación.
- [x] El alta solo está disponible para `ADMIN`.
- [x] Los errores usan el formato de ADR-017.
- [x] Tests unitarios, de integración y E2E en verde.
- [x] El Domain Model y ARCH-002 reflejan que las fotos son URLs en el MVP.

## Referencias

- Domain Model — Animals domain (MVP)
- ADR-002 — Authentication Strategy
- ADR-015 — Local Object Storage for Development
- ADR-017 — API Error Format
- ARCH-002 — Application Stack
- Design System — Animal information patterns
