# US-IAM-001 — Create Account

## Historia de Usuario

**Como** visitante de YouPetMe,
**quiero** crear una cuenta con mis datos personales,
**para** poder acceder a funcionalidades que requieren autenticación (solicitar la adopción de un animal, gestionar mi perfil).

## Prioridad

MVP / Alta

## Especificación técnica relacionada

TS-IAM-001 — User Registration

## Acceptance Criteria (BDD — Given/When/Then, per ADR-013)

### Escenario 1: Registro exitoso con datos válidos

```gherkin
Given un visitante en la página de registro
When rellena el formulario con nombre, apellidos, email, contraseña y confirmación válidos, y acepta los Términos de Servicio y la Política de Privacidad
Then su cuenta se crea, queda autenticado, y es redirigido al área autenticada
```

### Escenario 2: Email ya registrado

```gherkin
Given un visitante en la página de registro
When introduce un email que ya pertenece a una cuenta existente
Then ve un mensaje de error indicando que el email ya está en uso, sin exponer más información de la cuenta existente
```

### Escenario 3: Contraseñas no coinciden

```gherkin
Given un visitante en la página de registro
When la contraseña y su confirmación no coinciden
Then ve un error de validación en el campo de confirmación antes de poder enviar el formulario
```

### Escenario 4: Contraseña no cumple la política

```gherkin
Given un visitante en la página de registro
When introduce una contraseña de menos de 8 caracteres
Then ve un error de validación explicando el requisito mínimo, antes de poder enviar el formulario
```

### Escenario 5: Términos no aceptados

```gherkin
Given un visitante en la página de registro
When intenta enviar el formulario sin marcar la casilla de Términos de Servicio y Política de Privacidad
Then ve un error de validación en esa casilla y el formulario no se envía
```

### Escenario 6: Campos obligatorios vacíos

```gherkin
Given un visitante en la página de registro
When intenta enviar el formulario con algún campo obligatorio vacío
Then ve un error de validación específico para cada campo vacío, y el formulario no se envía
```

## Dependencias

Ninguna — es la primera funcionalidad del proyecto.

## Notas

- La confirmación de contraseña nunca se persiste (TS-IAM-001).
- La aceptación de Términos y Privacidad se registra con su fecha y la versión vigente de los textos (TS-IAM-001). El texto de ambas páginas es estático.
- El algoritmo de hash (Argon2id) y la política de contraseña están definidos en ADR-002.
