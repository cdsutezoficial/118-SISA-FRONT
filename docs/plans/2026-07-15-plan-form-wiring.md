# Plan de implementación — Conectar formulario de Planes de Estudio al backend real

**Fecha**: 2026-07-15
**Estado**: APROBADO por el PO (2026-07-15) con las decisiones de la sección "Decisiones del PO"
**Repos involucrados**: `118-SISA-FRONT` (implementación) · `118-SISA-CLAUDE` (registro de desalineaciones, ver `docs/design/pendientes/2026-07-15-planes-form-wiring.md`)
**Análisis previo**: documentación (`docs/requirements/01-PROGRAMACION.md`, `docs/design/dominio/02-config-academica.md`) comparada contra el backend real (`AcademicPlanController` en `118-SISA-BACK`, referencia en `SISAv2/docs/api/academic-config.md`) y el estado actual del frontend.

---

## Contexto

- `PlanesList.tsx` ya consulta el backend real (`GET /plans`).
- `PlanForm.tsx` es 100% mock: sus campos (`programa`, `anio`, `clave`, `nombre`, `calAprobatoria`) no corresponden a ningún campo del backend, y los niveles son filas simples sin persistencia.
- El backend NO tiene un endpoint que guarde el plan completo con niveles en una sola llamada: el plan se crea/edita con `POST/PUT /plans`, y cada nivel se gestiona con endpoints hijos (`POST/PUT/DELETE /plans/{id}/levels/{levelId}`).

## Alcance de esta fase (Fase 1)

Conectar **crear/editar plan + gestión de niveles**. Las materias (subjects) quedan FUERA de esta fase (ver "Bloqueado / fases futuras").

### 1. Comparación campo a campo — formulario actual vs backend

Estado actual verificado en código (`PlanForm.tsx` interfaz `PlanForm` vs `CreateAcademicPlanRequest.java`):

**Campos que hoy existen en el formulario:**

| Campo actual (mock) | Equivalente backend | Situación |
|---|---|---|
| `programa` (clave corta hardcodeada: IDGS, IRT…) | `programId` (UUID) | Se conserva pero cambia: opciones reales desde `GET /programs`, se envía UUID. Inmutable en edición (PUT no acepta `programId`) |
| `anio` (año numérico) | — | No existe tal cual; el backend lo reparte en `effectiveFrom` (fecha exacta) + `validityPeriod` (texto) |
| `clave` ("IDGS-2022") | `version` | Lo más cercano; unicidad por programa validada por backend (409 `DuplicatePlanVersionException`). No es clave compuesta |
| `nombre` | — | **NO existe en el backend ni en el diseño de dominio** — el plan no tiene nombre. Decisión de PO: eliminar el campo o agregarlo al backend |
| `calAprobatoria` (escala 0–100, ej. 70) | `minPassingGrade` | Existe pero **la escala es distinta**: backend valida decimal en [0, 10] (ej. 7.0) |

**Campos que FALTAN en el formulario (el backend los requiere/acepta):**

| Campo backend | Regla |
|---|---|
| `validityPeriod` | texto, obligatorio (`@NotBlank`) |
| `titulationKey` | texto, obligatorio (`@NotBlank`) |
| `effectiveFrom` | fecha, obligatoria (`@NotNull LocalDate`) |
| `totalLevels` | entero; los niveles se validan contra el rango 1..`totalLevels` |
| `maxExtraordinaryExamsPerPeriod` | entero ≥ 0 (`@Min(0)`) |
| `requiresSocialService` | boolean |
| `socialServiceMinLevelId` | UUID nullable; DEBE ser `null` al crear; en edición solo puede referenciar niveles del propio plan |

**Niveles — formulario actual vs `AddPlanLevelRequest`:**

| Aspecto | Mock actual | Backend real |
|---|---|---|
| Identificación | orden implícito de la fila | `levelNumber` explícito (1..`totalLevels`, único, 409 si se repite) |
| Nombre | `nombre` texto libre obligatorio | `description` texto opcional |
| Tipo | TSU / Continuidad Ingeniería / Continuidad Licenciatura / Otro | `type`: `REGULAR` \| `INTERNSHIP` (clases regulares vs estadías) |

El "tipo" del mock es conceptualmente incorrecto: TSU vs Continuidad no son tipos de nivel sino **planes separados** (decisión de dominio ya tomada: un plan pertenece a un solo programa). El tipo real distingue clases regulares de estadías/prácticas.

### Decisiones del PO (2026-07-15)

1. **El campo "Clave del Plan" actual ES la clave de titulación**: se mapea a `titulationKey` y se renombra su etiqueta a "Clave de Titulación". `version` es un campo nuevo separado.
2. **"Nombre del Plan" se elimina**: el plan se identifica por programa + versión, alineado al dominio. No se agrega nombre al backend.
3. **Tipos de nivel confirmados**: TSU/Continuidad NO son tipos de nivel (serían planes distintos). Se usan los tipos reales `REGULAR` / `INTERNSHIP`.

### Requisito responsivo (obligatorio)

La pantalla debe seguir el patrón responsivo ya establecido y documentado en `CHANGELOG.md` (entrada [2026-07-09]):

- **Formulario**: grid `col-span-12 sm:col-span-N` (campos full-width en móvil), botones de acción `flex-col-reverse sm:flex-row` + `w-full sm:w-auto`, breadcrumb `flex-wrap`, contenedor `px-4 sm:px-8 py-6 sm:py-8`. Referencias implementadas: `DivisionesForm.tsx`, `ProgramasForm.tsx`.
- **Tabla de niveles**: en móvil la tabla se oculta (`hidden md:block`) y se muestra una tarjeta por nivel (`md:hidden space-y-3`), siguiendo el patrón de `DivisionesList.tsx`.

### 1b. Mapeo objetivo del formulario

Reemplazar los campos mock por los campos reales del DTO:

| Campo UI | Campo API | Tipo / regla |
|---|---|---|
| Programa educativo | `programId` | `SearchSelectField` alimentado de `GET /programs` (solo en registro; inmutable en edición — el backend no acepta `programId` en PUT) |
| Versión | `version` | texto, requerido; duplicado por programa → 409 |
| Periodo de vigencia | `validityPeriod` | texto, requerido |
| Clave de titulación | `titulationKey` | texto, requerido |
| Vigente desde | `effectiveFrom` | fecha, requerida |
| Total de niveles | `totalLevels` | entero ≥ 1 |
| Calificación mínima aprobatoria | `minPassingGrade` | decimal en [0, 10] (backend valida y responde 400) |
| Extraordinarios máx. por periodo | `maxExtraordinaryExamsPerPeriod` | entero ≥ 0 |
| Requiere servicio social | `requiresSocialService` | boolean (switch) |
| Nivel mínimo para servicio social | `socialServiceMinLevelId` | select de los niveles del propio plan; DEBE ir `null` en el create (regla del backend) |

### 2. Flujo de guardado (sin endpoint de grafo completo)

**Registro (create)**:
1. `POST /plans` con los campos escalares (`socialServiceMinLevelId: null`) → obtener `id`.
2. Por cada nivel capturado: `POST /plans/{id}/levels` (secuencial, no hay batch).
3. Si el usuario eligió nivel mínimo de servicio social: `PUT /plans/{id}` final con `socialServiceMinLevelId` (solo puede referenciar niveles ya persistidos).
4. Si un paso intermedio falla: informar qué se guardó y qué no; el plan queda creado parcialmente y se ofrece continuar desde edición (no hay transacción distribuida — decisión consciente de esta fase).

**Edición (edit)**:
1. `GET /plans/{id}` para poblar el formulario (único endpoint que devuelve el árbol `levels[].subjects[]`).
2. `PUT /plans/{id}` con los escalares modificados.
3. **Diff de niveles** contra el estado cargado: nuevos → `POST`, modificados → `PUT`, eliminados → `DELETE`. Manejar 409: `DuplicateLevelNumberException` (número repetido) y `PlanLevelHasSubjectsException` (no se puede borrar nivel con materias).

### 3. Patrón de referencia

Seguir `ProgramasForm.tsx` (patrón ya establecido) para: `useFormMode()`, carga por id con `loadStatus`, validación inline `validate()`, `apiPost/apiPut` con `submitStatus`, mensajes distinguidos por código (400/401/403/404/409), `SearchSelectField`, `ModeSwitcher`.

**Novedad de esta pantalla**: es la primera con CRUD de colección hija (niveles) con diffing — no existe precedente en el código; el estado de niveles debe registrar `originalId` para el diff.

### 4. Estados y errores

- `PlanStatus` real del backend: `ACTIVE` / `INACTIVE` (el doc de dominio dice `DEPRECATED` — desalineación registrada en 118-SISA-CLAUDE, usar lo del backend).
- El nivel tiene `levelNumber` (1..`totalLevels`, validado por el backend), `type` (`REGULAR` / `INTERNSHIP` — puede haber más de un nivel de estadías) y `description` opcional.

## Fase 1b — Detalle del plan con datos reales (aprobada por el PO 2026-07-15)

`PlanDetalle.tsx` muestra hoy datos 100% mock junto a un formulario ya real — confuso. Se cablea la parte NO bloqueada:

1. **Carga real**: `GET /plans/{id}` (mismo endpoint que usa el form en edición) + resolución del nombre del programa vía `GET /programs`. Patrón `loadStatus` de `ProgramasForm.tsx`, con id tomado de la URL.
2. **Encabezado del plan**: programa, versión, periodo de vigencia, clave de titulación, vigente desde, total de niveles, mínima aprobatoria, extraordinarios máximos, servicio social (y su nivel mínimo), estatus real (`ACTIVE`/`INACTIVE`).
3. **Niveles**: lista real desde `levels[]` (`levelNumber`, tipo REGULAR/INTERNSHIP, descripción) con sus materias (`subjects[]`) si existieran — hoy normalmente vacías, con estado vacío honesto.
4. **Secciones bloqueadas por backend**: asignar/editar materias y pestaña Escalas de Calificación se muestran como "pendiente de backend" (sin datos inventados). El historial mock se elimina o se marca igual.
5. Sin cambios en `AsignarMateria.tsx` (sigue bloqueado).
6. Patrón responsivo obligatorio (CHANGELOG [2026-07-09]).

## Bloqueado / fases futuras (NO en esta fase)

| Tema | Bloqueo |
|---|---|
| Materias por nivel (`AsignarMateria.tsx`) | `classificationId` es requerido por el backend pero `SubjectClassification` no existe en 118-SISA-BACK (sin modelo, repo ni controller). Además el concepto de "catálogo reutilizable de materias" del mock no existe en el dominio — decisión de PO pendiente. |
| `PlanDetalle.tsx` | Depende de decidir el flujo de materias. |
| Escalas de calificación | `GradeScale`/`GradeScaleEntry` documentados pero sin implementación backend. |

## Notas post-revisión (no bloqueantes, seguimiento)

Dos observaciones SUGGESTION del revisor independiente, aceptadas como deuda menor:

1. `socialServiceClearedHint` no se resetea en `applyPlanDetail`: tras un re-sync por fallo parcial que restaura un nivel (p. ej. su DELETE falló por tener materias), el aviso ámbar "se limpió porque el nivel fue eliminado" puede quedar visible aunque el nivel reapareció en la tabla.
2. `resyncFromServer` tras fallo parcial sobrescribe `levels` con el estado del servidor, descartando filas nuevas aún no aplicadas (una fila agregada que falló desaparece del formulario aunque el listado de errores la mencione).

## Verificación

- `pnpm typecheck` (verificación primaria del repo, no hay test runner).
- Prueba manual contra backend real: crear plan con 2+ niveles (uno INTERNSHIP), editar escalares, agregar/renombrar/eliminar nivel, provocar 409 de nivel duplicado, activar servicio social con nivel mínimo.
