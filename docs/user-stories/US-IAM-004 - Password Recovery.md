# US-IAM-004 — Password Recovery

## Historia de Usuario

**Como** usuario registrado que ha olvidado su contraseña,
**quiero** poder restablecerla de forma segura a través de mi email,
**para** recuperar el acceso a mi cuenta sin depender de soporte manual.

## Prioridad

MVP / Alta

## Especificación técnica relacionada

TS-IAM-004 — Password Recovery
ADR-014 — Transactional Email Delivery

## Acceptance Criteria (BDD)

### Escenario 1: Solicitud de reseteo con email existente

```gherkin
Given un visitante en /forgot-password
When introduce el email de una cuenta existente y lo envía
Then recibe un email con un enlace de reseteo, y ve en pantalla un mensaje de confirmación genérico
```

### Escenario 2: Solicitud de reseteo con email inexistente

```gherkin
Given un visitante en /forgot-password
When introduce un email que no corresponde a ninguna cuenta y lo envía
Then ve exactamente el mismo mensaje de confirmación genérico que en el Escenario 1, sin indicar que el email no existe
```

### Escenario 3: Reseteo exitoso con token válido

```gherkin
Given un usuario que ha recibido un enlace de reseteo válido y no expirado
When introduce una nueva contraseña válida y su confirmación, y la envía
Then su contraseña queda actualizada, todas sus sesiones activas quedan revocadas, y puede iniciar sesión con la nueva contraseña
```

### Escenario 4: Token expirado o ya usado

```gherkin
Given un enlace de reseteo que ya expiró, o que ya fue usado previamente
When el usuario intenta usarlo para establecer una nueva contraseña
Then ve un mensaje de error genérico indicando que el enlace ya no es válido, con la opción de solicitar uno nuevo
```

### Escenario 5: Nueva contraseña no cumple la política

```gherkin
Given un usuario con un token de reseteo válido
When introduce una nueva contraseña de menos de 8 caracteres
Then ve un error de validación antes de poder enviar el formulario
```

## Dependencias

US-IAM-001 — Create Account (necesita una cuenta existente).
ADR-014 — Transactional Email Delivery (Resend debe estar configurado antes de implementar).

## Notas

- El token de reseteo expira a las 2 horas y es de un solo uso — ver TS-IAM-004.
- En desarrollo/test no se envían emails reales — se usa un adaptador de consola/in-memory (ADR-014).
