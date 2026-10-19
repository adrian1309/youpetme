# US-IAM-005 — View and Edit Profile

## Historia de Usuario

**Como** usuario autenticado en YouPetMe,
**quiero** ver y editar mi nombre y apellidos,
**para** mantener mis datos de perfil correctos.

## Prioridad

MVP / Media

## Especificación técnica relacionada

TS-IAM-005 — User Profile

## Acceptance Criteria (BDD)

### Escenario 1: Ver el propio perfil

```gherkin
Given un usuario autenticado
When accede a su vista de perfil
Then ve su nombre, apellidos y email actuales
```

### Escenario 2: Editar nombre y apellidos con éxito

```gherkin
Given un usuario autenticado en su vista de perfil
When modifica su nombre y/o apellidos con valores válidos y guarda
Then los cambios se persisten y ve una confirmación de éxito
```

### Escenario 3: Editar con campos vacíos

```gherkin
Given un usuario autenticado en su vista de perfil
When intenta guardar con el nombre o los apellidos vacíos
Then ve un error de validación y los cambios no se guardan
```

### Escenario 4: No se puede editar el email desde el perfil

```gherkin
Given un usuario autenticado en su vista de perfil
When revisa las opciones de edición disponibles
Then el email no aparece como campo editable (fuera de alcance del MVP, ver TS-IAM-005)
```

## Dependencias

US-IAM-001 — Create Account (necesita una cuenta existente).

## Notas

- Cambio de email, cambio de contraseña desde el perfil, y campos de `AdopterProfile` (teléfono, vivienda, etc.) están explícitamente fuera de alcance del MVP — ver TS-IAM-005.
