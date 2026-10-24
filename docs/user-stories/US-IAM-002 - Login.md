# US-IAM-002 — Login

## Historia de Usuario

**Como** usuario ya registrado en YouPetMe,
**quiero** iniciar sesión con mi email y contraseña,
**para** acceder a mi cuenta y a las funcionalidades que requieren autenticación.

## Prioridad

MVP / Alta

## Especificación técnica relacionada

TS-IAM-002 — Login

## Acceptance Criteria (BDD)

### Escenario 1: Login exitoso

```gherkin
Given un usuario registrado con la cuenta ACTIVE
When introduce su email y contraseña correctos en /login
Then queda autenticado y es redirigido al área autenticada (la home `/` en estado autenticado)
```

### Escenario 2: Credenciales incorrectas

```gherkin
Given un visitante en /login
When introduce un email no registrado, o un email registrado con una contraseña incorrecta
Then ve el mismo mensaje de error genérico de credenciales inválidas en ambos casos, sin que se le indique cuál de los dos datos falló
```

### Escenario 3: Cuenta no activa

```gherkin
Given una cuenta cuyo status no es ACTIVE (p. ej. SUSPENDED)
When el propietario intenta iniciar sesión con las credenciales correctas
Then ve un mensaje de error indicando que la cuenta no está disponible, sin detalle interno del motivo
```

### Escenario 4: Múltiples sesiones

```gherkin
Given un usuario que ya tiene una sesión activa en otro dispositivo
When inicia sesión desde un dispositivo nuevo
Then se crea una nueva UserSession sin invalidar la sesión existente en el otro dispositivo
```

### Escenario 5: La sesión se mantiene

```gherkin
Given un usuario con sesión activa cuyo access token ha caducado o que recarga la página
When la aplicación necesita autenticarse
Then la sesión se renueva automáticamente sin pedirle credenciales mientras su refresh token siga vigente (7 días desde el último uso)
```

### Escenario 6: Sesión no renovable

```gherkin
Given un usuario cuyo refresh token ha caducado, ha sido revocado o ya fue rotado
When la aplicación intenta renovar la sesión
Then el usuario queda como visitante y debe iniciar sesión de nuevo
```

## Dependencias

US-IAM-001 — Create Account (necesita una cuenta existente).

## Notas

- El mensaje de error de credenciales inválidas es intencionalmente ambiguo por seguridad (evitar enumeración de cuentas) — ver TS-IAM-002.
- La renovación de sesión (`POST /api/v1/auth/refresh`) forma parte de TS-IAM-002 (ADR-002: access token 15 min en memoria, refresh token rotativo 7 días en cookie HttpOnly).
