# TS-IAM-001 — User Registration

## Identificación

| Campo | Valor |
|---|---|
| Identificador | TS-IAM-001 |
| Historia relacionada | US-IAM-001 — Create Account |
| Módulo | Identity and Access Management (IAM) |
| Prioridad | MVP / Alta |
| Estado | Ready for Development |
| ADR relacionado | ADR-002 — Authentication Strategy |

## Objetivo técnico

Implementar el registro de usuarios de YouPetMe. Un visitante podrá crear una cuenta con sus datos personales y quedará autenticado al finalizar el proceso.

La solución deberá respetar el monolito modular, Clean Architecture y arquitectura hexagonal, usando React con TypeScript en cliente y NestJS, Prisma y PostgreSQL en servidor.

## Flujo funcional

```text
Visitor
  → /register
  → Client validation
  → POST /auth/register
  → RegisterUser use case
      → Normalize email
      → Validate input and password
      → Check duplicate email
      → Hash password
      → Create User, UserProfile and UserSession in one transaction
      → Generate authentication tokens
      → Publish UserCreated event
  → Authenticated application
```

Si la validación de cliente falla, no se realizará la petición y se mostrarán los errores correspondientes. El servidor validará de nuevo toda la entrada; la validación de cliente no sustituye la validación de servidor.

## API

### `POST /auth/register`

Ruta completa bajo el prefijo de la API: `POST /api/v1/auth/register`.

Registra una cuenta y crea una sesión autenticada para el usuario.

#### Request body

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "my-secure-passphrase",
  "confirmPassword": "my-secure-passphrase",
  "termsAccepted": true,
  "hasSeenWelcome": true
}
```

#### Reglas de entrada

| Campo | Reglas |
|---|---|
| `firstName` | Obligatorio; texto válido tras eliminar espacios iniciales y finales; máximo 100 caracteres tras eliminarlos (se cuentan caracteres, no bytes). Si lo supera, error `TOO_LONG`. |
| `lastName` | Obligatorio; texto válido tras eliminar espacios iniciales y finales; máximo 100 caracteres tras eliminarlos (se cuentan caracteres, no bytes). Si lo supera, error `TOO_LONG`. |
| `email` | Obligatorio; formato de correo válido; se normaliza para comparación y almacenamiento; máximo 254 caracteres tras normalizar (longitud máxima de una dirección SMTP). Si lo supera, error `TOO_LONG`. |
| `password` | Obligatorio; debe cumplir la política de contraseña de ADR-002. |
| `termsAccepted` | Obligatorio; debe ser `true` (aceptación de Términos de Servicio y Política de Privacidad). La versión aceptada no la envía el cliente: la determina el servidor. |
| `hasSeenWelcome` | Opcional; booleano. Lo envía el cliente como `true` si el guest ya vio la bienvenida de Diango (localStorage). Si falta, vale `false`. |
| `confirmPassword` | Obligatorio; debe coincidir exactamente con `password`. Se valida, pero no se almacena ni forma parte de ninguna entidad de dominio. |

La política de contraseña es la definida en ADR-002: mínimo 8 caracteres, máximo razonable de 128 y sin reglas de complejidad obligatorias. Debe estar centralizada y ser consistente entre cliente y servidor; el servidor es la fuente de verdad. Lo mismo vale para los máximos de nombre y apellidos (`NAME_MAX_LENGTH` en `packages/contracts`).

#### Protección de la petición

Como este endpoint fija la cookie del refresh token, comprueba además las cabeceras de la petición antes de ejecutar el caso de uso (defensa adicional frente a CSRF, junto a `SameSite` y la lista de orígenes de CORS):

- `Origin`: si está presente y es distinto de `WEB_ORIGIN`, se responde `403 Forbidden`. Si no está presente (curl, pruebas, clientes no navegador), la petición pasa: un navegador siempre envía `Origin` en un POST entre sitios.
- `Content-Type`: si está presente y no es `application/json` (se admite `; charset=…`), se responde `415 Unsupported Media Type`. Si no está presente, la petición pasa.

La comprobación vive en un único lugar reutilizable (guarda de la API) para aplicarla también a los endpoints que leen la cookie (refresh y logout).

#### Response exitosa — `201 Created`

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

El refresh token **no** viaja en el cuerpo de la respuesta. Para el cliente web, conforme a ADR-002, el servidor lo entrega en una cookie `HttpOnly` y `Secure` mediante la cabecera `Set-Cookie`, con la política `SameSite` y el alcance de ruta definidos en ADR-002 y en la configuración del servidor, de modo que JavaScript nunca pueda leerlo. El access token se mantiene en memoria en el cliente. Un cliente móvil futuro podrá recibir el refresh token por otro canal, como indica ADR-002.

Los secretos, hashes y datos internos de sesión nunca se incluirán en la respuesta.

#### Errores esperados

| Código | Caso | Respuesta esperada |
|---|---|---|
| `400 Bad Request` | Datos ausentes o inválidos; contraseña no válida; confirmación distinta; términos no aceptados; nombre o apellidos de más de 100 caracteres (`TOO_LONG`); correo de más de 254 caracteres (`TOO_LONG`). | Error estructurado por campo cuando corresponda. |
| `403 Forbidden` | La cabecera `Origin` está presente y es distinta de `WEB_ORIGIN`. | Error genérico; no se crea la cuenta ni se envía cookie. |
| `409 Conflict` | El correo ya pertenece a una cuenta. | Mensaje de negocio sin exponer información sensible adicional. |
| `415 Unsupported Media Type` | La cabecera `Content-Type` está presente y no es `application/json`. | Error genérico; no se crea la cuenta ni se envía cookie. |
| `500 Internal Server Error` | Error inesperado. | Error genérico; no revelar detalles internos. |

## Modelo de datos

### `User`

Representa la identidad y las credenciales de una cuenta.

| Campo | Descripción |
|---|---|
| `id` | UUID, identificador primario generado por el sistema. |
| `email` | Correo normalizado, obligatorio y único mediante restricción de base de datos. |
| `passwordHash` | Hash de la contraseña. Nunca se persiste la contraseña en texto plano. |
| `role` | Rol del usuario. Todo registro público crea una cuenta `USER`; `ADMIN` no se crea por registro (Domain Model — Roles). |
| `status` | Estado de la cuenta. Para un registro completado en el MVP: `ACTIVE`. |
| `termsAcceptedAt` | Fecha y hora en que el usuario aceptó Términos y Privacidad al registrarse. |
| `termsVersion` | Identificador de la versión vigente de los textos en ese momento, tomado de la configuración del servidor. |
| `createdAt`, `updatedAt` | Marcas temporales de auditoría. |

El hashing usa Argon2id con los parámetros definidos en ADR-002; la implementación deberá usar una abstracción de hashing (puerto) para no acoplar el caso de uso a una librería concreta.

### `UserProfile`

Representa los datos de perfil iniciales asociados uno a uno a `User`.

| Campo | Descripción |
|---|---|
| `id` | UUID, identificador primario. |
| `userId` | UUID; relación única y obligatoria con `User`. |
| `firstName` | Nombre del usuario (máximo 100 caracteres; también restringido en base de datos). |
| `lastName` | Apellidos del usuario (máximo 100 caracteres; también restringido en base de datos). |
| `hasSeenWelcome` | Booleano; empieza en `false` (o en `true` si el cliente informa de que el guest ya vio la bienvenida de Diango, ADR-011). |
| `matchingPreferences` | Opcional; empieza en `null`. Solo se rellena si el usuario acepta las preferencias de matching que el cliente conservaba como guest (ADR-010). |
| `createdAt`, `updatedAt` | Marcas temporales de auditoría. |

### `UserSession`

Representa una sesión revocable del usuario.

| Campo | Descripción |
|---|---|
| `id` | UUID, identificador primario. |
| `userId` | UUID; relación obligatoria con `User`. |
| `refreshTokenHash` | Hash del material de refresh token, nunca el token en texto plano. |
| `status` | Estado de sesión, inicialmente `ACTIVE`. |
| `expiresAt` | Fecha de expiración de la sesión: la del refresh token vigente (7 días, ADR-002), que se renueva con cada rotación. |
| `createdAt`, `updatedAt` | Marcas temporales de auditoría. |

La estructura exacta de tokens, la expiración, la revocación y el transporte deberán cumplir ADR-002.

## Reglas de persistencia y consistencia

- `User`, `UserProfile` y `UserSession` se crearán en una única transacción de base de datos.
- Si cualquiera de las operaciones falla, no deberá quedar una cuenta parcial ni una sesión huérfana.
- La unicidad del correo deberá comprobarse en el caso de uso para ofrecer un error de negocio claro y reforzarse con una restricción única en PostgreSQL para evitar condiciones de carrera.
- Ante una violación de unicidad producida por concurrencia, se traducirá a `409 Conflict`.

## Frontend

La ruta pública `/register` incluirá un formulario para `firstName`, `lastName`, `email`, `password` y `confirmPassword`, más una casilla obligatoria de aceptación de Términos de Servicio y Política de Privacidad con enlaces a ambas páginas (textos estáticos).

- Validará los datos antes de enviar y mostrará errores claros, accesibles y asociados a cada campo.
- Deshabilitará o protegerá el envío repetido mientras la petición esté en curso.
- Mostrará los errores de negocio y validación devueltos por la API.
- Tras una respuesta exitosa, actualizará el estado de autenticación conforme a ADR-002 y redirigirá al área autenticada definida por el producto.
- No registrará ni expondrá contraseñas, tokens o respuestas sensibles en consola, analítica o mensajes de error.

## Evento de dominio

Al completar correctamente la transacción se publicará el evento `UserCreated`.

El evento contendrá únicamente los datos mínimos no sensibles necesarios para consumidores posteriores, como `userId`, `email`, `occurredAt` y un identificador de correlación cuando esté disponible. No incluirá contraseña, hash ni tokens.

La publicación deberá ocurrir únicamente cuando la creación se haya confirmado. La estrategia de publicación está definida en ADR-016 (despacho en proceso tras el commit, detrás de un puerto `EventPublisher`).

## Testing

### Unit tests

- Normalización de email y límite de 254 caracteres (`TOO_LONG`).
- Límite de 100 caracteres en nombre y apellidos (`TOO_LONG`), contados como caracteres.
- Guarda de `Origin` y `Content-Type`: origen ajeno (403), tipo no JSON (415), sin cabeceras (pasa).
- Reglas de validación de registro y coincidencia de contraseñas.
- Rechazo de correo duplicado.
- Rechazo cuando `termsAccepted` falta o no es `true`.
- Registro de `termsAcceptedAt` y `termsVersion` al crear el usuario.
- `UserProfile` nace con `hasSeenWelcome` según lo enviado (por defecto `false`) y `matchingPreferences = null`.
- Orquestación del caso de uso: hash, creación de entidades, sesión y evento.
- No persistencia de `confirmPassword` ni contraseñas en texto plano.

### Integration tests

- Endpoint `POST /auth/register` con PostgreSQL y Prisma.
- Persistencia atómica de `User`, `UserProfile` y `UserSession`.
- Restricción única de email y traducción correcta a `409 Conflict`.
- Respuesta de autenticación sin secretos internos, con el refresh token únicamente en la cookie `HttpOnly` y no en el cuerpo.
- Rechazo con `415` de cuerpos `application/x-www-form-urlencoded` y `text/plain`, y con `403` de un `Origin` ajeno, sin crear la cuenta ni enviar cookie; aceptación de `WEB_ORIGIN` y de peticiones sin `Origin`.
- Nombre o apellidos de 101 caracteres rechazados con `TOO_LONG` y de 100 aceptados; restricción `CHECK` en base de datos.
- Correo de 255 caracteres rechazado con `TOO_LONG` y de 254 aceptado.

### End-to-end tests

- Registro completo desde `/register` hasta el acceso al área autenticada.
- Errores de validación visibles en el formulario, incluido el envío sin aceptar términos.
- Manejo de correo previamente registrado.

### Manual testing

- Verificar el registro con datos válidos y el inicio de sesión posterior.
- Verificar redirección, persistencia de sesión y logout conforme a ADR-002.
- Revisar que no aparezcan contraseñas, hashes ni tokens en interfaz, consola o registros accesibles.

## Definition of Done

- [ ] El visitante puede crear una cuenta válida desde `/register`.
- [ ] Cliente y servidor validan todos los campos requeridos.
- [ ] `confirmPassword` se valida y nunca se almacena.
- [ ] La aceptación de términos es obligatoria y se guarda con fecha y versión (`termsAcceptedAt`, `termsVersion`).
- [ ] Los correos se normalizan y están protegidos por una restricción única en base de datos.
- [ ] Las contraseñas se almacenan únicamente como hash según ADR-002.
- [ ] `User`, `UserProfile` y `UserSession` se crean de forma atómica y con UUID.
- [ ] El usuario queda autenticado tras el registro conforme a ADR-002: access token en el cuerpo y refresh token en cookie `HttpOnly`.
- [ ] Los errores de validación y correo duplicado son claros y seguros.
- [ ] Nombre y apellidos tienen un máximo de 100 caracteres y el correo de 254, validados en servidor.
- [ ] La petición de registro rechaza un `Origin` ajeno (403) y un `Content-Type` distinto de JSON (415) mediante una guarda reutilizable.
- [ ] Se publica `UserCreated` sin datos sensibles tras una creación confirmada.
- [ ] Las pruebas unitarias, de integración y E2E definidas pasan.
- [ ] Se ha realizado la comprobación manual de los flujos principales y de seguridad básica.
- [ ] La documentación de API, variables de entorno y decisiones pendientes queda actualizada.

## Referencias

- US-IAM-001 — Create Account
- ADR-002 — Authentication Strategy
- ADR-016 — Domain Event Delivery
