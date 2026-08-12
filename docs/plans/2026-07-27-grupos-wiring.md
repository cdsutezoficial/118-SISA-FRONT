# Plan de implementación — Grupos (wiring a backend real)

**Fecha**: 2026-07-27
**Estado**: COMPLETADO
**Repos involucrados**: `118-SISA-FRONT` (implementación) · `118-SISA-BACK` (`Group` cerrado el mismo día, `docs/plans/2026-07-20-generation-group.md`) · `118-SISA-CLAUDE` (corrección de Pantallas 8-9 en `docs/design/figma/prompts/01-config-academica.md`, gap de diseño: faltaban Generación y Turno)

## Contexto

`GruposList.tsx`/`GruposForm.tsx` existían como mock desde el inicio del proyecto (Figma Make base), sin ningún concepto de `Generación` ni `Turno` — ninguno de los dos existía en el dominio cuando se generaron esas pantallas. Antes de cablear, se corrigió el prompt de Figma (decisión de José: sin re-ejecutar en Figma Make, el prompt corregido es la fuente de verdad directa para el código).

## Alcance

Reescritura completa de `GruposList.tsx` y `GruposForm.tsx`, de mock a `/groups` real.

## Contrato de API (ya implementado y verificado en 118-SISA-BACK)

| Verbo | Endpoint | Query/Body |
|---|---|---|
| GET | `/groups` | `status`, `search`, `programId`, `generationId`, `page`, `size` — **sin** `periodId` ni `planLevelId` |
| POST | `/groups` | `{ generationId, periodId, planLevelId, code, maxCapacity, shift }` — `programId`/`status` nunca los envía el cliente |
| GET | `/groups/{id}` | — |
| PUT | `/groups/{id}` | mismo shape que POST |
| PATCH | `/groups/{id}/status` | `{ status: 'OPEN'\|'CLOSED' }` — toggle bidireccional |

`GroupResponse`/`GroupListItemResponse`: `programId` viaja denormalizado (resuelto en backend desde `generationId`).

**Limitación de diseño aceptada** (no es un bug): Periodo y Nivel no tienen query param real en `GET /groups`. Se filtran client-side sobre la página ya traída del servidor — ver comentario al inicio de `GruposList.tsx`.

## Archivos modificados

- `src/app/pages/GruposList.tsx` — filtros Periodo/Programa/Generación/Nivel (Programa→Generación→Nivel en cascada), tabla con columnas nuevas Generación y Turno, switch bidireccional Abierto/Cerrado (reemplaza el modal "Cerrar grupo" del mock original — decisión de José: consistencia con el patrón de Generaciones/Divisiones).
- `src/app/pages/GruposForm.tsx` — 3 modos (registrar/editar/ver), cascada Programa (solo UI, no se envía) → Generación → Nivel del Plan (depende del `planId` de la Generación elegida, resuelto vía `GET /plans/{planId}`, ya que `PlanLevel` no tiene catálogo propio).
- Router/sidebar: sin cambios — las rutas `/grupos`, `/grupos/new`, `/grupos/form` ya existían y eran correctas.

## Fuera de alcance

- Auto-creación de grupo al cerrar un periodo, asignación de estudiantes a grupos — mismos límites ya documentados en el plan de backend.

## Judgment Day — revisión adversarial ciega (3 rondas)

Ejecutada sobre el diff completo (backend `Group` + este wiring de frontend), 2 jueces en paralelo por ronda, sin verse entre sí.

- **Backend + `GruposForm.tsx`**: limpios desde la Ronda 1 — las 13 decisiones de diseño verificadas (validación cross-aggregate de `planLevelId`, denormalización de `programId`, separación de excepciones, nombre de tabla, cascada de selects, payload sin `programId`, etc.) coincidieron con lo implementado.
- **`GruposList.tsx` — Ronda 1** (confirmado por ambos jueces): el contador "N resultados" (client-side, tras filtrar por Periodo/Nivel) no coincidía con el pie de paginación (`totalElements` del servidor, sin ese filtro extra). **Fix**: ambos números ahora derivan de `displayedGroups.length`.
- **Ronda 2** (confirmado por ambos jueces): el fix de la Ronda 1 dejó expuesta la columna `#` de fila, que seguía calculando el offset de servidor (`(page-1)*perPage+i+1`) en vez de `i+1` relativo al conjunto ya filtrado. **Fix** aplicado + limpieza de los campos `totalElements`/`page`/`size` sin usar en el tipo `GroupsPageResponse`.
- **Ronda 3** (contradicción entre jueces, no confirmado): un juez calificó como CRITICAL que el texto "Mostrando X–Y de Z" pierde sentido semántico cuando hay múltiples páginas de servidor + filtros de Periodo/Nivel activos simultáneamente; el otro juez lo evaluó y lo consideró un trade-off intencional ya documentado desde la Ronda 1. **Decisión de José**: aceptar como limitación conocida de esta primera rebanada (no perseguir con una Ronda 4). Se aplicaron sin nueva ronda de jueces: (a) el mensaje de "sin resultados" en móvil ahora distingue error de servidor vs. filtro sin resultados, (b) el pie de paginación en móvil se muestra siempre (con "Sin registros" si vacío), igual que en desktop.

## Verificación

- `npx tsc --noEmit`: 0 errores (verificado de forma independiente, no solo por el reporte del agente implementador).
- `pnpm typecheck` está bloqueado en este entorno por un gate de supply-chain preexistente y no relacionado (`esbuild`/`@tailwindcss/oxide` con build scripts no aprobados) — se usó `npx tsc --noEmit` como equivalente.

## Decisiones/juicios propios

- No existe "inscritos" (conteo de estudiantes) en `Group` — la columna Capacidad muestra solo `maxCapacity` ("N cupos"), no se inventó un número de inscritos que no existe en el dominio.
- Editar/Ver ya no se deshabilitan cuando el grupo está Cerrado (el mock viejo sí lo hacía) — se alineó al mismo criterio que Generaciones, que no bloquea acciones por estado.
- No hay excepción 409 de código duplicado para `Group` — el form no maneja ese caso (solo 400/404/401/403), a diferencia de `GeneracionesForm.tsx` que sí maneja 409 por `number` duplicado.
