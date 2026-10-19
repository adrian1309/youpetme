# US-IAM-003 — Logout

## Historia de Usuario

**Como** usuario autenticado en YouPetMe,
**quiero** cerrar mi sesión,
**para** proteger mi cuenta cuando termino de usar la plataforma, especialmente en un dispositivo compartido.

## Prioridad

MVP / Alta

## Especificación técnica relacionada

TS-IAM-003 — Logout

## Acceptance Criteria (BDD)

### Escenario 1: Logout exitoso

```gherkin
Given un usuario autenticado en cualquier vista de la aplicación
When pulsa la acción de "Cerrar sesión"
Then su sesión actual queda revocada en el servidor y es redirigido a una vista pública
```

### Escenario 2: Solo se revoca la sesión actual

```gherkin
Given un usuario con sesiones activas en dos dispositivos distintos
When cierra sesión en el dispositivo A
Then la sesión del dispositivo B permanece activa
```

### Escenario 3: Fallo de red durante logout

```gherkin
Given un usuario autenticado que pulsa "Cerrar sesión"
When la petición al servidor falla por un problema de red
Then el estado de autenticación en el cliente se limpia igualmente, dejando al usuario en estado no autenticado
```

## Dependencias

US-IAM-002 — Login (necesita una sesión activa que cerrar).

## Notas

- El cierre de sesión en cliente nunca depende de que la petición al servidor tenga éxito — ver TS-IAM-003.
