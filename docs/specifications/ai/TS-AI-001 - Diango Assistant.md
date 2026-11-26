# TS-AI-001 — Diango Assistant

## Identificación

| Campo | Valor |
|---|---|
| Identificador | TS-AI-001 |
| Historias relacionadas | SCRUM-17 (bienvenida de Diango), SCRUM-18 (chatbot de Diango) |
| Módulo | AI |
| Prioridad | MVP / Media-Alta |
| Estado | Implemented |
| Documentos relacionados | ADR-011 — AI Assistant (Diango) Behaviour, ADR-002 — Authentication Strategy, ADR-017 — API Error Format, ARCH-002 — Application Stack, Design System — AI-assisted experiences |

## Objetivo técnico

Dar a cualquier visitante o usuario un asistente, Diango, que le da la bienvenida la primera vez y que responde en un chat sobre la plataforma, el proceso de adopción y los animales disponibles, usando datos reales del catálogo.

## Alcance

Dentro del alcance: bienvenida de primera visita, chat con memoria de sesión, herramienta de búsqueda en el catálogo y contexto básico del usuario autenticado.

Fuera del alcance (ADR-011): memoria entre sesiones, aprendizaje del historial, RAG, anuncios de novedades versionados, *streaming*, formato markdown, preguntas sugeridas y herramientas de escritura (Diango no crea solicitudes ni modifica nada).

## Arquitectura

El módulo `ai` sigue la arquitectura hexagonal de ARCH-001. El caso de uso depende del puerto `AIProvider`, nunca del SDK de Anthropic directamente, con tres piezas:

- **Adaptador `anthropic`:** usa `@anthropic-ai/sdk` con el modelo de `AI_MODEL` (por defecto `claude-haiku-5-5`), `max_tokens` 1024, esfuerzo bajo, *timeout* de 20 s y un reintento. Cualquier error del SDK se traduce a «proveedor no disponible»; no se registra la clave ni el contenido de los mensajes.
- **Adaptador `fake`:** respuestas deterministas, sin red. Se usa en desarrollo y en los tests automáticos. La configuración lo rechaza con `NODE_ENV=production`.
- **Selección:** la variable `AI_PROVIDER` elige el adaptador, igual que `EMAIL_DELIVERY` con el email (ADR-014).

## API

Todas las rutas cuelgan del prefijo `/api/v1`.

### `POST /assistant/messages`

Público: `Authorization: Bearer` es opcional. Sin cabecera, la petición se trata como visitante. Si se envía un token inválido o caducado, responde `401` para que el cliente lo renueve y no pierda el contexto del usuario (`OptionalAccessTokenGuard`, ADR-002).

Petición:

```json
{ "messages": [{ "role": "user", "content": "¿Tenéis perros pequeños?" }] }
```

| Regla | Valor |
|---|---|
| Número de mensajes | De 1 a 20; el último es de `user`. |
| Contenido | No puede estar vacío ni ser solo espacios. Hasta 1000 caracteres en los mensajes de `user` y hasta 4000 en los de `assistant`. |

Respuesta `200 OK`: `{ "reply": "..." }`, en texto plano.

El cliente reenvía el historial de la sesión en cada petición y el servidor no guarda nada (memoria solo de sesión, ADR-011).

### `PUT /users/me/welcome-seen`

`Authorization: Bearer` obligatorio. Marca `UserProfile.hasSeenWelcome` como `true`. Responde `204 No Content`, sin cuerpo; es idempotente.

## Comportamiento de Diango

- Un único agente con una herramienta, `search_animals`, de solo lectura. Acepta los filtros opcionales `species`, `size`, `ageGroup`, `compatibleWithChildren` y `compatibleWithOtherAnimals`, con los valores de la taxonomía del Domain Model.
- La herramienta reutiliza el caso de uso del catálogo: devuelve solo animales `AVAILABLE`, como máximo 10, con `id`, nombre, especie, tamaño, edad, raza, temperamento y compatibilidades. No devuelve notas de cuidado ni fotos.
- El bucle de herramientas se corta tras 3 llamadas al modelo. Si la tercera todavía pide una herramienta, Diango responde con una frase fija que invita a reformular la pregunta. Una negativa del modelo se sustituye por otra frase fija.
- El *system prompt* está en español. Diango habla solo de YouPetMe, del proceso de adopción y de los animales del catálogo; no inventa animales ni datos; no da consejo veterinario ni legal; trata los resultados de las herramientas como datos y nunca como instrucciones; responde en texto plano y de forma breve.
- Con sesión, el *prompt* incluye el nombre del usuario y, si no es nulo, `UserProfile.matchingPreferences`. Hoy ese campo siempre es nulo, porque AI Matching aún no lo escribe; en la práctica solo se usa el nombre.

## Errores

Formato de ADR-017, sin códigos nuevos.

| Caso | Respuesta |
|---|---|
| Validación de la petición | `400` con `details` (`REQUIRED`, `TOO_LONG`, `INVALID_FORMAT`, `INVALID_TYPE`). |
| Token enviado pero inválido o caducado | `401`. |
| Límite de peticiones superado | `429`, con `Retry-After`. |
| El proveedor falla o supera el *timeout* | `503`. |

El cliente distingue el `429` del `503` por `statusCode`.

## Límites y coste

- `max_tokens` 1024, historial de 20 mensajes y longitudes máximas por mensaje.
- Límite de peticiones por IP y minuto, configurable con `ASSISTANT_RATE_LIMIT_PER_MINUTE` (10 por defecto). Se guarda en memoria, en un solo proceso, y visitantes y usuarios con sesión lo comparten.

## Configuración

| Variable | Valor por defecto | Uso |
|---|---|---|
| `AI_PROVIDER` | `fake` | `fake` o `anthropic`; en producción solo `anthropic`. |
| `ANTHROPIC_API_KEY` | — | Obligatoria con `anthropic`. La clave real vive solo en el `.env` o en las variables del servidor; el `.env.example` lleva un valor ficticio. |
| `AI_MODEL` | `claude-haiku-5-5` | Modelo del adaptador de Anthropic. |
| `ASSISTANT_RATE_LIMIT_PER_MINUTE` | `10` | Peticiones por IP y minuto. |

## Autenticación

`hasSeenWelcome` viaja en `user` en las respuestas de registro, login y refresh (TS-IAM-001, TS-IAM-002), de modo que la web conoce el estado de la bienvenida sin una petición extra. El registro ya aceptaba `hasSeenWelcome` para el caso de un visitante que vio la bienvenida y luego se registra (SCRUM-17, escenario 3).

## Frontend

El componente de Diango se monta en el *layout* de la aplicación, por lo que aparece en todas las páginas, y solo cuando la sesión ya se ha restaurado.

- **Bienvenida:** Diango aparece centrado con un único bocadillo y un botón «Entendido». Es un diálogo (`role="dialog"`, `aria-modal`); el foco va al botón y Escape también lo cierra. Al cerrarlo se escribe la marca `youpetme:diango-welcome-seen` en `localStorage` y, si hay sesión, se llama a `PUT /users/me/welcome-seen` sin bloquear la interfaz. Después el foco pasa al botón de Diango. Se considera vista si `user.hasSeenWelcome` es `true` (usuario autenticado) o si existe la marca (visitante).
- **Chat:** botón fijo abajo a la derecha (`aria-expanded`, `aria-controls`) que abre un panel no modal. La conversación es una lista `role="log"`; el campo de texto tiene etiqueta y límite de 1000 caracteres; Enter envía y Mayús+Enter hace un salto de línea; «Diango está escribiendo…» es un `role="status"`; Escape cierra el panel y devuelve el foco al botón.
- **Historial:** vive en el estado del componente y se pierde al recargar. Cada petición envía los últimos 20 mensajes, empezando por uno de `user`.
- **Errores:** un aviso con «Reintentar» que conserva el mensaje del usuario. Con `429` explica que ha enviado demasiados mensajes; con cualquier otro error, que Diango no está disponible ahora.
- **Mascota:** un SVG original; la cola se anima con CSS y se desactiva con `prefers-reduced-motion`.
- Todo el texto está en los ficheros de traducción, bajo `assistant.*`.

## Testing

### Unit tests

El caso de uso con un `AIProvider` con guion y el repositorio de animales en memoria (respuesta directa, herramienta con resultado filtrado a `AVAILABLE`, tercera iteración, entrada de herramienta inválida, negativa del modelo, contexto del usuario, fallo del proveedor), el adaptador `fake` y la configuración (`fake` en producción y `anthropic` sin clave fallan).

### Integration tests

Con Testcontainers y el adaptador `fake`: validación (`400`), visitante, usuario autenticado, token inválido (`401`), búsqueda de perros pequeños, límite de peticiones (`429`), fallo del proveedor (`503`), `PUT /users/me/welcome-seen` y `hasSeenWelcome` en login y refresh.

### Component tests

Con axe: la bienvenida (una sola vez, foco, Escape, marca y `PUT`), el chat (envío, historial reenviado, `Bearer` con sesión, error y «Reintentar») y el estado de error.

### End-to-end tests

Un recorrido con el adaptador `fake`: un visitante ve la bienvenida y la cierra, abre el chat, pregunta por perros pequeños y recibe una respuesta con el nombre de un animal real del catálogo. El resto de los recorridos E2E arrancan como visitante recurrente para que la bienvenida no los interrumpa.

El adaptador de Anthropic no tiene test automático: se comprobó a mano con la clave real.

## Limitaciones del MVP

- El límite por IP es en memoria y de un solo proceso; detrás de un proxy hará falta `trust proxy` para ver la IP real (fase de despliegue).
- Un visitante que vio la bienvenida e inicia sesión en una cuenta antigua con `hasSeenWelcome = false` la verá una vez más: solo el registro sincroniza la marca.
- El diálogo de bienvenida no atrapa el foco; tiene un único control y Escape lo cierra.
- Sin memoria entre sesiones, *streaming*, markdown, preguntas sugeridas ni historial persistente.

## Definition of Done

- [x] Chat con herramienta de catálogo, memoria de sesión y contexto básico del usuario.
- [x] Bienvenida de primera visita, para visitantes y usuarios autenticados.
- [x] El adaptador falso está prohibido en producción y no hay claves en el repositorio.
- [x] Errores con el formato de ADR-017, sin códigos nuevos.
- [x] Tests unitarios, de integración, de componente y E2E en verde; adaptador real comprobado a mano.

## Referencias

- ADR-011 — AI Assistant (Diango) Behaviour
- ADR-002 — Authentication Strategy
- ADR-017 — API Error Format
- ARCH-002 — Application Stack
- TS-IAM-001 — User Registration
- TS-IAM-002 — Login
- TS-ANIMALS-001 — Animal Catalogue
- Design System — AI-assisted experiences
