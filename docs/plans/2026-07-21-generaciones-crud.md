# Plan de implementación — Generaciones (nuevo módulo de pantallas)

**Fecha**: 2026-07-21
**Estado**: PENDIENTE
**Repos involucrados**: `118-SISA-FRONT` (implementación) · `118-SISA-CLAUDE` (spec de pantallas nueva, `docs/design/figma/prompts/01-config-academica.md`, sección "Adición — Generaciones", Pantallas 22-23)
**Análisis previo**: `118-SISA-BACK` ya tiene el CRUD completo de `Generation` (cerrado 2026-07-21, `docs/plans/2026-07-20-generation-group.md`). El frontend no tiene absolutamente nada — ni mock, ni pantalla, ni referencia — es prerequisito bloqueante de `Group` (`GruposList.tsx`/`GruposForm.tsx`, mock hoy, sin `generationId` en ningún lado).

## Contexto

Mismo patrón que Clasificaciones (2026-07-20): pantalla nunca especificada en Figma, greenfield total. Se agregó el prompt (Pantallas 22-23) siguiendo el mismo criterio (Listado + Registrar/Editar, sin modo Ver Detalle).

## Alcance

Dos pantallas nuevas:
1. `GeneracionesList.tsx` — listado con filtro por programa y estado, búsqueda por código, switch de estado (toggle simple, NO la acción contextual de Periodos).
2. `GeneracionesForm.tsx` — registrar/editar. Sin modo Ver.

Clon del patrón de `ClasificacionesList.tsx`/`ClasificacionesForm.tsx`, con una diferencia importante: el form tiene selects relacionados en cascada (Programa → Plan) y un tercer select independiente (Periodo de Inicio), a diferencia de los campos planos de Clasificaciones. Para el patrón de selects en cascada, clonar `GruposForm.tsx` (mock actual, ya tiene Programa→Nivel en cascada) en vez de reinventar.

## Contrato de API (ya implementado y verificado en 118-SISA-BACK)

| Verbo | Endpoint | Body/Query |
|---|---|---|
| GET | `/generations` | `status`, `search` (contra `code`), `programId`, `page`, `size` |
| POST | `/generations` | `{ planId, startPeriodId, number }` — `code`/`status` NO se envían, el backend los calcula/asigna |
| GET | `/generations/{id}` | — |
| PUT | `/generations/{id}` | mismo shape que POST |
| PATCH | `/generations/{id}/status` | `{ status: 'ACTIVE'\|'FINISHED' }` — toggle simple, ambas direcciones válidas |

Respuesta (`GenerationResponse`/`GenerationListItemResponse`): `{ id, planId, startPeriodId, programId, number, code, status }`. `programId` viaja denormalizado — no hace falta resolverlo vía `planId`.

**Regla de negocio a NO romper en el form**: un programa puede tener más de una generación en el mismo año calendario (José, 2026-07-20) — no armar ninguna validación cliente que asuma "una generación por año". El único límite real es que `number` no se repita dentro del mismo programa (el backend responde 409 `DuplicateGenerationNumberException` si choca).

## Archivos a crear

- `src/app/pages/GeneracionesList.tsx` — clon de `ClasificacionesList.tsx`: `apiGet('/generations', ...)` con `status`/`search`/`programId`/`page`/`size`, debounce de búsqueda, filtro de Programa (`SearchSelect` contra `/programs`) y de Estado, tabla desktop + cards mobile, switch de estado (`apiPatch('/generations/{id}/status', { status })`, refetch tras cambiar). Columnas: Código, Programa, Plan (resolver `planId` → versión contra `GET /plans/{id}` o, mejor, contra el `GET /plans` ya paginado si el volumen lo permite — decidir al implementar cuál evita más round-trips), Periodo de Inicio (resolver `startPeriodId` contra `/periods`), Estado, Acciones.
- `src/app/pages/GeneracionesForm.tsx` — clon de `ClasificacionesForm.tsx` en cuanto a estructura (sin modo Ver, `useFormMode` register/edit), pero con selects relacionados clonando el patrón de cascada de `GruposForm.tsx` (Programa → filtra Plan). Periodo de Inicio es un tercer select independiente, no depende de Programa/Plan. Campo Número (input numérico). Sin campo de Estado ni de Código (ambos son responsabilidad del servidor) — mostrar el código ya generado solo en modo Editar (viene en la respuesta del `GET /generations/{id}`), no como preview client-side en modo Registrar (a diferencia de `GruposForm.tsx`'s `clavePreview`, que sí calcula un preview local — acá no hace falta duplicar la lógica de cálculo del año+consecutivo en el cliente, es información que ya viaja resuelta desde el backend en cuanto se guarda).

## Archivos a modificar

- `src/app/router.tsx` — rutas `generaciones`, `generaciones/new`, `generaciones/form`, guard `RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']}` en la ruta de listado, mismo criterio que Divisiones/Clasificaciones/Periodos.
- `src/app/layouts/AppLayout.tsx` — entrada de sidebar "Generaciones" en la sección Configuración Académica.

## Fuera de alcance

- `Group`/`GruposList.tsx`/`GruposForm.tsx` — es el siguiente trabajo, consume `Generation` pero es un esfuerzo aparte (backend de `Group` tampoco existe todavía).

## Registro de ejecución

**Fecha de ejecución**: 2026-07-21
**Estado**: COMPLETADO

### Archivos creados

- `src/app/pages/GeneracionesList.tsx` — listado con filtros Programa (`SearchSelectField` contra `/programs`, size 100) + Estado (Todos/Activa/Finalizada), búsqueda debounced por `code`, tabla desktop (#, Código, Programa, Plan, Periodo de Inicio, Estado, Acciones) + cards mobile, switch de estado vía `apiPatch('/generations/{id}/status', ...)` + refetch, paginación, loading/empty/error states.
- `src/app/pages/GeneracionesForm.tsx` — registrar/editar, sin modo Ver. Cascada Programa → Plan (mismo patrón de reset que `GruposForm.tsx`), Periodo de Inicio independiente, Número de Generación (numérico). Sin campo Estado ni Código en modo Registrar; en modo Editar, campo Código read-only tomado de `GET /generations/{id}` (no hay cálculo cliente de código, a diferencia de `clavePreview` de `GruposForm.tsx`). Nota informativa con ícono `Info` debajo del formulario, texto exacto del spec.

### Archivos modificados

- `src/app/router.tsx` — imports + rutas `generaciones`, `generaciones/new`, `generaciones/form`. `RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']}` solo en la ruta de listado, mismo criterio que `divisiones`/`clasificaciones`/`periodos`. Bloque insertado entre `periodos` y `grupos`.
- `src/app/layouts/AppLayout.tsx` — entrada "Generaciones" en la sección Configuración Académica del sidebar (entre Periodos Académicos y Grupos), ícono `Users2` (no usado previamente en el archivo; `Users` ya estaba tomado por Grupos).

### Enfoque de cascada y resolución de labels

- **Cascada Programa → Plan**: ambos catálogos (`/programs` size 100, `/plans` size 200) se cargan una sola vez al montar el form. `planOptions` se deriva filtrando `plans` por `p.programId === programId` en cada render — no hay refetch al cambiar de programa. `handleProgramChange` limpia `planId` al cambiar de programa (mismo patrón que `GruposForm.tsx`'s `onChange={v => { setPrograma(v); setNivel('') }}`). En modo Editar, el efecto de carga setea `programId` directamente desde `data.programId` (denormalizado en la respuesta) sin pasar por `handleProgramChange`, así que no se pierde el `planId` cargado.
- **Resolución de labels en la tabla**: mismo patrón que `programLabel()` de `PlanesList.tsx` — `programs`/`plans`/`periods` se cargan una vez en `GeneracionesList.tsx` y tres funciones puras (`programLabel`, `planLabel`, `periodLabel`) hacen `.find()` por id contra esos arrays en memoria para pintar cada fila.

### GET /plans — soporte de filtrado por programId

**Confirmado: SÍ soporta filtrado server-side por `programId`.** `PlanesList.tsx` (línea 103-104, código preexistente) ya llama `apiGet('/plans', { programId: programFilter || undefined, ... })`. No fue necesario ningún workaround client-side; se reutilizó el mismo query param. (En `GeneracionesList.tsx`/`GeneracionesForm.tsx` no se usa `programId` como filtro de `/plans` porque ambas pantallas necesitan el catálogo completo de planes para resolver labels/cascada en memoria — se pidió `size: 200` una sola vez en vez de refiltrar por request.)

### Verificación

- `tsc --noEmit` (Node 24 vía `node_modules/typescript/bin/tsc`): **0 errores**.
- `vite build` (Node 24 vía `node_modules/vite/bin/vite.js`): **build exitoso**, sin errores. Advertencia preexistente de chunk >500kB (no relacionada a este cambio).

### Decisiones/juicios propios

- Ícono de sidebar: `Users2` (lucide-react), ya que `Users` estaba tomado por Grupos y ninguno de los íconos ya importados en `AppLayout.tsx` encajaba con el concepto de cohorte.
- Posición en el sidebar: entre "Periodos Académicos" y "Grupos" — no especificado explícitamente en el plan, pero sigue el orden de dependencia del dominio (Periodo → Generación → Grupo, este último aún mock y fuera de alcance).
- Campo Código en modo Editar: no estaba definido en el grid de 12 columnas del spec (Fila 2 solo definía Periodo de Inicio 6 cols + Número 3 cols). Se agregó como un tercer campo de 3 cols en la misma fila (Periodo 6 + Número 3 + Código 3 = 12), visible solo cuando `!isRegister`.
- No se agregó ninguna validación cliente de "una generación por programa por año" — se respetó explícitamente la regla de negocio confirmada por José (2026-07-20).
