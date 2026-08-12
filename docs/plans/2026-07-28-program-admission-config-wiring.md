# Plan de implementación — Configuración de Admisión (ProgramAdmissionConfig)

**Fecha**: 2026-07-28
**Repos**: `118-SISA-BACK` (backend ya cerrado — `docs/plans/2026-07-28-program-admission-config.md`) · `118-SISA-FRONT` (este plan)

## Contexto

Pantalla nueva, greenfield total — nunca existió ni como mock ni especificada en Figma (revisado contra las 17 pantallas de `03-admision.md`). Prompt agregado en `118-SISA-CLAUDE/docs/design/figma/prompts/01-config-academica.md` (Pantallas 24-25, sin re-ejecución en Figma Make, decisión de José). Mismo criterio que Conceptos de Pago: el requerimiento (RF-ADM-001) está redactado en "Admisión" pero el backend vive en `academic_config`.

## Contrato de API (ya implementado y verificado en 118-SISA-BACK)

| Verbo | Endpoint | Body/Query |
|---|---|---|
| GET | `/program-admission-configs` | `status`, `programId`, `page`, `size` |
| POST | `/program-admission-configs` | `{ programId, periodId, targetGenerationId, isOffered, maxCandidates, opensAt, closesAt }` |
| GET | `/program-admission-configs/{id}` | — |
| PUT | `/program-admission-configs/{id}` | mismo shape que POST (no toca `status` ni `selectionStatus`) |
| PATCH | `/program-admission-configs/{id}/status` | `{ status: 'OPEN'\|'CLOSED' }` — toggle bidireccional |

`opensAt`/`closesAt` son `Instant` (fecha+hora, formato ISO 8601 con hora) — **primer campo de este tipo en el frontend hasta ahora** (todo lo demás wireado usaba `LocalDate`). Usar `<input type="datetime-local">` nativo (no existe un componente de date+time picker en `shared/ui.tsx` — solo `DatePicker`/`MiniDatePicker`, ambos de solo fecha; no se justifica construir un componente nuevo para una sola pantalla).

`selectionStatus` no se muestra ni se edita en ninguna pantalla — está fuera de alcance también en el backend para esta fase.

## Alcance

### `ConfiguracionAdmisionList.tsx` (pantalla nueva)
- Filtros: Programa Educativo, Estado (Todos/Abierto/Cerrado).
- Tabla: Programa, Periodo Destino, Generación Destino, Cupo Máximo, Ventana de Venta (`opensAt`–`closesAt` formateados), Estado (badge + `Switch` bidireccional, mismo patrón que Generaciones/Grupos/Conceptos — NO modal), Acciones (Editar).
- Responsivo: mismo patrón ya establecido (tabla desktop + tarjetas móvil).

### `ConfiguracionAdmisionForm.tsx` (pantalla nueva, modos registrar/editar — sin Ver Detalle, per el prompt)
- Cascada: Programa Educativo → Generación Destino (depende del programa, mismo patrón que `GruposForm.tsx`/`GeneracionesForm.tsx`).
- Periodo Destino: select independiente (no depende de Programa/Generación).
- ¿Está Ofertado?: `Switch`.
- Cupo Máximo: input numérico.
- Apertura/Cierre de Venta: `input type="datetime-local"`, con validación cliente `closesAt > opensAt` antes de enviar (el backend también lo valida, pero dar feedback inmediato).
- Estado NO se edita acá — mismo criterio que el resto del módulo.

### Router (`router.tsx`) y sidebar (`AppLayout.tsx`)
- Nuevas rutas `configuracion-admision`, `configuracion-admision/new`, `configuracion-admision/form`.
- Nueva entrada de sidebar "Configuración de Admisión" en la sección Configuración Académica (entre Grupos y Conceptos de Pago, o donde tenga sentido cronológico — a decidir al implementar).

## Fuera de alcance

- Panel de métricas (fichas disponibles/vendidas/pagadas) — necesita `Candidate`, no existe.
- Cualquier pantalla del bounded context `admission` en sí (Candidatos, Selección, etc. — siguen mock).

## Registro de ejecución

**Fecha:** 2026-07-28

- Creadas `src/app/pages/ConfiguracionAdmisionList.tsx` y `src/app/pages/ConfiguracionAdmisionForm.tsx`, siguiendo el patrón de `GeneracionesList.tsx`/`GeneracionesForm.tsx` (paginación server-side, tabla desktop + tarjetas móvil, Switch bidireccional sin modal) y el cascade Programa→Generación de `GruposForm.tsx`.
- Diferencia clave detectada vs. `GruposForm.tsx`: en `GruposForm`, `programId` es un filtro UI-only que NUNCA se envía (el backend lo resuelve desde `generationId`). Aquí `programId` SÍ es un campo real de `CreateProgramAdmissionConfigRequest`/`UpdateProgramAdmissionConfigRequest` — viaja en el payload junto con `targetGenerationId`. Se respetó el contrato exacto de los DTOs backend.
- Filtros del listado: solo Programa Educativo + Estado (sin buscador de texto libre) — el contrato de `GET /program-admission-configs` solo acepta `status`/`programId`/`page`/`size`, y el prompt de Pantalla 24 tampoco especifica un campo de búsqueda.
- `opensAt`/`closesAt`: confirmado que el backend no tiene `ObjectMapper`/Jackson custom (`grep` sobre `application.properties` y búsqueda de `JacksonConfig`, ambos sin resultados) y el IT test usa `Instant.parse("2029-06-01T00:00:00Z")` — Jackson por defecto serializa `Instant` como ISO-8601 con sufijo `Z`. Se agregaron helpers locales `toDatetimeLocalInput`/`fromDatetimeLocalInput` en `ConfiguracionAdmisionForm.tsx` que convierten entre el string ISO del backend y el formato local `YYYY-MM-DDTHH:mm` que espera `<input type="datetime-local">`, usando los componentes de fecha LOCALES del objeto `Date` (no UTC) para que el picker muestre la hora en el huso horario del navegador.
- Validación cliente `closesAt > opensAt`: se agregó un handler `onChange` en ambos campos que compara las fechas en cada cambio y muestra un `FieldError` bajo Cierre de Venta; el botón de submit se deshabilita mientras el error esté activo, además de una revalidación defensiva al inicio de `handleSubmit`.
- Roles: se confirmó en `SecurityFilterConfig.java` (línea 219-225) que `/program-admission-configs` usa el mismo patrón `hasAnyRole("ADMIN", "SERVICIOS_ESCOLARES")` que `/generations`/`/periods`/`/divisions` — se replicó el mismo `RequireRole` solo en la ruta de listado.
- Sidebar: entrada "Configuración de Admisión" agregada entre "Grupos" y "Conceptos de Pago" en `AppLayout.tsx` — misma posición que sugiere el plan original, por depender conceptualmente de Generación (como Grupos) y preceder a Conceptos en el flujo de configuración.
- `npx tsc --noEmit` pasa limpio, sin errores.
