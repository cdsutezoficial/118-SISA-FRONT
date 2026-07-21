# Plan de implementación — Conectar Periodos Académicos al backend real

**Fecha**: 2026-07-20
**Estado**: COMPLETADO
**Repos involucrados**: `118-SISA-FRONT` (implementación) · `118-SISA-CLAUDE` (corrección de Pantallas 6-7, ver abajo)
**Análisis previo**: `PeriodosList.tsx`/`PeriodosForm.tsx` comparados contra `AcademicPeriodController` real (`118-SISA-BACK`, cerrado hoy — `docs/plans/2026-07-20-academic-period.md`) y contra el prompt de Figma (`118-SISA-CLAUDE/docs/design/figma/prompts/01-config-academica.md`, Pantallas 6-7).

## Gaps encontrados (comparación campo a campo)

`PeriodosForm.tsx` es 100% mock y le faltan campos que el backend exige:

| Campo backend (`AcademicPeriod`) | ¿Existe en el mock? |
|---|---|
| `name` | Sí (`nombre`) |
| `startDate`/`endDate` | Sí (`inicio`/`fin`) |
| `type` (`CUATRIMESTRAL`/`SEMESTRAL`/`BIMESTRAL`) | Parcial — mock tiene "Cuatrimestral, Semestral, Anual, Intensivo" (**no coincide**: "Anual"/"Intensivo" no existen en el backend, falta "Bimestral") |
| `year` | **No existe en el mock** |
| `periodNumber` | **No existe en el mock** |
| `enrollmentStart`/`enrollmentEnd` | **No existen en el mock** |
| `status` (4 valores, máquina de estados secuencial) | **Roto** — `PeriodosList.tsx` hardcodea solo 2 valores visuales (Activo/Cerrado) con una sola acción "Cerrar periodo" (icono candado). El prompt de Figma original (Pantalla 6) tiene 3 (Activo/Próximo/Cerrado). El backend real tiene 4 (`CONFIGURATION`/`ENROLLMENT`/`ACTIVE`/`CLOSED`) con transiciones secuenciales estrictas y **no idempotentes** (confirmado con José 2026-07-20) — ninguno de los dos diseños anteriores encaja.

## Diseño de la transición de estado (nuevo, reemplaza "Cerrar periodo")

Dado que el backend solo permite avanzar un paso a la vez (`CONFIGURATION→ENROLLMENT→ACTIVE→CLOSED`, sin saltos, sin retroceso, sin reenviar el mismo estado), la única acción de estado con sentido en la UI es **"Avanzar de estado"**, contextual al estado actual — no una acción fija de "cerrar":

| Estado actual | Etiqueta del botón | Siguiente estado |
|---|---|---|
| CONFIGURATION | "Abrir Inscripciones" | ENROLLMENT |
| ENROLLMENT | "Activar Periodo" | ACTIVE |
| ACTIVE | "Cerrar Periodo" | CLOSED |
| CLOSED | — (sin acción, botón oculto/disabled) | — (terminal) |

Cada transición pide confirmación (`ConfirmModal`, ya existe en `shared/ui.tsx`, se usa hoy para "Cerrar periodo") con el mensaje ajustado a la transición real, no un texto fijo de "cerrar".

## Corrección de doc (118-SISA-CLAUDE)

Actualizar Pantallas 6-7 de `01-config-academica.md`:
- Pantalla 6: columna Estado pasa de "Activo/Próximo/Cerrado" a los 4 valores reales, columna Acciones pasa de "Cerrar periodo" fijo a la acción contextual de la tabla de arriba.
- Pantalla 7: agregar Año, Número de Periodo, Inicio/Fin de Inscripciones al formulario; corregir opciones de Tipo a `CUATRIMESTRAL`/`SEMESTRAL`/`BIMESTRAL`.

## Contrato de API (ya implementado en 118-SISA-BACK)

| Verbo | Endpoint | Body/Query |
|---|---|---|
| GET | `/periods` | `status`, `search`, `page`, `size` |
| POST | `/periods` | `{ name, year, periodNumber, type, startDate, endDate, enrollmentStart, enrollmentEnd }` — `status` no se envía, arranca en `CONFIGURATION` |
| GET | `/periods/{id}` | — |
| PUT | `/periods/{id}` | mismo shape que POST, sin `status` |
| PATCH | `/periods/{id}/status` | `{ status: 'CONFIGURATION'\|'ENROLLMENT'\|'ACTIVE'\|'CLOSED' }` |

Respuesta (`AcademicPeriodResponse`): `{ id, name, year, periodNumber, type, startDate, endDate, enrollmentStart, enrollmentEnd, status }`.

Errores a mapear: 409 (`year`+`periodNumber` duplicado), 400 (rango de fechas inválido, o transición de estado inválida — este último no debería poder dispararse desde la UI si el botón contextual está bien armado, pero igual hay que mostrar el mensaje del backend si pasa).

## Archivos a modificar

**Decisión (2026-07-20): reescribir desde cero, no parchear el mock actual.** Justificación: `PeriodosList.tsx` hoy no tiene el layout responsive dual (tabla desktop + cards mobile) que sí tienen `DivisionesList.tsx`/`ClasificacionesList.tsx`, usa un array hardcodeado sin paginación/debounce/loading-states reales, y la acción de estado cambia de raíz (de ícono fijo a acción contextual) — entre los tres puntos se termina tocando casi todo el archivo igual, así que clonar el molde ya probado hoy dos veces (Divisiones → Clasificaciones) es más simple y consistente que parchear.

- `src/app/pages/PeriodosList.tsx` — reescribir clonando `ClasificacionesList.tsx`: `apiGet('/periods', ...)`, paginación real, búsqueda con debounce, filtro de estado (4 valores), tabla desktop + cards mobile, badge de 4 estados, acción contextual de la tabla de arriba (reemplaza el ícono de candado fijo) con `apiPatch('/periods/{id}/status', { status })`.
- `src/app/pages/PeriodosForm.tsx` — reescribir clonando `ClasificacionesForm.tsx`: los 4 campos faltantes, opciones de Tipo corregidas, `apiGet`/`apiPost`/`apiPut`. El status NO se edita desde este form (va por la acción contextual del listado), mismo criterio que Escalas de Calificación con GradeScale.
- `118-SISA-CLAUDE/docs/design/figma/prompts/01-config-academica.md` — Pantallas 6-7, doc-sync.

## Fuera de alcance

- `Generation`/`Group` — dependen de `AcademicPeriod` pero no existen todavía, ni backend ni frontend.

## Registro de ejecución

**Fecha de ejecución**: 2026-07-20

### Qué se construyó

- **`src/app/pages/PeriodosList.tsx`** — reescrito desde cero clonando el molde de `ClasificacionesList.tsx`/`DivisionesList.tsx`: `apiGet('/periods', ...)` con paginación real, búsqueda con debounce (300ms), filtro de estado (4 valores: `CONFIGURATION`/`ENROLLMENT`/`ACTIVE`/`CLOSED`), layout responsive dual (tabla desktop `hidden md:block` + cards `md:hidden`), loading/empty/error states, badges de 4 colores (ámbar/azul/esmeralda/gris).
  - Acción de estado: un solo botón contextual por fila (`NEXT_STATUS_ACTION` — mapa de estado actual → `{ next, label, confirmTitle, confirmMessage }`), reemplaza el ícono fijo de candado del mock. `CLOSED` está ausente como key del mapa → ninguna fila en ese estado renderiza el botón (ni siquiera deshabilitado), mismo criterio que Divisiones/Clasificaciones al omitir acciones que no aplican.
  - Confirmación vía `ConfirmModal` (reutilizado de `shared/ui.tsx`) con título/mensaje/label dinámicos según la transición.
  - PATCH exitoso → refetch de la página actual (mismo patrón que el toggle ACTIVE/INACTIVE de Divisiones/Clasificaciones) para mantener metadata de paginación consistente.
  - Icono "Editar" deshabilitado cuando `status === 'CLOSED'` (se preservó del mock original; el backend no lo exige, es una salvaguarda de UX para registros históricos).
- **`src/app/pages/PeriodosForm.tsx`** — reescrito desde cero clonando el molde de `ProgramasForm.tsx` (por su soporte de modo Ver + validación con `FieldError`, más completo que `ClasificacionesForm.tsx` para este caso): 8 campos reales (Nombre, Año, Número de Periodo, Tipo [3 opciones correctas], Fecha Inicio, Fecha Fin, Inicio Inscripciones, Fin Inscripciones), sin campo de `status`. Fechas usan `<input type="date">` nativo (mismo convenio que `effectiveFrom` en `PlanForm.tsx` — el valor nativo YA es `YYYY-MM-DD`, sin conversión). Validación cliente replica los invariantes del backend (`AcademicPeriod.validateDateRanges`): `startDate < endDate`, `enrollmentStart < enrollmentEnd`, `enrollmentEnd <= endDate`. Mapeo de errores 400/401/403/404/409 igual al resto de formularios del módulo.
- **`src/app/router.tsx`** — agregado `RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']}` en la ruta `periodos` (list), mirroring el precedente de `divisiones`/`clasificaciones`. `periodos/new`/`periodos/form` quedaron sin guard, igual que sus precedentes.
- **`118-SISA-CLAUDE/docs/design/figma/prompts/01-config-academica.md`** — se agregó la sección "Corrección — Periodos Académicos (Pantallas 6 y 7)" al final del archivo, con los prompts corregidos (4 estados reales + acción contextual en Pantalla 6; 4 campos agregados + opciones de Tipo corregidas en Pantalla 7), marcada como doc-sync retroactivo (no requiere reejecución en Figma Make, la fuente de verdad ya es el código). Cambio dejado sin commitear en ese repo, a criterio de José.

### Verificación

- `tsc --noEmit` (vía Node 24 directo, `node_modules/typescript/bin/tsc`): 0 errores.
- `vite build` (vía Node 24 directo, `node_modules/vite/bin/vite.js`): build exitoso (`✓ built in 5.22s`). El warning de chunk >500kB es preexistente y no relacionado a este cambio.

### Desviaciones del plan

- El plan sugería clonar `ClasificacionesForm.tsx` como molde del formulario; se usó `ProgramasForm.tsx` en su lugar porque `ClasificacionesForm.tsx` no tiene modo Ver (Clasificaciones solo tiene 2 campos, no lo justifica) mientras que Periodos sí necesita preservar el modo Ver que ya tenía el mock original (`isView`/`ModeSwitcher`). `ProgramasForm.tsx` ya resuelve ese patrón completo (Ver + validación con `FieldError` + mapeo de errores), así que fue el molde más cercano.
- Convención de fechas: no existía ningún formulario ya conectado al backend real que usara el componente mock `DatePicker` (dd/MM/yyyy). El único precedente real fue `PlanForm.tsx` (`effectiveFrom`), que usa `<input type="date">` nativo — se replicó ese convenio en vez de inventar uno nuevo con `DatePicker`.
- Se agregó validación cliente de rangos de fecha (no pedida explícitamente en los deliverables) porque el backend las exige como invariante de dominio (`AcademicPeriod.validateDateRanges`) — evita un roundtrip de 400 innecesario para un caso predecible.

### Pendiente / atención de José

- Ninguno bloqueante. El cambio en `118-SISA-CLAUDE` quedó sin commitear intencionalmente — revisar y commitear ese repo por separado.
