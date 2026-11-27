# TS-AI-002 — AI Matching

## Identificación

| Campo | Valor |
|---|---|
| Identificador | TS-AI-002 |
| Historia relacionada | SCRUM-16 (AI Matching; subtareas SCRUM-41 backend y SCRUM-42 frontend) |
| Módulo | AI |
| Prioridad | MVP / Alta |
| Estado | Implemented |
| Documentos relacionados | ADR-010 — AI Matching Approach, TS-AI-001 — Diango Assistant, Domain Model (Taxonomy, `UserProfile.matchingPreferences`), ADR-017 — API Error Format |

## Objetivo técnico

Permitir que un visitante o un usuario describa en texto libre lo que busca y reciba hasta cinco animales disponibles recomendados, cada uno con los motivos por los que encaja, sin tener que usar filtros.

## Funcionamiento

```text
Texto libre
  → una llamada al modelo con structured outputs (extracción del perfil de adoptante)
  → filtros duros y puntuación sobre los animales AVAILABLE (en memoria)
  → hasta 5 animales con puntuación y códigos de motivo
```

- **Una sola llamada al modelo.** La explicación de por qué encaja un animal no la redacta el modelo: son los códigos de motivo que devuelve la propia puntuación, y el cliente muestra un texto fijo por cada uno. Es una desviación del flujo de dos llamadas de ADR-010, que lo enmienda (menos latencia y coste, resultado determinista y comprobable).
- **Structured outputs, no herramienta forzada.** La extracción usa un JSON Schema estricto en el que todos los atributos son obligatorios pero admiten `null`; `null` significa «no se dijo» y se elimina del perfil. El `tool_choice` forzado lo rechazan varios modelos actuales, mientras que los structured outputs garantizan el esquema con cualquiera de ellos.
- **El modelo no deduce.** Solo rellena un atributo si el usuario lo dice de forma explícita. Vivir en un piso rellena `housingSize` y nunca `preferredSize`. Las preferencias de especie, tamaño y edad exigen una petición expresa («quiero un perro», «algo pequeño», «un cachorro»). Sin mención, `experienceWithAnimals`, `hasChildren` y `hasOtherAnimals` quedan en `null`.
- **Proveedor.** Se usa el puerto `AIProvider` y la configuración de TS-AI-001, incluido el adaptador `fake`, que extrae el perfil con reglas por palabras clave y permite probar el flujo sin red.

## Perfil de adoptante

Todos los campos son opcionales y ninguno es texto libre. El perfil se guarda y se devuelve como un objeto JSON sin las claves ausentes, por ejemplo `{ "preferredSpecies": "DOG", "housingSize": "SMALL" }`.

| Campo | Valores |
|---|---|
| `housingSize` | `SMALL`, `MEDIUM`, `LARGE` |
| `activityLevel` | `LOW`, `MODERATE`, `HIGH` |
| `experienceWithAnimals` | `NONE`, `SOME`, `EXPERIENCED` |
| `hasChildren`, `hasOtherAnimals` | booleano |
| `preferredSpecies` | `DOG`, `CAT`, `OTHER` |
| `preferredSize` | `SMALL`, `MEDIUM`, `LARGE` |
| `preferredAgeGroup` | `PUPPY_KITTEN`, `YOUNG`, `ADULT`, `SENIOR` |

Un único esquema valida el perfil en cuatro puntos: la salida del modelo, el `PUT`, antes de guardarlo y antes de incluirlo en el *prompt* de Diango.

## API

Todas las rutas cuelgan del prefijo `/api/v1`.

### `POST /matching`

Público; `Authorization: Bearer` opcional. Cuerpo `{ "description": "..." }`, de 1 a 1000 caracteres tras quitar espacios. Responde `200 OK`:

```json
{ "profile": {}, "results": [{ "animal": {}, "score": 0, "reasons": [] }] }
```

`animal` tiene la forma del resumen del catálogo (TS-ANIMALS-001) y `reasons` es una lista de códigos de motivo.

Errores (ADR-017, sin códigos nuevos): `400` con `details`, `401` si el token se envía pero es inválido o caducado, `429` con `Retry-After` y `503` si el proveedor falla o devuelve algo inutilizable. Si el modelo se niega a responder, el resultado es un perfil vacío y ningún animal.

### `PUT /users/me/matching-preferences`

`Authorization: Bearer` obligatorio. El cuerpo es un perfil de adoptante. Responde `204 No Content`, `400` si el perfil no es válido o `401` sin token. Sustituye el valor anterior de `matchingPreferences`.

## Persistencia

- **Invitado:** el servidor no guarda nada de la interacción. El perfil lo conserva solo el navegador.
- **Usuario autenticado:** con un Bearer válido, cada ejecución sustituye `UserProfile.matchingPreferences` por el perfil extraído. Es un punto de partida y contexto para Diango; nunca limita lo que el usuario puede pedir.
- **Invitado que se registra:** el cliente ofrece guardar sus preferencias y, si las acepta, usa el `PUT` anterior.
- Los resultados nunca se guardan. No hay migración: `matchingPreferences` ya existía (`Json?`).

## Reglas de puntuación

### Filtros duros

Se exige siempre `status = AVAILABLE`, y además:

- `preferredSpecies`, `preferredSize` y `preferredAgeGroup` filtran por el valor indicado.
- `housingSize = SMALL` excluye los animales de tamaño `LARGE`.
- `hasChildren = true` excluye los animales con `compatibleWithChildren = false`. `hasOtherAnimals = true` excluye los de `compatibleWithOtherAnimals = false`. Un valor desconocido (`null`) ni excluye ni puntúa.

### Pesos

| Condición | Puntos | Motivo |
|---|---|---|
| Coincide con la especie, el tamaño o la edad preferidos | +1 cada uno | `SPECIES_MATCH`, `SIZE_MATCH`, `AGE_MATCH` |
| Tamaño del animal igual al de la vivienda | +2 | `SIZE_FITS_HOME` |
| Tamaño del animal a un paso del de la vivienda | +1 | `SIZE_FITS_HOME` |
| Actividad `HIGH` y animal `ENERGETIC` o `PLAYFUL` | +2 | `ACTIVE_MATCH` |
| Actividad `LOW` y animal `CALM` o `INDEPENDENT` | +2 | `CALM_MATCH` |
| Sin experiencia (`NONE`) y animal `AFFECTIONATE` | +1 | `GOOD_FOR_BEGINNERS` |
| Sin experiencia (`NONE`) y animal `SHY` o `ENERGETIC` | −1 | (sin motivo) |
| Hay niños y `compatibleWithChildren = true` | +2 | `GOOD_WITH_CHILDREN` |
| Hay otros animales y `compatibleWithOtherAnimals = true` | +2 | `GOOD_WITH_ANIMALS` |

`MODERATE`, `SOME` y `EXPERIENCED` no puntúan, porque ADR-010 no les asigna ninguna regla.

### Resultado

Se ordena por puntuación descendente; en un empate se mantiene el orden del catálogo. Se descartan los animales con puntuación menor o igual que 0 y se devuelven cinco como máximo. Se cargan hasta 200 animales `AVAILABLE` y se puntúan en memoria. Los nueve códigos de motivo son los de la tabla.

## Límites

Mismo límite de peticiones por IP y minuto que el chat de Diango (`ASSISTANT_RATE_LIMIT_PER_MINUTE`): el contador es compartido (TS-AI-001).

## Interfaz

La página pública `/matching` («Encuentra tu compañero») está enlazada desde la cabecera.

- Un campo de texto de hasta 1000 caracteres con contador y sugerencias de qué contar (vivienda, actividad, experiencia, niños u otros animales), y un mensaje accesible mientras se busca.
- Hasta cinco tarjetas del catálogo, cada una con una etiqueta de encaje («Encaja muy bien» con puntuación ≥ 5, «Encaja bien» por debajo), la lista «Por qué encaja» con el texto fijo de cada motivo y el enlace a la ficha.
- Estado vacío con un enlace al catálogo completo (`/animals`); no es un error.
- Los errores `429` y `503` tienen mensajes distintos y un botón «Reintentar» que repite la misma descripción.
- Un invitado guarda el perfil en `localStorage` (`youpetme:matching-profile`, validado con los mismos enums al leerlo). Un usuario autenticado envía el Bearer y no guarda nada en el navegador.
- En el registro, si hay un perfil guardado aparece la casilla «Guardar mis preferencias de búsqueda», desmarcada. Si se marca, tras crear la cuenta se envía el `PUT` con el token nuevo y se borra la clave. Si ese guardado falla, el registro no se bloquea.

## Testing

### Unit tests

La puntuación (filtros duros, `null` que ni excluye ni puntúa, pesos y motivos, puntuación menor o igual que 0, tope de cinco y empates); el caso de uso con un proveedor con guion (perfil extraído y limpio, salida inválida, negativa del modelo, guardado solo con usuario, «vivo en un piso» sin `preferredSize`); el adaptador `fake`; y que a Diango no llegue un perfil inválido.

### Integration tests

Con Testcontainers y el adaptador `fake`: validación, visitante sin persistencia, usuario autenticado que guarda y sustituye el perfil, `401`, `429`, `503`, solo animales `AVAILABLE`, estado vacío y el `PUT` (`204`, `400`, `401`).

### Component tests

Con axe: envío, resultados con motivos, estado vacío, errores con reintento, guardado en `localStorage` (solo invitado) y la casilla del registro.

### End-to-end tests

Un recorrido con el adaptador `fake`: un invitado describe lo que busca, ve un animal recomendado con sus motivos y abre su ficha.

El adaptador de Anthropic se comprobó a mano con la clave real: el perfil no deduce preferencias no dichas y rellena las explícitas.

## Limitaciones del MVP

- La explicación es un texto fijo por motivo, no una frase redactada por el modelo.
- El perfil guardado no se muestra, no se precarga en `/matching` y no se puede editar a mano.
- Si el `PUT` posterior al registro falla, el usuario no se entera y no se vuelve a ofrecer.
- Se puntúan como mucho 200 animales, en memoria. El límite por IP es en memoria, de un solo proceso y compartido con Diango.
- Si el modelo devuelve algo inutilizable, la respuesta es un `503`.

## Definition of Done

- [x] Los endpoints cumplen esta especificación.
- [x] El perfil no contiene nada que el usuario no haya dicho; se valida con un único esquema.
- [x] Un invitado no deja nada en el servidor; un usuario autenticado sustituye su perfil.
- [x] Estado vacío accionable y errores recuperables.
- [x] Tests unitarios, de integración, de componente y E2E en verde; adaptador real comprobado a mano.

## Referencias

- ADR-010 — AI Matching Approach
- ADR-011 — AI Assistant (Diango) Behaviour
- ADR-017 — API Error Format
- TS-AI-001 — Diango Assistant
- TS-ANIMALS-001 — Animal Catalogue
- Domain Model — Taxonomy, `UserProfile`
- Design System — AI-assisted experiences
