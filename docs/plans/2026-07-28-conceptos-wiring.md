# Plan de implementación — Conceptos de Pago (Fase 3 de 4 — wiring del catálogo)

**Fecha**: 2026-07-28
**Repos**: `118-SISA-BACK` (backend ya cerrado — Fase 1 `PaymentConcept`, Fase 2 `PaymentRate`) · `118-SISA-FRONT` (este plan)

## Contexto

`ConceptosList.tsx`/`ConceptosForm.tsx` son mock puro y no coinciden con el modelo real: el campo "Tipo" tiene 2 valores inventados en vez del enum real de 5, faltan 8 campos completos del concepto, la acción de "Eliminar" (hard delete con modal) contradice el patrón real (`ChangePaymentConceptStatusUseCase` es un toggle Activo/Inactivo, igual que el resto de `academic_config` — nunca hay borrado físico), y las tarifas se muestran embebidas en un slide-over con datos de ejemplo.

## Alcance de esta fase

**Solo el catálogo `PaymentConcept`** — nombre, tipo, reglas, disponibilidad, estado. Las tarifas (`PaymentRate`) se cablean en la Fase 4, con su propia pantalla de historial — en esta fase el listado y el form de Concepto **no muestran tarifas** (se quita el slide-over de ejemplo y la columna "Tarifas" del listado; ambos se reintroducen en la Fase 4 apuntando a datos reales).

## Contrato de API (ya implementado y verificado en 118-SISA-BACK)

| Verbo | Endpoint | Body/Query |
|---|---|---|
| GET | `/payment-concepts` | `status`, `search` (contra `name`), `page`, `size` |
| POST | `/payment-concepts` | `{ name, description?, policies?, type, isTuition, isStandalone, maxPerStudent?, maxPerPeriod?, requiresValidation, availableFrom?, availableUntil? }` |
| GET | `/payment-concepts/{id}` | — |
| PUT | `/payment-concepts/{id}` | mismo shape que POST (no toca `status`) |
| PATCH | `/payment-concepts/{id}/status` | `{ status: 'ACTIVE'\|'INACTIVE' }` — toggle bidireccional, mismo patrón que Generaciones/Grupos/Divisiones |

`type` (enum, 5 valores): `ENROLLMENT` (Inscripción), `REINSCRIPTION` (Reinscripción), `EXTRAORDINARY` (Extraordinario), `DOCUMENT` (Documento), `OTHER` (Otro).

**Regla de negocio a respetar** (RF-PAG-001, `ChangePaymentConceptStatusUseCase`): NO existe borrado físico — el mock actual tiene un botón "Eliminar" con `ConfirmModal` que hay que reemplazar por un `Switch` Activo/Inactivo, mismo criterio que Generaciones/Divisiones/Grupos.

## Archivos a modificar

### `ConceptosList.tsx`
- Filtros: búsqueda por nombre, filtro por Estado (Todos/Activo/Inactivo).
- Tabla: Nombre, Tipo (badge con los 5 valores reales), Es cuota cuatrimestral (badge/ícono si `isTuition`), Estado (badge + `Switch`, reemplaza el botón "Eliminar"), Acciones (Ver, Editar).
- **Se quita**: columna "Tarifas" y el slide-over — vuelven en la Fase 4.
- Responsivo: mismo patrón ya establecido (tabla desktop + tarjetas móvil).

### `ConceptosForm.tsx`
- Modos registrar/ver/editar (el Update SÍ existe para `PaymentConcept`, a diferencia de Usuarios — mantener los 3 modos).
- Campos: Nombre, Tipo (select con los 5 valores reales), Descripción (textarea, rich text simplificado a texto plano por ahora — no hay editor de rich text en este proyecto todavía, mismo criterio que otros campos "Text" ya wireados como texto plano), Políticas (textarea), Es cuota cuatrimestral (checkbox/toggle), Es exclusivo del carrito (`isStandalone`, checkbox/toggle), Máximo por estudiante / Máximo por periodo (inputs numéricos, opcionales — vacío = ilimitado), Requiere validación de entrega (checkbox/toggle), Disponible desde / Disponible hasta (date pickers, opcionales).
- **Se quita** la sección "Tarifas" completa (mock actual la incluye) — vuelve en la Fase 4 como su propia sección dentro de este mismo form, apuntando a `/payment-concepts/{id}/rates`.
- Estado NO se edita en este formulario — mismo criterio que Generaciones/Periodos, se cambia desde el `Switch` del listado.

## Fuera de alcance

- `PaymentRate`/tarifas — Fase 4.
- El módulo Finance real.

## Registro de ejecución

### Archivos modificados

- `src/app/pages/ConceptosList.tsx` — reescritura completa. Filtros (búsqueda debounced contra `name`, Estado Todos/Activo/Inactivo), tabla desktop (`hidden md:block`) + tarjetas móvil (`md:hidden`), columnas Nombre/Tipo (badge, 5 valores reales)/Cuota (badge condicional si `isTuition`)/Estado (badge + `Switch`)/Acciones (Ver, Editar). Paginación server-side (`page`/`size`, tamaño 20). Se quitó por completo la columna "Tarifas", el slide-over de ejemplo, y el botón "Eliminar" + `ConfirmModal` — reemplazado por `handleToggleStatus` (idéntico a `GeneracionesList.tsx`: PATCH + refetch, sin confirmación).
- `src/app/pages/ConceptosForm.tsx` — reescritura completa. Mantiene los 3 modos (register/view/edit, clonado de `DivisionesForm.tsx` con `ModeSwitcher`). Todos los campos reales del DTO en 3 secciones: "Información del Concepto" (nombre, tipo — `<select>` nativo con `TYPE_LABELS`, igual patrón que `PeriodosForm.tsx`'s `type`—, descripción, políticas, ambas como `textarea` de texto plano), "Reglas del Concepto" (`isTuition`, `isStandalone`, `requiresValidation` — los 3 con el componente `Switch` compartido), "Límites y Disponibilidad" (`maxPerStudent`/`maxPerPeriod` como `input type="number"` opcionales con ayuda "vacío = ilimitado", `availableFrom`/`availableUntil` como `input type="date"` — mismo patrón ISO `yyyy-MM-dd` que `PeriodosForm.tsx`, compatible directo con `LocalDate` de Jackson). Se quitó la sección "Tarifas" completa del mock (vuelve en Fase 4). `status` nunca se envía en el payload (ni create ni update).

### Decisiones técnicas

1. **Sin badge de `isStandalone` en el listado**: el plan (línea 32) solo pide indicador para `isTuition` en la tabla — `isStandalone` sí viaja en el DTO de list item pero no se muestra como columna/badge en Fase 3 (se puede agregar si José lo pide, no estaba en el alcance documentado).
2. **`description`/`policies` se envían como `null` si quedan vacíos** (`.trim() || null`), no como `""` — evita mandar cadenas vacías a columnas `TEXT` nullable innecesariamente; el backend las trata igual (nullable), pero es más limpio para futuras consultas.
3. **`maxPerStudent`/`maxPerPeriod` vacíos → `null`** en el payload (no se omite la key) — combina con la regla de negocio "vacío = ilimitado" documentada en el plan de backend (sección 4).
4. **Sin rama 409 en el manejo de errores del form** — a diferencia de `DivisionesForm`/`ClasificacionesForm`, `PaymentConcept.name` no tiene restricción de unicidad (confirmado en el plan de backend, Execution Log, decisión técnica #1) — el backend nunca devuelve conflicto para este aggregate, así que no se agregó una rama que no corresponde a ninguna excepción real de `GlobalExceptionHandler`.
5. **`router.tsx` sin cambios** — las rutas `conceptos`/`conceptos/new`/`conceptos/form` ya existían y apuntaban a los componentes correctos; no hay `RequireRole` en ninguna, igual que `programas`/`grupos` (no se agregó guard nuevo, fuera de alcance de este plan).

### Resultado de verificación

`npx tsc --noEmit` desde `118-SISA-FRONT/` — **sin errores** (pasó limpio).
