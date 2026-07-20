# Plan de implementación — Clasificaciones de Materias (nuevo módulo de pantallas)

**Fecha**: 2026-07-20
**Estado**: COMPLETADO, VERIFICADO Y COMMITEADO (2026-07-20) — ver "Registro de ejecución" al final
**Repos involucrados**: `118-SISA-FRONT` (implementación) · `118-SISA-CLAUDE` (spec de pantallas nueva, ver `docs/design/figma/prompts/01-config-academica.md`, sección "Corrección — Clasificación de Materias", Pantallas 20-21)
**Análisis previo**: `118-SISA-BACK` ya tiene el CRUD completo de `SubjectClassification` (5 fases, ver `118-SISA-BACK/docs/plans/2026-07-15-subject-classification-crud.md`). El frontend no tiene ni mock ni pantalla para este catálogo — hoy solo existe como texto libre/dropdown hardcodeado dentro de `MateriasForm.tsx`/`EscalaForm.tsx` (ambas mock puro todavía).

## Contexto

José confirmó (2026-07-20) que Servicios Escolares necesita administrar este catálogo directamente, no solo elegirlo al vuelo dentro de otro formulario — igual que Divisiones/Programas tienen su propia sección. No existía spec de pantalla para esto (gap confirmado contra los 19 prompts de Figma del módulo); se agregó como corrección (Pantallas 20-21) siguiendo el mismo patrón que la corrección de Escalas de Calificación (Pantallas 17-18).

## Alcance

Dos pantallas nuevas, greenfield (no hay mock que migrar, a diferencia de Planes/Programas):
1. `ClasificacionesList.tsx` — listado con búsqueda, filtro de estado, paginación, toggle activar/desactivar.
2. `ClasificacionesForm.tsx` — registrar/editar (sin modo "Ver Detalle" — solo 2 campos, no justifica una tercera vista, decisión ya tomada en el prompt de Figma).

Clon directo del patrón de `DivisionesList.tsx`/`DivisionesForm.tsx` (mismo módulo `academic_config`, mismo backend ya en `main`), simplificado al shape más chico de `SubjectClassification`.

## Contrato de API (ya implementado y verificado en 118-SISA-BACK)

| Verbo | Endpoint | Roles |
|---|---|---|
| GET | `/subject-classifications` | ADMIN, SERVICIOS_ESCOLARES |
| POST | `/subject-classifications` | ADMIN, SERVICIOS_ESCOLARES |
| GET | `/subject-classifications/{id}` | ADMIN, SERVICIOS_ESCOLARES |
| PUT | `/subject-classifications/{id}` | ADMIN, SERVICIOS_ESCOLARES |
| PATCH | `/subject-classifications/{id}/status` | ADMIN, SERVICIOS_ESCOLARES |

Shape (`SubjectClassificationResponse`): `{ id: string, name: string, code: string, status: 'ACTIVE' | 'INACTIVE' }`. Sin `description`, sin `directorPersonId`, sin contador de hijos — a diferencia de `DivisionResponse`, que tiene los cuatro.

**Diferencia de negocio clave a respetar en el form**: `code` es único (backend responde 409 `DuplicateClassificationCodeException` en colisión), `name` **NO** es único — no replicar la validación de nombre único que sí tiene `DivisionesForm` (ahí no hay ninguna, el 409 de Division ya cubre nombre+código juntos; acá el mensaje 409 del backend solo puede ser por código, así que el mensaje de error genérico en el form debe decir "la clave ya está en uso", no "el nombre o la clave").

## Archivos a crear

- `src/app/pages/ClasificacionesList.tsx` — clon de `DivisionesList.tsx`: mismo patrón de fetch (`apiGet` con `status`/`search`/`page`/`size`), debounce de búsqueda, tabla desktop + cards mobile, toggle de estado vía `apiPatch('/subject-classifications/{id}/status', { status })`. Tabla con columnas: #, Nombre, Clave, Estado, Acciones (sin columna "Programas"/hijos — no existe en este shape). Sin ícono "Ver" en Acciones (solo Editar), consistente con que el form no tiene modo view.
- `src/app/pages/ClasificacionesForm.tsx` — clon de `DivisionesForm.tsx`, recortado a 2 campos (`name`, `code`), sin `description`/`directorPersonId`. Sin soporte de `mode=view` (`useFormMode`/`ModeSwitcher` solo se usan en `register`/`edit`).

## Archivos a modificar

- `src/app/router.tsx` — agregar rutas `clasificaciones`, `clasificaciones/new`, `clasificaciones/form`, siguiendo exactamente el bloque de comentario y el guard de `divisiones` (línea ~245-258): envolver solo la ruta de listado en `RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']}` (el backend ya lo exige en los 5 endpoints; el guard client-side solo evita el 403/blank state para otros roles, mismo razonamiento documentado en el comentario de Divisiones).
- Sidebar / navegación del módulo Configuración Académica — agregar el link "Clasificaciones de Materias" donde estén Divisiones/Programas/Materias (revisar `AppLayout.tsx` o el componente de sidebar específico del módulo al implementar; no confirmado en este plan porque no se leyó ese archivo todavía).
- (Fuera de este plan, explícitamente diferido) `MateriasForm.tsx`/`EscalaForm.tsx` — hoy tienen "Clasificación" como campo mock; conectarlos al catálogo real (`GET /subject-classifications` para poblar el Select) es trabajo de wiring de Materias/Escalas, no de este plan. Se menciona para que no se pierda de vista cuando llegue ese turno.

## Fuera de alcance

- Wiring de `MateriasForm`/`EscalaForm` al catálogo real (ver nota arriba).
- `GradeScale`/`GradeScaleEntry` — depende de que este catálogo exista en el frontend para poblar su propio Select, pero es un plan aparte.

## Registro de ejecución (2026-07-20)

### Commits en `main` (118-SISA-FRONT)

| Commit | Contenido |
|---|---|
| `784216a` | `ClasificacionesList.tsx` + `ClasificacionesForm.tsx` nuevos, rutas `clasificaciones`/`clasificaciones/new`/`clasificaciones/form` en `router.tsx`, entrada de sidebar en `AppLayout.tsx` |

Este commit incluye también el registro del "Registro de ejecución" en este mismo archivo (no se separó en un commit de docs aparte).

### Qué se implementó

- **`ClasificacionesList.tsx`**: clon directo de `DivisionesList.tsx` — mismo patrón de fetch (`apiGet` con `status`/`search`/`page`/`size`), debounce de búsqueda, tabla desktop + cards mobile, toggle de estado vía `apiPatch('/subject-classifications/{id}/status')`. Columnas: Nombre, Clave, Estado, Acciones. Sin columna "Programas" (no existe en este shape) y sin ícono "Ver" en Acciones (solo Editar).
- **`ClasificacionesForm.tsx`**: clon de `DivisionesForm.tsx` recortado a 2 campos (`name`, `code`). Sin `description`/`directorPersonId`. **Sin soporte de modo Ver**: a diferencia de Divisiones, este form no usa el `ModeSwitcher` compartido (que expone tabs Registrar/Ver/Editar) — solo tiene título+breadcrumb dinámicos entre "Registrar"/"Editar" y botones Cancelar/Guardar. Cualquier `mode` distinto de `register` se trata como edición.
- **Mensaje 409 específico de clave**: "La clave ya está en uso por otra clasificación." (no "el nombre o la clave", ya que `name` no es único en este aggregate — la única diferencia de negocio real respecto a Divisiones).
- **`router.tsx`**: bloque `clasificaciones` agregado siguiendo exactamente el patrón de `divisiones` — solo la ruta de listado envuelta en `RequireRole allowedRoles={['ADMINISTRADOR', 'SERVICIOS_ESCOLARES']}`, mismo comentario explicando el razonamiento (backend ya lo exige, el guard solo evita 403/blank state).
- **`AppLayout.tsx`**: entrada "Clasificaciones de Materias" agregada al grupo `Configuración Académica`, entre "Materias" y "Periodos Académicos" (ícono `Tags` de `lucide-react`, no usado antes en este archivo). **Decisión de posición no confirmada por el PO** — el plan original marcaba la ubicación exacta como pendiente de revisar en el archivo; se colocó junto a "Materias" por relación de dominio (la clasificación es un sub-catálogo de materia), pero el orden final queda a criterio de José.

### Verificación

- `pnpm typecheck` (`tsc --noEmit`): **0 errores**.
- `pnpm build` (`vite build`): **exitoso** (advertencia preexistente de chunk >500kB, no relacionada con este cambio).
- Nota de entorno: la sesión de shell tenía Node v20.19.3 activo por defecto (vía symlink `nvm4w`), incompatible con `pnpm@11.10.0` (requiere Node ≥22.13). Se cambió a Node v24.13.0 con `nvm use 24.13.0` y se corrió `corepack enable` para exponer el shim `pnpm` en el PATH — esto es una config de entorno local, no un cambio de proyecto. También fue necesario `pnpm approve-builds --all` (pnpm 11 bloquea scripts de postinstall de `esbuild`/`@tailwindcss/oxide` por política de supply-chain); el `pnpm-workspace.yaml` que esto modifica se revirtió tras la verificación para no mezclarlo con el commit de la feature.

### Fuera de alcance (confirmado, sin cambios)

- Wiring de `MateriasForm.tsx`/`EscalaForm.tsx` al catálogo real de clasificaciones — ambos siguen 100% mock, tal como estaba documentado en el plan.
