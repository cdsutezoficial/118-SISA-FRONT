# Plan de implementación — Usuarios (wiring completo)

**Fecha**: 2026-07-28
**Estado**: PENDIENTE (bloqueado hasta que cierre `118-SISA-BACK/docs/plans/2026-07-28-persons-and-user-management.md`)
**Repos involucrados**: `118-SISA-BACK` (backend nuevo, ver plan arriba) · `118-SISA-FRONT` (este plan)

## Contexto

`UsuariosList.tsx` ya está cableado (`GET /users`, solo lectura). `UsuariosForm.tsx`, `UsuarioDetalle.tsx`, `AsignarRol.tsx` siguen mock. Al investigar el wiring real se descubrió que crear un `User` requiere un `Person` pre-existente, y que el backend de `identity` no tenía forma de crear/buscar `Person`, ni de ver detalle/revocar rol/desbloquear un `User` — de ahí el plan de backend paralelo.

## Decisiones confirmadas con José (2026-07-28)

1. Jefatura de Estadías / Asistente de Estadías son roles de **scope global**, no de división — el catálogo actual de `SCOPED_ROLES` en `UsuariosForm.tsx`/`AsignarRol.tsx` está mal (los incluye como si fueran de división). El set correcto de roles con scope de división es: `GESTOR_ACADEMICO`, `DIRECTOR_DIVISION`, `COORDINACION_ESTADIAS_DIVISION` — coincide con lo que el backend ya valida (`DIVISION_SCOPED_ROLES`).
2. "Registrar Usuario" es un **Wizard de 2 pasos** (Persona → Cuenta), no un form plano — porque crear un usuario siempre requiere una Persona primero, y casi nunca existe todavía cuando alguien llega a esta pantalla.
3. El modo **"Editar" de `UsuariosForm.tsx` se elimina** — no existe `PUT /users/{id}` a propósito (nada de `User` es editable así); las únicas mutaciones reales son roles (asignar/revocar) y desbloqueo, que tienen sus propias acciones.
4. `UsuarioDetalle.tsx` muestra la información de la `Person` asociada junto con la gestión de roles (asignar/revocar) — es la pantalla de gestión del usuario, no un simple visor de solo-lectura.

## Alcance

### `UsuariosForm.tsx` → se convierte en Wizard de registro (solo modo "register" sobrevive; se elimina el modo "edit")

- **Paso 1 — Persona**: buscador (`SearchSelectField` contra `GET /persons?search=`) para seleccionar una persona existente (excluir/marcar las que ya tienen `hasUser: true`). Si no aparece, botón "+ Crear nueva persona" despliega inline: CURP, Nombre(s), Apellido Paterno, Apellido Materno (opcional), Correo Institucional.
- **Paso 2 — Cuenta**: muestra el correo institucional (será el username, solo lectura), campo Contraseña Temporal (ayuda: "el usuario deberá cambiarla en su primer acceso").
- Al finalizar: si el Paso 1 fue "crear nueva", `POST /persons` primero (obtiene `id`); luego `POST /users` con ese `personId` + la contraseña temporal. Si fue "seleccionar existente", solo `POST /users`.
- Redirige a `AsignarRol.tsx` para el usuario recién creado (con su `userId`) — crear un usuario sin ningún rol no tiene sentido operativo.

### `UsuarioDetalle.tsx` → reescritura completa, deja de ser mock

- `GET /users/{id}` — info general (nombre completo, CURP, correo, username, estado, último acceso).
- Lista de roles asignados (`roleType`, `divisionId` si aplica) con botón "Revocar" por fila → `DELETE /users/{userId}/roles/{userRoleId}` + confirmación (modal, mismo patrón que otras acciones destructivas del proyecto).
- Botón "Asignar Rol" → navega a `AsignarRol.tsx?userId=...`.
- Botón "Desbloquear cuenta" — **visible solo si `status === 'LOCKED'`** → `PATCH /users/{id}/unlock`.
- Se elimina la pestaña "Historial de Accesos" del mock actual — no hay ningún endpoint que devuelva histórico de accesos (`lastLoginAt` es el único dato disponible, ya se muestra en la info general).

### `AsignarRol.tsx` → wiring + corrección de catálogo

- Corregir el set de roles con scope de división (ver decisión #1 arriba).
- Tomar `userId` por query param (hoy la ruta no lo recibe).
- `POST /users/{userId}/roles` con `{roleType, divisionId}` (`divisionId` solo si el rol es de scope división).

### Router (`router.tsx`)

- `usuarios/form` pasa a ser solo modo registro (o se renombra a `usuarios/nuevo` si el modo "edit" desaparece del todo — a decidir al implementar, revisando qué mode strings quedan sin uso).
- `usuarios/asignar-rol` pasa a requerir `?userId=`.
- `usuarios/detalle` sigue tomando `?id=` (ya lo hacía, solo que la pantalla lo ignoraba).

## Fuera de alcance

- Reseteo forzado de contraseña por un admin (no existe en el backend, no se pidió).
- Editar los datos de la Persona ya creada.

## Registro de ejecución

### Implementado (2026-07-28)

**Archivos creados**:
- `src/app/shared/identity/roles.ts` — catálogo `RoleType` (11 valores), `ROLE_LABELS`, `ROLE_BADGE_STYLE`, `DIVISION_SCOPED_ROLES` (correcto: `GESTOR_ACADEMICO`, `DIRECTOR_DIVISION`, `COORDINACION_ESTADIAS_DIVISION`), `ROLE_OPTIONS`. Consolidado porque `UsuariosForm.tsx`, `UsuarioDetalle.tsx` y `AsignarRol.tsx` necesitan exactamente el mismo catálogo — antes cada uno tenía su propia copia local desactualizada (5-6 roles falsos, scope de división incorrecto).

**Archivos reescritos por completo**:
- `src/app/pages/AsignarRol.tsx` — toma `userId` de `?userId=`; `GET /users/{userId}` para la tarjeta de contexto (nombre + username); catálogo de roles corregido; `POST /users/{userId}/roles`; maneja 400 (`DivisionRuleViolationException`)/401/403/404; redirige a `UsuarioDetalle` con toast.
- `src/app/pages/UsuarioDetalle.tsx` — `GET /users/{id}`; tarjeta resumen (nombre, username, estado, último acceso, fecha de creación, badge "Debe cambiar su contraseña" si aplica); sección de Roles (tabla + Revocar vía `ConfirmModal` + `DELETE /users/{userId}/roles/{userRoleId}`); botón "Desbloquear cuenta" (solo si `status === 'LOCKED'`) vía `PATCH /users/{id}/unlock`; resuelve `divisionId` a `CODE — Nombre` vía `GET /divisions?size=100`. Sin pestañas — se aplanó a una sola página (resumen + roles), la pestaña "Historial de Accesos" se eliminó por completo (sin endpoint de respaldo).
- `src/app/pages/UsuariosForm.tsx` — Wizard de 2 pasos (`Wizard.tsx`). Paso 1 "Persona": toggle Buscar/Crear; búsqueda async debounced (300ms) contra `GET /persons?search=` vía un componente bespoke `PersonSearchField` (NO se reusó `SearchSelectField` de `ui.tsx` porque ese filtra un array estático en memoria, sin fetch remoto ni estado "disabled" por item — aquí se necesitan ambos: fetch remoto y deshabilitar personas con `hasUser: true`); alta inline de persona nueva (CURP/Nombre(s)/Apellido Paterno/Apellido Materno opcional/Correo Institucional). Paso 2 "Cuenta": correo institucional resuelto de solo lectura + Contraseña Temporal. Al finalizar: `POST /persons` (si aplica) → `POST /users` → navega a `AsignarRol.tsx?userId=...` con toast. Maneja 409 (CURP/correo duplicado o persona ya con cuenta)/400/401/403.

**Archivos modificados**:
- `src/app/router.tsx` — se eliminó la ruta `usuarios/form` (modo editar ya no existe, no hay `PUT /users/{id}`); `usuarios/new` es ahora la única ruta de registro.
- `src/app/pages/UsuariosList.tsx` — se quitó el botón de acción "Editar" (apuntaba a la ruta eliminada `usuarios/form?mode=edit`) y el import ahora-no-usado de `Pencil`. Es el único cambio a este archivo — se mantiene "ya cableado" en todo lo demás.

**Decisiones tomadas al implementar**:
1. **`UserDetailResponse` no incluye CURP** (confirmado leyendo el DTO real y `GetUserUseCaseImpl`) — solo trae `fullName`, `username` (que ES el correo institucional, asignado como username al crear el `User`), `status`, `mustChangePassword`, `lastLoginAt`, `createdAt`, `roles[]`. No existe `GET /persons/{id}` para completar la CURP desde el detalle. Se ajustó el brief original (que pedía mostrar CURP + correo institucional como campos separados) a lo que el contrato real permite: se muestra `username` (el correo institucional) y se omite CURP — no es un dato disponible en ningún endpoint desde esta pantalla.
2. **`UsuarioDetalle.tsx` se aplanó a una sola página sin pestañas** — con solo 2 secciones reales (Info General + Roles) tras eliminar "Historial de Accesos", un tab-switcher era sobre-ingeniería; se mantiene la tarjeta resumen + una sección de roles en scroll natural.
3. **`usuarios/form` se eliminó del router en vez de mantenerlo como alias muerto** — como el modo "editar" ya no existe, mantener la ruta habría dejado un botón "Editar" en `UsuariosList.tsx` navegando a un flujo sin sentido (Wizard de registro disfrazado de edición). Se quitó la ruta y el botón que apuntaba a ella.
4. **`PersonSearchField` es un componente bespoke, no una reutilización de `SearchSelectField`** — la búsqueda de personas necesita fetch remoto debounced y deshabilitar filas con `hasUser: true`; `SearchSelectField` de `ui.tsx` filtra un array estático sin ninguno de esos dos comportamientos.
5. **`ROLE_OPTIONS`/`DIVISION_SCOPED_ROLES` se consolidaron en `shared/identity/roles.ts`** pero `UsuariosList.tsx` mantiene su copia local (no se tocó) — es la única pantalla que no necesita el scope de división, y tocarla estaba fuera del alcance mínimo de este cambio.

**Verificación**: `npx tsc --noEmit` desde `118-SISA-FRONT/` — limpio, sin errores.
