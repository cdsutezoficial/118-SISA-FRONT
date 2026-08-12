# Plan de implementación — Director de División (picker acoplado al rol)

**Fecha**: 2026-07-28
**Estado**: PENDIENTE (bloqueado hasta que cierre `118-SISA-BACK/docs/plans/2026-07-28-director-division-role-filter.md`)

## Contexto

`DivisionesForm.tsx` pide hoy `directorPersonId` como un input de texto crudo (UUID tipeado a mano) — comentario en el código: "no person-search/picker exists yet in the system", que ya no es cierto (existe `GET /persons?search=` desde el trabajo de Usuarios). José decidió además que el picker debe mostrar **solo** personas que ya tienen el rol `DIRECTOR_DIVISION` asignado para esa división — no cualquier persona.

## Decisión de secuencia (confirmada con José, 2026-07-28)

Como el rol requiere que la división ya exista, **el campo Director desaparece del modo "Registrar División"** y solo aparece en modo **"Editar División"**. Flujo operativo real: crear división sin director → registrar/buscar la persona en Usuarios → asignarle el rol `DIRECTOR_DIVISION` con scope a esa división (Asignar Rol) → editar la división y elegirla del picker.

## Alcance

### `DivisionesForm.tsx`
- Modo Registrar: sin campo Director (ni oculto ni deshabilitado — no tiene sentido mostrarlo si nunca puede tener candidatos).
- Modo Editar: campo "Director de División" — buscador contra `GET /users?role=DIRECTOR_DIVISION&divisionId=<id de esta división>&status=ACTIVE`, muestra nombre completo + correo, selecciona y guarda el `personId` de ese usuario (el endpoint ya devuelve `personId` por fila). Si no hay resultados, mensaje explicativo: "Ningún usuario tiene el rol de Director asignado a esta división todavía. Asígnalo primero desde Usuarios." con link a Asignar Rol.
- Si la división ya tiene un `directorPersonId` guardado que YA NO aparece en la lista de candidatos (le revocaron el rol después de ser asignado como director), mostrarlo igual como seleccionado (resolver su nombre vía el propio catálogo de usuarios si es posible) para no perder el dato silenciosamente, con una nota de que ya no tiene el rol activo.

## Fuera de alcance

- No se agrega ninguna validación server-side nueva en `academic_config` — la restricción vive solo en qué le ofrece el picker.

## Registro de ejecución

**Fecha**: 2026-07-28 · **Estado**: COMPLETADO

**Archivos modificados**: `src/app/pages/DivisionesForm.tsx` — nuevo componente `DirectorField` (buscador contra `GET /users?role=DIRECTOR_DIVISION&divisionId=<id>&status=ACTIVE`), reemplaza el input de UUID crudo. El campo completo (label + picker + ayuda) queda oculto en modo Registrar (`!isRegister`), visible en Ver/Editar.

**Decisiones tomadas al implementar**:
- **Director "stale" (rol revocado después de asignado)**: no existe `GET /persons/{id}` para resolver el nombre de alguien que ya no aparece en la lista de candidatos (porque le revocaron el rol). Se muestra el UUID crudo guardado + una nota ámbar explicando que ese director ya no tiene el rol activo, en vez de intentar resolver un nombre que el backend no puede darnos hoy.
- En modo Ver (`disabled`), el campo se muestra como texto plano (nombre — username si se resuelve, o el id crudo si es un director "stale"), sin dropdown.
- El estado `directorPersonId` sigue existiendo aunque el campo esté oculto en Registrar — al enviar el payload, viaja como `null` (mismo comportamiento que antes: división se crea sin director).

**Verificación**: `npx tsc --noEmit` — 0 errores.
