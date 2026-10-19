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
Then queda autenticado y es redirigido al área autenticada
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

## Dependencias

US-IAM-001 — Create Account (necesita una cuenta existente).

## Notas

- El mensaje de error de credenciales inválidas es intencionalmente ambiguo por seguridad (evitar enumeración de cuentas) — ver TS-IAM-002.
