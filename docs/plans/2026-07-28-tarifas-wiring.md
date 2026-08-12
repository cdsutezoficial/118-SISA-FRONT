# Plan de implementación — Tarifas de Concepto de Pago (Fase 4 de 4 — final)

**Fecha**: 2026-07-28
**Repos**: `118-SISA-BACK` (backend ya cerrado — Fase 2 `PaymentRate`) · `118-SISA-FRONT` (este plan)

## Contexto

Última fase del módulo de Conceptos de Pago. `PaymentRate` es un historial **append-only**: nunca se edita ni se borra una tarifa — se ve el historial completo y se agrega una nueva (que puede cerrar automáticamente la tarifa continua anterior de la misma combinación, o ser un casillero independiente por periodo — ver `118-SISA-BACK/docs/plans/2026-07-28-payment-rate.md`).

## Precedente a clonar

Este mismo proyecto ya resolvió un caso estructuralmente idéntico: **materias/escalas dentro de un Plan de Estudios** (`PlanDetalle.tsx` muestra la lista de materias/escalas de un plan; `PlanMateriaForm.tsx`/`PlanEscalaForm.tsx` son pantallas separadas — rutas propias `planes/materia/form`/`planes/escala/form` — para agregar una nueva, no un modal ni un panel inline dentro del mismo form). Tarifas debe seguir el mismo criterio: el historial se ve en `ConceptosForm.tsx` (modo Ver/Editar), y agregar una tarifa nueva es una **pantalla separada** (`conceptos/tarifa/form?conceptId=`), no un panel/modal embebido.

**Diferencia clave con materias/escalas**: no hay modo "editar" para una tarifa — solo "agregar". La pantalla de tarifa es SIEMPRE de registro, nunca de edición (coherente con el historial inmutable).

## Contrato de API (ya implementado y verificado en 118-SISA-BACK)

| Verbo | Endpoint | Body/Query |
|---|---|---|
| POST | `/payment-concepts/{conceptId}/rates` | `{ programId?, level?, amount, periodId?, validFrom }` — sin `validTo`, lo gestiona el servidor |
| GET | `/payment-concepts/{conceptId}/rates` | Historial completo, **sin paginación**, ordenado por `programId`, `level`, `periodId`, `validFrom` descendente |

`level` es el enum `AcademicLevel` (shared kernel — mismo enum ya usado en Programas/Planes, revisar `ProgramasForm.tsx`/`PlanForm.tsx` para el catálogo de valores y sus labels en español ya establecidos, no inventar labels nuevos).

## Alcance

### `ConceptosForm.tsx` (modo Ver/Editar únicamente — no existe en modo Registrar, mismo motivo que Director de División: la tarifa necesita un `conceptId` real)
- Nueva sección "Tarifas" al final del form: tabla con Programa (resolver `programId` contra `GET /programs`, null → "Todos los programas"), Nivel (resolver `level` al label ya establecido en el proyecto, null → "Todos los niveles"), Periodo (resolver `periodId` contra `GET /periods`, null → "General — sin periodo"), Monto, Vigente desde, Vigente hasta (null → badge "Vigente", con fecha → texto plano de cierre).
- Botón "+ Agregar Tarifa" → navega a `conceptos/tarifa/form?conceptId=<id>`.
- Sin acciones de editar/borrar por fila — el historial es de solo lectura desde acá.

### `ConceptosTarifaForm.tsx` (pantalla nueva, solo registro)
- Campos: Programa (select con buscador, opcional, placeholder "Todos los programas"), Nivel (select, opcional, placeholder "Todos los niveles"), Periodo Académico (select con buscador, opcional, placeholder "General — sin periodo, ver ayuda"), Monto (numérico, requerido, > 0), Vigente desde (date picker, requerido).
- Ayuda contextual junto a Periodo: "Si eliges un periodo, esta tarifa aplica SOLO a ese periodo y no afecta ninguna otra tarifa. Si lo dejas vacío, esta tarifa reemplaza la vigente para la misma combinación de Programa+Nivel."
- Al enviar: `POST /payment-concepts/{conceptId}/rates`. Éxito → regresa a `conceptos/form?mode=edit&id=<conceptId>` con toast. Manejar 409 (`DuplicatePaymentRateException` — ya existe una tarifa con ese periodo exacto para la misma combinación) con mensaje explicativo, y 400 (`InvalidPaymentRateDataException`, `PaymentConceptReferenceNotFoundException`/`ProgramNotFoundException`/`PeriodNotFoundException`).

### Router (`router.tsx`)
- Nueva ruta `conceptos/tarifa/form` (sin modo — siempre registro), toma `?conceptId=`.

## Fuera de alcance

- Cualquier UI para "calcular/resolver qué tarifa aplica a un pago" — pertenece al futuro módulo Finance, sin consumidor hoy.
- Editar o borrar una tarifa ya creada — no existe por diseño.

## Registro de ejecución

**Fecha**: 2026-07-28 — implementado end-to-end, `npx tsc --noEmit` limpio.

- `ConceptosForm.tsx`: agregada Sección 4 "Tarifas" (solo Ver/Editar, gate `!isRegister`, mismo criterio que `DirectorField`). Fetch de `GET /payment-concepts/{id}/rates` (flat, sin paginación) + `GET /programs`/`GET /periods` (size 100) para resolver labels vía `.find()` en memoria (mismo patrón que `GeneracionesList.tsx`). Tabla desktop + tarjetas mobile, columna Vigencia con badge "Vigente" cuando `validTo` es null, botón "+ Agregar Tarifa" → `conceptos/tarifa/form?conceptId=`. Reutiliza `LEVEL_LABELS` ya establecido en `ProgramasForm.tsx` (no se inventó un segundo set de labels).
- `ConceptosTarifaForm.tsx` (nueva): pantalla de solo registro (nunca edición — historial append-only). Toma `conceptId` de query param con manejo de error si falta (mismo patrón que `AsignarRol.tsx`). Fetch del concepto padre solo para mostrar su nombre en breadcrumb/header (mismo patrón que `PlanMateriaForm.tsx`). Campos: Programa (`SearchSelectField` opcional), Nivel (`<select>` opcional con `LEVEL_LABELS`), Periodo (`SearchSelectField` opcional, con ayuda contextual explicando el comportamiento de reemplazo vs. casillero independiente), Monto (numérico >0), Vigente desde (date, requerido). Envía `programId`/`level`/`periodId` como `undefined` (nunca string vacío) cuando no se seleccionan. Maneja 409 (`DuplicatePaymentRateException`), 400 (`InvalidPaymentRateDataException` + las 3 excepciones de referencia inexistente), 401/403.
- `router.tsx`: nueva ruta `conceptos/tarifa/form` → `<ConceptosTarifaForm />`, sin `RequireRole` (mismo criterio que el resto de `/conceptos/**`, no guardado hoy) y sin `?mode=` (siempre registro).

**Módulo "Conceptos de Pago" (4 fases) — CERRADO end-to-end** (Fase 1 catálogo, Fase 2 `PaymentRate` backend, Fase 3 wiring de `ConceptosForm`, Fase 4 esta — Tarifas UI).
