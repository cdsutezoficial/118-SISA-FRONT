# Plan de implementación — Cerrar el proceso de Planes de Estudio: Materias + Escalas de Calificación

**Fecha**: 2026-07-20
**Estado**: COMPLETO — Parte A (Registrar Materia en el Nivel) y Parte B (Escalas de Calificación) completas
**Repos involucrados**: `118-SISA-FRONT` (implementación) · `118-SISA-CLAUDE` (pendientes ya resueltos, ver `docs/design/pendientes/2026-07-15-planes-form-wiring.md`, puntos 3-5)
**Continúa de**: `docs/plans/2026-07-15-plan-form-wiring.md` (Fase 1 — crear/editar plan + niveles, ya cerrado)

## Contexto

`PlanDetalle.tsx` tiene dos secciones bloqueadas hoy, ambas con el motivo exacto documentado en comentarios en el propio código:

```tsx
// Assign/edit subject — blocked: SubjectClassification not implemented in 118-SISA-BACK.
// Escalas de Calificación — blocked: GradeScale/GradeScaleEntry not implemented...
```

Los dos bloqueos backend se resolvieron hoy (2026-07-20): `SubjectClassification` (5 fases) y `GradeScale`/`GradeScaleEntry` (hijas de `AcademicPlan`). Este plan cablea ambas secciones para dar por completo el proceso de registro de un plan de estudios.

Además, José confirmó (2026-07-20) cómo resolver el punto 5 del pendiente del 15/07: "Asignar Materia al Nivel" NO selecciona de un catálogo global (ese concepto no existe en el dominio) — se **registra la materia directo en el nivel**, alineado a como ya funciona `AddSubjectToPlanUseCase` en el backend.

## Parte A — Registrar Materia en el Nivel

### Contrato de API (ya implementado en 118-SISA-BACK)

| Verbo | Endpoint | Body |
|---|---|---|
| POST | `/plans/{id}/levels/{levelId}/subjects` | `AddSubjectRequest` |
| PUT | `/plans/{id}/levels/{levelId}/subjects/{subjectId}` | `UpdateSubjectRequest` |
| DELETE | `/plans/{id}/levels/{levelId}/subjects/{subjectId}` | — |

`AddSubjectRequest`/`UpdateSubjectRequest`: `{ code, name, credits, weeklyHours, evaluationUnits, displayOrder, type: 'CORE'|'ELECTIVE'|'INTERNSHIP', isRetakeable (nullable, default true), classificationId }`. Respuesta: `SubjectResponse` (mismo shape + `id`). Sin endpoint de mover una materia entre niveles — no se soporta, no se ofrezca en la UI.

### Cambios sobre el prompt de Figma original (Pantalla 19)

Pantalla 19 actual dice "Materia (8 cols) — Select con buscador... busca por nombre o clave" — **esto ya no aplica** (asumía el catálogo que no existe). Reemplazar por los campos reales de `AddSubjectRequest`: Código, Nombre, Créditos, Horas Semanales, Unidades de Evaluación, Orden en Kardex, Tipo, ¿Recursable?, y Clasificación (Select con buscador — este sí es real, contra `GET /subject-classifications`). Actualizar `118-SISA-CLAUDE/docs/design/figma/prompts/01-config-academica.md` Pantalla 19 en el mismo commit/sesión que se implemente (doc-sync), renombrando el título a "Registrar Materia en el Nivel".

### Cambios en `PlanDetalle.tsx` / `NivelRow`

- Botón "+ Registrar Materia" dentro de cada nivel expandido (reemplaza el texto placeholder "Asignación de materias pendiente de integración con backend").
- Nueva subpantalla o modal (decidir al implementar cuál encaja mejor con el patrón visual existente — no hay precedente de modal en este módulo, los demás forms son pantalla completa vía route; usar el mismo patrón de pantalla completa con `useSearchParams` para mantener consistencia, ej. `/planes/materia/form?planId=...&levelId=...&mode=register|edit&subjectId=...`).
- Acciones Editar/Eliminar por fila de materia en la tabla de `NivelRow` (hoy no existen — la tabla es solo lectura). Eliminar debe confirmar antes de llamar `apiDelete` (no hay componente de confirmación reutilizable todavía en `shared/ui.tsx` — revisar si conviene agregar uno o usar `window.confirm` como paso intermedio, mismo criterio que se use en Escalas — ver Parte B).
- Tras crear/editar/eliminar, refrescar `plan` (recargar `GET /plans/{id}` es más simple y consistente con el resto del módulo que mutar el estado local a mano).

## Parte B — Escalas de Calificación (tab en `PlanDetalle.tsx`)

### Contrato de API (ya implementado en 118-SISA-BACK)

| Verbo | Endpoint | Body / Respuesta |
|---|---|---|
| POST | `/plans/{id}/grade-scales` | `SetGradeScaleRequest` → `GradeScaleResponse` |
| PUT | `/plans/{id}/grade-scales/{scaleId}` | `SetGradeScaleRequest` → `GradeScaleResponse` |
| DELETE | `/plans/{id}/grade-scales/{scaleId}` | — |

`SetGradeScaleRequest`: `{ classificationId, numericMin, numericMax, entries: [{ fromValue, toValue, letter, description, passed }, ...] }`. Es una operación de **reemplazo completo** — el form de "Registrar/Editar Escala" (Pantalla 18, ya especificada, sin cambios necesarios) envía la escala + todos sus tramos juntos en un solo submit, no hay edición granular de un tramo individual.

**Validación de cobertura/solape ya la hace el backend** (400 `InvalidGradeScaleEntriesException` si hay hueco o solape) — el frontend no necesita replicar esa lógica, solo mostrar el mensaje de error del backend tal cual si falla. Igual conviene una validación básica en el cliente (ej. deshabilitar submit si hay campos vacíos) para no depender 100% del roundtrip, pero la validación de negocio real vive en el backend.

`gradeScales: List<GradeScaleResponse>` ya viaja embebido en `AcademicPlanResponse` (`GET /plans/{id}`) — no hace falta un fetch aparte para el tab de Escalas, ya está disponible en el `plan` que carga `PlanDetalle.tsx` hoy.

### Cambios en `PlanDetalle.tsx`

- Reemplazar el placeholder del tab "Escalas de Calificación" (líneas ~423-435 actuales) por: tabla de escalas (Pantalla 17 — columnas: Clasificación [resolver `classificationId` contra `GET /subject-classifications` igual que ya hace `programLabel()` para programas], Rango Numérico, Rangos Configurados, Acciones), botón "+ Agregar Escala", acciones Editar/Eliminar por fila.
- Nueva subpantalla "Registrar/Editar Escala de Calificación" (Pantalla 18, ya especificada) — form con Clasificación (Select, filtrar las que el plan YA tiene una escala para no duplicar — aunque el backend igual rechaza con 409, mejor UX no ofrecerlas), Calificación Mínima/Máxima, y una sub-tabla editable de tramos (agregar/quitar filas: Desde, Hasta, Clave, Descripción, ¿Aprueba?) antes de guardar todo junto.
- Mismo patrón de ruta que Materias: pantalla completa vía route, no modal, para consistencia.

## Archivos a crear

- `src/app/pages/PlanMateriaForm.tsx` (o nombre similar — Registrar/Editar Materia en el Nivel).
- `src/app/pages/PlanEscalaForm.tsx` (o nombre similar — Registrar/Editar Escala de Calificación, con la sub-tabla de tramos).

## Archivos a modificar

- `src/app/pages/PlanDetalle.tsx` — reemplazar ambos placeholders, agregar acciones a `NivelRow`, agregar fetch de `/subject-classifications` para resolver labels (igual que ya hace con `/programs`).
- `src/app/router.tsx` — rutas nuevas para los dos forms.
- `118-SISA-CLAUDE/docs/design/figma/prompts/01-config-academica.md` — actualizar Pantalla 19 (ya no es "seleccionar del catálogo", es "registrar materia"), doc-sync en el mismo esfuerzo.

## Fuera de alcance

- `MateriasList.tsx`/`MateriasForm.tsx` (pantallas flat, fuera de `PlanDetalle`) — su destino (deprecar vs. repropósito) no se decidió, no se tocan en este plan.
- Mover una materia entre niveles — no soportado por el backend.
- Edición granular de un tramo individual de una escala — el backend solo soporta reemplazo completo.

## Registro de ejecución

### Parte A — Registrar Materia en el Nivel (2026-07-20)

**Estado:** ✅ Completo. Parte B (Escalas de Calificación) queda pendiente — la retoma un segundo agente en un commit separado, sin tocar nada de lo hecho aquí.

**Archivos creados:**
- `src/app/pages/PlanMateriaForm.tsx` — registro/edición de materia dentro de un nivel del plan. Ruta `?planId=&levelId=&mode=&subjectId=` vía `useSearchParams` (no se reutilizó `useFormMode` porque necesita `planId`/`levelId` adicionales que ese hook no contempla). En modo edición carga el plan completo (`GET /plans/{planId}`) y busca la materia dentro de `levels[].subjects[]` — no existe `GET /subjects/{id}` independiente. Clasificación vía `SearchSelectField` contra `GET /subject-classifications` (mismo shape que `ClasificacionesList.tsx`).

**Archivos modificados:**
- `src/app/pages/PlanDetalle.tsx` — `NivelRow` recibe ahora `planId` y `onChanged`; reemplaza el placeholder "pendiente de integración con backend" por un botón "+ Registrar Materia", y agrega acciones Editar/Eliminar (ícono, con `window.confirm` antes de eliminar) a cada fila de materia en la tabla de escritorio y en las tarjetas móviles. El fetch de `GET /plans/{id}` se extrajo a un callback `loadPlan()` reutilizable, para que Editar/Eliminar puedan refrescar el árbol completo tras cada cambio (silencioso, sin mostrar el loader de página completa).
- `src/app/router.tsx` — nueva ruta `planes/materia/form` → `PlanMateriaForm`. Se elimina la ruta `planes/asignar-materia` y su página `AsignarMateria.tsx` (ver "Desviaciones" abajo).
- `118-SISA-CLAUDE/docs/design/figma/prompts/01-config-academica.md` — Pantalla 19 renombrada a "Registrar Materia en el Nivel"; se quita el campo "Materia" (Select de catálogo) y se reemplaza por Código/Nombre/Créditos/Horas Semanales (shape real de `AddSubjectRequest`); se conserva "Clasificación". También se actualiza el prompt de navegación pendiente (aún sin ejecutar en Figma Make) para usar los nombres nuevos, y se agrega una nota post-ejecución en la corrección de Pantalla 14 (ya ejecutada) señalando que el botón quedó re-etiquetado "+ Registrar Materia" y que se agregó un ícono "Editar" no contemplado en el prompt original.

**Desviación del plan:** el plan no mencionaba `AsignarMateria.tsx`/`planes/asignar-materia` explícitamente. Se decidió eliminarlos porque implementaban literalmente el diseño viejo (incorrecto) de la Pantalla 19 — un Select de catálogo de materias que el PO confirmó hoy que no existe en el dominio — y no estaban enlazados desde ninguna pantalla real (solo alcanzables tecleando la URL). Mantenerlos habría dejado dos pantallas de "asignar/registrar materia" contradictorias en el código. Marcar para revisión de José si prefiere conservar el mock por alguna razón no documentada.

**Verificación:** `pnpm typecheck` (`tsc --noEmit`) → 0 errores. `pnpm build` → build exitoso (`✓ built in 29.64s`), sin errores; queda el warning preexistente de chunk >500kB (no introducido por este cambio, es el tamaño general del bundle de la app).

**Nota de entorno:** en esta ejecución, `pnpm` vía `nvm use` resultó intermitente en el sandbox (el symlink de nvm4w no se creaba de forma consistente en subprocesos en background). Se verificó typecheck/build invocando directamente los binarios locales (`node_modules/typescript/bin/tsc`, `node_modules/vite/bin/vite.js`) con el Node 24 instalado en `AppData/Local/nvm/v24.13.0/node.exe`. Resultado equivalente a `pnpm typecheck`/`pnpm build`.

### Parte B — Escalas de Calificación (2026-07-20)

**Estado:** ✅ Completo. Commit independiente, sin tocar nada de lo hecho en Parte A.

**Archivos creados:**
- `src/app/pages/PlanEscalaForm.tsx` — registro/edición de una escala de calificación (con su sub-tabla de rangos) dentro de un plan. Ruta `?planId=&mode=&scaleId=` vía `useSearchParams`, mismo patrón que `PlanMateriaForm.tsx`. En modo edición carga el plan completo (`GET /plans/{planId}`) y busca la escala dentro de `gradeScales[]` — no existe `GET /plans/{id}/grade-scales/{scaleId}` independiente. Clasificación vía `SearchSelectField` contra `GET /subject-classifications`, excluyendo las clasificaciones que el plan ya tiene una escala registrada (comparando contra `gradeScales[].classificationId`, dejando pasar la propia escala en edición) — evita el 409 de duplicado sin replicar lógica de negocio compleja. Rangos: tabla editable (agregar/quitar filas) con Desde/Hasta (decimal, `step="0.1"`), Clave (texto, máx. 4), Descripción, ¿Aprueba? (switch); la validación de cobertura/huecos/traslapes es 100% del backend (400 `InvalidGradeScaleEntriesException`), el cliente solo valida campos no vacíos y `numericMin < numericMax`.

**Archivos modificados:**
- `src/app/pages/PlanDetalle.tsx` — reemplaza el placeholder bloqueado del tab "Escalas de Calificación" por una tabla (desktop) + tarjetas (mobile) listando `plan.gradeScales` (columnas: Clasificación, Rango Numérico, Rangos Configurados, Acciones), botón "+ Agregar Escala", acciones Editar/Eliminar (`window.confirm` antes de eliminar, mismo criterio que Parte A). Se agrega un fetch de `/subject-classifications` (igual patrón que el fetch de `/programs` ya existente) y un helper `classificationLabel()` gemelo de `programLabel()`. Eliminar llama `apiDelete('/plans/{id}/grade-scales/{scaleId}')` y refresca con el `loadPlan()` ya existente (de Parte A) — sin duplicar lógica de fetch. Además, `activeTab` ahora lee el query param `tab` al inicializar el estado (`?tab=escalas`), así `PlanEscalaForm` puede navegar de regreso aterrizando directo en el tab de Escalas tras guardar — no requirió más cambios, el estado del tab ya era local (`useState`), solo se cambió su valor inicial.
- `src/app/router.tsx` — nueva ruta `planes/escala/form` → `PlanEscalaForm`, mismo nivel de guarda (ninguno) que `planes/materia/form`.

**Desviación del plan:** ninguna — Pantalla 17 y 18 del prompt de Figma se confirmaron sin cambios necesarios (`118-SISA-CLAUDE/docs/design/figma/prompts/01-config-academica.md` líneas 802-885), tal como el plan anticipaba. El "aterrizar en el tab de Escalas tras guardar" sí resultó straightforward: bastó con leer `searchParams.get('tab')` al inicializar `useState`, no fue necesario ningún manejo adicional de sincronización URL↔estado.

**Verificación:** typecheck (`tsc --noEmit` vía Node 24 directo) → 0 errores. Build (`vite build` vía Node 24 directo) → build exitoso (`✓ built in 5.71s`), sin errores; mismo warning preexistente de chunk >500kB (no introducido por este cambio).
