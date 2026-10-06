# Plan — Wiring del Listado de Candidatos (Pantalla 3) al backend real

**Fecha:** 2026-09-30
**Alcance:** `CandidatosList.tsx` — lista de candidatos del proceso de admisión
**Repos:** `118-SISA-FRONT` (consumidor), `118-SISA-BACK` (contrato `GET /candidates`)

---

## Objetivo

Dejar de renderizar `mockCandidates` en el listado de Candidatos y consumir
`GET /candidates` con filtros, búsqueda y paginación server-side, respetando el
scope por rol que el backend ya resuelve (Servicios Escolares ve todo; Director de
División solo su división).

---

## Contrato consumido

`GET /candidates?status=&programId=&periodId=&search=&page=&size=` →
`{items, totalElements, totalPages, page, size}`, donde cada fila es
`{id, folio, fullName, curp, programId, programName, status, registeredAt}`
(ver `118-SISA-BACK/docs/plans/2026-09-30-candidate-list.md`).

Tipos espejo nuevos en `modules/admision/data/types.ts`:

- `CandidateListRow`
- `CandidateListPage`

`programId` es el id del `AcademicProgram`, así que el valor elegido en el filtro
de carrera hace round-trip directo.

---

## Cambios aplicados

### `CandidatosList.tsx` (reescrito)

- Molde: `ConfiguracionAdmisionList.tsx` (fetch real, `ErrorBanner`, estados
  `loadStatus`).
- **Filtros:** carrera (`/programs`, `size=100`), estado (6 estados de
  `STATUS_META`), periodo (`/periods`, `size=100`), búsqueda libre (debounce 300 ms).
- **Periodo activo preseleccionado** al montar: `/periods?status=ACTIVE&size=1`
  (mismo patrón que `GruposList.tsx`).
- **Paginación** server-side, `perPage = 20` (antes 10, mock).
- **Columnas:** Folio, Nombre Completo, Carrera Solicitada (`programName`),
  Estado (`statusBadgeMap` desde `STATUS_META`), Fecha de Registro
  (`registeredAt` ISO → `dd/MM/yyyy`).
- **Acciones de fila (esta iteración):** *Ver detalle* siempre, y
  *Confirmar Pago Ficha* solo para `status === 'REGISTERED'`.
  Se retiraron las acciones que dependían del `Candidate` mock
  (Registrar Examen/Inducción, Cambiar Carrera) porque el backend no las alimenta
  en el listado y las pantallas destino siguen mock.
- Errores: `ErrorBanner` con mensaje específico para 401/403, genérico para el resto.

### Tipos

- `CandidateListRow` / `CandidateListPage` añadidos a `modules/admision/data/types.ts`.

### Guards de ruta (`router.tsx`)

- `candidatos/pago-ficha` y `candidatos/pago-induccion` pasan de
  `['FINANZAS']` a `['SERVICIOS_ESCOLARES', 'DIRECTOR_DIVISION', 'FINANZAS']`.
- (`candidatos` y `candidatos/detalle` ya incluían Servicios Escolares y Director.)

### Permiso `CANDIDATES_READ` (`RoleContext.tsx` + `Sidebar.tsx`)

- Se alinea la visibilidad del ítem "Candidatos" del sidebar con el permiso que el
  backend exige en `GET /candidates`: `permissionKeys: ['CANDIDATES_READ']`
  (antes reutilizaba `PROGRAM_ADMISSION_CONFIGS_READ` del módulo).
- Se añade `CANDIDATES_READ` a los sets mock de `ADMINISTRADOR`,
  `SERVICIOS_ESCOLARES` y `DIRECTOR_DIVISION` (el seed real ya lo otorga a esos
  roles) para que el ítem no desaparezca en modo mock.

---

## No se tocó (a propósito)

- `mockCandidates.ts` y `CambiarProgramaModal.tsx` siguen existiendo: los consume el
  resto del módulo de Admisión y otras pantallas mock.
- `CandidatoDetalle.tsx` sigue mock: no se cablea en esta iteración.
- No hay React Query ni caché: `fetch` vía `apiClient`, igual que el resto del front.

---

## Verificación

- `npm run typecheck` → **EXIT 0**.
- `npm run build` → **OK** (1830 módulos).
- Backend verificado por separado (plan del BACK): IT del search 8/8, suite unitaria
  1062/1062.
- **Pendiente (manual):** abrir `/admision/candidatos` contra el backend real como
  Servicios Escolares y como Director de División, y validar filtros/paginación,
  la preselección del periodo activo y la acción "Confirmar Pago Ficha".
