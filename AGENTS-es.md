# AGENTS.md (traducción al español — solo para lectura)

> **Nota**: este archivo es una traducción para que lo entiendas mejor y más rápido. El documento oficial del repositorio sigue en inglés (`AGENTS.md`), tal como decidiste, para que Claude Code trabaje mejor con él. No sustituyas el original por este.

## Propósito

YouPetMe es un Trabajo Fin de Máster (TFM) — una plataforma de adopción de animales.

Este archivo define las reglas de funcionamiento para agentes de codificación con IA y colaboradores. Estas reglas se aplican junto con la documentación oficial en `docs/`.

## Estado actual

El proyecto está en fase de fundación de arquitectura.

No implementar ninguna funcionalidad hasta que su Historia de Usuario, Especificación Técnica y los ADRs aplicables hayan sido revisados y estén suficientemente definidos.

## Fuente de verdad
# PostgreSQL local; almacenamiento S3-compatible previsto (ARCH-002, ADR-015)
La documentación oficial y versionada vive en `docs/`. Consultar los documentos relevantes antes de tocar código:

| Carpeta                | Contiene                                            | Documentos clave                                                                                                                                                    |
| ---------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/product/`        | Alcance de producto, decisiones del MVP             | Project Overview, Product Definition, Functional Map, MVP                                                                                                           |
| `docs/requirements/`   | Gestión de requisitos, trazabilidad                 | Requirements Overview, Non Functional Requirements                                                                                                                  |
| `docs/user-stories/`   | Objetivos de usuario, criterios de aceptación       | —                                                                                                                                                                   |
| `docs/specifications/` | Comportamiento técnico, expectativas de testing     | p. ej. TS-IAM-001                                                                                                                                                   |
| `docs/adr/`            | Decisiones de arquitectura aceptadas                | ADR-002 en adelante — ver esta carpeta o el README para la lista completa actualizada; va creciendo con el tiempo                                                   |
| `docs/architecture/`   | Estructura, convenciones, flujo de entrega          | ARCH-001 (estructura de repositorio/módulos), ARCH-002 (stack tecnológico completo y decisiones explícitamente descartadas), ARCH-003 (ramas/CI/Definition of Done) |
| `docs/ux-ui/`          | Flujos de usuario, wireframes, decisiones de diseño | Design System, Authentication Flow, Wireframes Authentication                                                                                                       |

ARCH-002 es la fuente autoritativa para el stack tecnológico exacto actual (librerías, herramientas, y qué se decidió deliberadamente **no** adoptar y por qué) — no asumir que una librería está en uso, ni introducir una nueva, sin comprobarlo antes ahí.

Si la documentación entra en conflicto, usar este orden de precedencia:

```text
ADR aceptado
→ Documento de arquitectura
→ Especificación técnica
→ Historia de usuario
→ Nota de producto o exploratoria
```

Reportar cualquier contradicción material en vez de elegir silenciosamente un comportamiento distinto.

### Planificado: Jira y Figma como fuente de verdad para historias y diseño

Aún no implementado; anotado aquí para que no se pierda. La intención es que **Jira** se convierta en la fuente de verdad para Historias de Usuario y Epics (sustituyendo `docs/user-stories/`), y **Figma** en la fuente de verdad para diseño UI/UX y wireframes (sustituyendo `docs/ux-ui/wireframes/` y, donde aplique, `docs/ux-ui/flows/`). Una vez hecha esta migración, se espera que Claude Code lea el estado y contenido de las Historias de Usuario desde Jira y el detalle de diseño desde Figma (probablemente vía integraciones MCP para cada uno), y que pueda actualizar el estado de una historia en Jira a medida que avanza el trabajo, en vez de depender solo de los documentos Markdown actuales del repositorio. Hasta que esto esté realmente configurado y esta nota se sustituya por instrucciones concretas, la fuente de verdad actual basada en `docs/` descrita arriba sigue siendo la válida.

### Planificado: arquitectura de subagentes para entregar Historias de Usuario

Aún no implementado; anotado aquí para que no se pierda. La intención es definir un conjunto de subagentes de Claude Code (`.claude/agents/`), cada uno centrado en una etapa de la entrega de una Historia de Usuario, para que el agente principal de Claude Code pueda delegar automáticamente según la tarea y la descripción de cada subagente, sin que el dueño del proyecto tenga que invocar manualmente cada etapa:

- **jira-reader** — lee el contenido y estado de una Historia de Usuario desde Jira (depende de la integración con Jira anotada arriba); acceso a herramientas limitado al conector MCP de Jira.
- **implementer** — implementa la Historia de Usuario siguiendo Test-Driven Development (Red → Green → Refactor, arriba); acceso a herramientas de edición de archivos y ejecución de tests.
- **reviewer** — revisa y refactoriza código ya implementado, manteniendo todos los tests en verde.
- **tester** — escribe y ejecuta tests unitarios, de integración y end-to-end según la estrategia de testing de ARCH-002.

La descripción de cada subagente debe ser lo bastante específica para que la delegación automática de Claude Code enrute las tareas correctamente. Esto depende de la migración a Jira/Figma de arriba específicamente para `jira-reader`; los otros tres subagentes no dependen de ella. Hasta que estos se creen realmente y esta nota se sustituya por configuración concreta, no debe asumirse que existe ninguna delegación a subagentes.

## Reglas de arquitectura

- Usar un monorepo TypeScript gestionado con pnpm workspaces y Turborepo.
- Construir la API como un monolito modular NestJS organizado por módulo de negocio.
- Aplicar principios de Clean Architecture y Hexagonal Architecture en los módulos del backend.
- Mantener esta dirección de dependencias:

```text
presentation → application → domain
infrastructure → application/domain ports
```

- El código de dominio no debe depender de NestJS, Prisma, HTTP ni proveedores concretos de infraestructura.
- Prisma pertenece a infraestructura y no debe filtrarse a los modelos de dominio ni a los contratos públicos.
- `packages/contracts` contiene únicamente contratos públicos de transporte de la API. Nunca colocar ahí entidades de dominio, tipos de Prisma, credenciales o lógica de negocio.
- Los endpoints REST usan el prefijo `/api/v1`.
- Aplicar autenticación y autorización en la API; la protección de rutas en el frontend es solo una medida de experiencia de usuario.

### Estructura del repositorio

`apps/web` y `apps/api` son ejecutables de forma independiente:

```text
youpetme/
├── apps/
│   ├── web/                         # Cliente React + TypeScript (ADR-007)
│   │   ├── src/
│   │   │   ├── app/                 # Arranque, providers, configuración de rutas
│   │   │   ├── features/            # UI orientada a funcionalidad, ej. iam/register
│   │   │   ├── components/          # Componentes UI reutilizables, neutrales al dominio
│   │   │   ├── lib/                 # Cliente HTTP y pequeñas utilidades técnicas
│   │   │   ├── styles/              # Estilos globales y tokens de diseño
│   │   │   └── test/                # Configuración de test y utilidades reutilizables
│   │   └── e2e/                     # Tests E2E de Playwright (ARCH-002)
│   └── api/                         # API NestJS + Prisma
│       ├── src/
│       │   ├── app/
│       │   ├── modules/
│       │   │   └── <módulo>/        # ej. iam, animals, adoptions, shelters, ai
│       │   │       ├── domain/
│       │   │       │   ├── entities/
│       │   │       │   ├── value-objects/
│       │   │       │   ├── events/
│       │   │       │   └── ports/
│       │   │       ├── application/
│       │   │       │   ├── use-cases/
│       │   │       │   ├── commands/
│       │   │       │   └── dto/
│       │   │       ├── infrastructure/
│       │   │       │   ├── persistence/prisma/
│       │   │       │   ├── security/
│       │   │       │   └── events/
│       │   │       ├── presentation/http/
│       │   │       └── <módulo>.module
│       │   └── platform/            # Transversal: configuración, base de datos, logging, health
│       └── test/                    # Tests E2E de la API (convención NestJS/ARCH-002)
├── packages/
│   ├── contracts/                   # Solo contratos públicos de transporte de la API
│   └── config/                      # Configuración compartida de herramientas
├── docs/                            # Documentación oficial versionada (ver Fuente de verdad)
├── infra/
│   └── docker/                      # PostgreSQL local; almacenamiento S3-compatible previsto (ARCH-002, ADR-015)
├── .github/workflows/               # CI (ARCH-003)
├── .env.example
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

Todos los módulos bajo `apps/api/src/modules/` siguen la misma subdivisión `domain/application/infrastructure/presentation` mostrada arriba para `iam` (ARCH-001) — no inventar una forma interna distinta para un módulo nuevo.

**Ubicación y nomenclatura de los tests** (ver ARCH-002 para el detalle completo): los tests unitarios se ubican junto al código que testean (`.spec.ts`); los de integración se ubican junto al adaptador de infraestructura que testean (`.integration-spec.ts`); los E2E viven en `apps/api/test/` y `apps/web/e2e/` (`.e2e-spec.ts`). Los builds de producción excluyen todos los archivos de test, las carpetas `test/`/`e2e/`, `docs/`, y cualquier `.env*` que no sea `.env.example`.

### Comandos habituales

Scripts raíz definidos en `package.json` y orquestados por Turborepo (`turbo.json`). Se corresponden 1:1 con los pasos de CI de ARCH-003 (`.github/workflows/ci.yml`).

```text
pnpm install            # instalar dependencias (la CI usa --frozen-lockfile)
pnpm dev                # levantar apps/web (Vite) y apps/api (nest start --watch) en desarrollo
pnpm lint               # ESLint en todo el monorepo
pnpm format             # Prettier, escribe cambios
pnpm format:check       # Prettier, solo verificación (CI)
pnpm typecheck          # comprobación de tipos TypeScript
pnpm test               # unit + component tests (Vitest para web, Jest para API — ADR-005)
pnpm test:integration   # tests de integración de la API, *.integration-spec.ts (Jest — ARCH-002); pasa sin tests
pnpm build              # build de producción
```

Los scripts de cada workspace se ejecutan con `pnpm --filter <nombre> <script>` (workspaces: `@youpetme/web`, `@youpetme/api`, `@youpetme/contracts`, `@youpetme/config`).

Aún no disponibles: `pnpm test:e2e` (Playwright se añade con el primer recorrido E2E), Testcontainers para los tests de integración y los scripts de Prisma (se añaden con la primera historia de persistencia). No asumir que existe ningún otro script sin comprobar `package.json`/`turbo.json` primero.

### Testing manual de la API

Usar `curl` desde la terminal (Claude Code puede ejecutarlo directamente como parte de su propio flujo) para comprobaciones manuales puntuales contra una API en marcha — p. ej. verificar un endpoint recién implementado. No introducir Postman ni un cliente gráfico similar: Swagger UI (ARCH-002) ya ofrece una forma interactiva de explorar y probar endpoints, y una comprobación por terminal con `curl` mantiene la verificación manual dentro del propio flujo de Claude Code en vez de una herramienta externa aparte con su propia cuenta y colecciones guardadas que mantener.

## Reglas de seguridad y datos

- Nunca commitear secretos, credenciales o archivos `.env` reales.
- Mantener `.env.example` limitado a valores ficticios y descripciones de variables.
- Nunca loguear ni exponer contraseñas, hashes de contraseñas, access tokens, refresh tokens o secretos de sesión.
- Almacenar las contraseñas únicamente como hash seguro.
- Seguir ADR-002 para autenticación, tokens y sesiones.
- Tratar las restricciones de base de datos como salvaguarda de integridad autoritativa, además de la validación de aplicación.

## Flujo de trabajo de desarrollo

Antes de implementar:

1. Identificar la Historia de Usuario y la Especificación Técnica relacionadas.
2. Comprobar los ADRs aplicables y las restricciones de arquitectura.
3. Evaluar el impacto en validación, autorización, privacidad y migraciones.
4. Identificar los escenarios de test unitarios, de integración y end-to-end, incluyendo los casos de fallo.

Durante la implementación:

- Mantener los cambios centrados en un propósito coherente.
- No introducir refactors ni cambios de formato no relacionados.
- Usar nombres claros y preservar los límites de módulo.
- Añadir o actualizar los tests apropiados al comportamiento modificado.
- Actualizar documentación, contratos de API y migraciones cuando sea necesario.

### El Desarrollo Guiado por Tests (TDD) es obligatorio

Según **ADR-013 — Development Methodology: SDD, BDD and TDD**, todo comportamiento nuevo (a nivel unitario y, donde aplique, de integración) se implementa test-first. Esto no es opcional ni "mejor esfuerzo":

1. **Red (rojo)** — escribir un test que falle y que exprese el comportamiento esperado (normalmente un escenario Given/When/Then de los Acceptance Criteria del Use Case) antes de escribir ningún código de implementación para ello.
2. **Green (verde)** — escribir el código de implementación mínimo necesario para que ese test pase. No implementar más de lo que el test actual requiere.
3. **Refactor** — mejorar la estructura de la implementación (nombres, duplicación, claridad) manteniendo todos los tests en verde, incluido el que se acaba de añadir.

No escribir código de implementación de un comportamiento nuevo antes de que exista su test en fallo. Los spikes exploratorios pensados para desecharse son la única excepción, y no deben mergearse tal cual — una vez validado el enfoque, se reimplementa siguiendo Red → Green → Refactor.

## Reglas de Git y entrega

- `main` es la única rama permanente y debe permanecer siempre desplegable.
- No commitear directamente a `main`.
- Usar ramas de corta duración con el nombre `codex/<tipo>/<ámbito>-<descripción-corta>`.
- Usar Conventional Commits: `<tipo>(<ámbito>): <resumen en imperativo>`.
- No usar operaciones destructivas de Git ni force push salvo instrucción explícita.
- No commitear secretos generados, configuración local o archivos no relacionados.
- Los Pull Requests deben incluir referencias a la documentación relevante y evidencia de verificación.

### Resumen al terminar una Historia de Usuario

Cuando se completa una Historia de Usuario (cumple su Definition of Done, ARCH-003/Requirements Overview), aportar un resumen que cubra:

- Qué Historia de Usuario/Use Case se completó, y sus Acceptance Criteria.
- Decisiones tomadas durante la implementación que no estaban ya fijadas por la documentación existente — señalar las que parezcan lo bastante significativas como para merecer su propio ADR, en vez de decidir en silencio y seguir adelante.
- Cualquier cosa que se haya desviado del plan original (Technical Design, Use Case), y por qué.
- Cobertura de tests añadida, siguiendo el ciclo Red → Green → Refactor (El Desarrollo Guiado por Tests es obligatorio, arriba).
- Cualquier incertidumbre o contradicción de documentación encontrada por el camino (según Ante la incertidumbre, más abajo), aunque se haya resuelto.

Mantenerlo conciso — es un resumen para que el dueño del proyecto lo revise rápido, no una duplicación de la descripción del PR.

## Convenciones de documentación

- La documentación técnica, el código, los identificadores, los mensajes de commit y los contratos de API usan inglés.
- La comunicación con el dueño del proyecto puede ser en español.
- Usar Markdown para la documentación.
- Usar Mermaid cuando un diagrama aclare una relación mejor que la prosa.
- Mantener los diagramas cerca del documento al que dan soporte.
- No duplicar documentos oficiales del repositorio en sistemas de notas personales; enlazar a la versión del repositorio en su lugar.

## Ante la incertidumbre

No inventar comportamiento de negocio, reglas de seguridad ni decisiones de arquitectura.

Expresar la incertidumbre, identificar la documentación afectada, y pedir una decisión antes de implementar un cambio material.

Esto aplica con más peso todavía a la puesta en marcha del proyecto y a cualquier acción difícil de deshacer: nunca inventar ni asumir un prerequisito, número de versión, valor de secreto o paso de configuración que falte (ver README — Getting Started); nunca generar, sobrescribir o adivinar valores de `.env`/secretos en nombre del dueño del proyecto; y nunca ejecutar un comando que instale software, resetee una base de datos o un volumen de Docker, o sea de otro modo destructivo, sin preguntar antes. Cuando la sección Getting Started del README esté marcada como "aún no confirmada", tratarla como un plan a verificar con el dueño del proyecto, no como instrucciones para ejecutar sin supervisión.