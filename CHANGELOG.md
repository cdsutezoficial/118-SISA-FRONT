# Changelog — 118-SISA-FRONT

Todos los cambios relevantes del prototipo frontend se documentan aquí en orden cronológico inverso.

---

## [2026-09-27] Panel de pago, aviso de cupo agotado y refresco del desplegable

Dos commits: `9a5f9ee` y `412be4a`.

### El Aspirante no ve por qué le rechazan

El flujo ramificaba por `message`, que es copy y se reescribe sin avisar. Tres fallos
distintos que llegan los tres como 409 mandaban a tres lugares distintos y no se
podían expresar sin adivinar la palabra.

- `ApiError` suma `code`, el discriminador estable que ya manda el backend.
- `ADMISSION_ERROR_CODES` (`apiClient.ts`) con los cuatro que el flujo necesita
  distinguir: `quotaReached`, `salesWindowClosed`, `candidateAlreadyExists`,
  `paymentWindowClosed`. `message` sigue siendo el respaldo donde el handler todavía
  no publica un código.
- `PagoNoDisponibleNotice` cubre el caso en que ya no se puede pagar, leyendo su
  código del backend. El cupo lleno **no** se contesta con un "intenta más tarde":
  no hay cola a la que unirse, es un tope y no una fila.
- `EvoPaymentPanel` (nuevo) junta en un solo lugar lo que el Aspirante necesita saber
  de su pago.

### Las carreras se piden al abrir el desplegable

La lista de carreras es un snapshot de lo que todavía tiene lugar, y otra persona
puede vender el último lugar después de que la página cargó: un Aspirante con el
formulario abierto hace rato estaba eligiendo sobre una lista que ya no decía la
verdad. Ahora `SearchSelectField` acepta `onOpen` y la lista se vuelve a pedir ahí.

Al abrir se compra la garantía de que la lista que se lee es la que acaba de llegar;
al montar el request no compra nada, porque si no elige carrera no se usa. Cambiar la
modalidad **no** la vuelve a pedir: la modalidad es un filtro puramente local sobre el
mismo arreglo, y pedirlo en cada toque solo agrega un spinner y una falla de red que
dejaría al Aspirante sin carreras. El refresh no muestra spinner ni error porque no
es indispensable, y ante un fallo se conservan las opciones previas.

### Fix: la carrera elegida sobrevivía al refresco que la quita

Era el bug de fondo. `selectedConfig` se derivaba de `configsAdmision` — la misma lista
que el refresco acababa de reemplazar — así que perder a la carrera justo cuando había
que conservarla, y el `&&` cortocircuitaba antes de poder re-agregarla. Cambiar de
modalidad además revivía la carrera anterior dentro del filtro nuevo.

- `lastKnownConfig` conserva el último config conocido.
- El fallback al snapshot se condiciona a que siga habiendo `admissionConfigId`, que es
  lo que se limpia al cambiar de modalidad.
- `resolveConfig(id)` hace lo mismo en el `onChange`, sin el cual volver a elegir la
  carrera retenida dejaba `programa` en vacío.
- La opción seleccionada se conserva aunque el refresco la quite de la lista, y el
  placeholder ya no dice "No hay carreras" cuando hay una selección retenida.

### Verificación

`npm run typecheck` y `npm run build` en verde. El warning de chunk >500 kB es
preexistente.

---

## [2026-07-15] Conexión con backend real — Detalle del Plan de Estudios (Fase 1b)

`PlanDetalle.tsx` reescrito de mock a datos reales:

- Carga `GET /plans/{id}` (id vía query param, patrón `loadStatus` con mensajes 404/401/403) + nombre de programa desde `GET /programs`.
- Encabezado real completo: escalares, badge `ACTIVE`/`INACTIVE`, servicio social con nivel mínimo resuelto.
- Niveles reales con badges Clases regulares/Estadías y materias (`subjects[]`) con estado vacío honesto; tabla → tarjetas en móvil.
- Secciones bloqueadas por backend sin datos inventados: "Asignar Materia" es texto informativo, pestaña Escalas solo informativa (ya no navega al mock `/escalas`), pestaña Historial eliminada (no existe endpoint de auditoría).
- Fix: "Editar Plan" ahora navega con `id` (antes abría el formulario sin plan).
- Fix compartido con `PlanesList.tsx`: `formatDate` parseaba fechas ISO date-only como medianoche UTC y mostraba el día anterior en husos al oeste de UTC (p. ej. America/Mexico_City); ahora construye la fecha en horario local.

---

## [2026-07-15] Conexión con backend real — Formulario de Planes de Estudio

`PlanForm.tsx` reescrito de mock a backend real (plan de implementación en `docs/plans/2026-07-15-plan-form-wiring.md`):

- **Campos reales del DTO**: `programId` (SearchSelectField desde `GET /programs`, inmutable en edición), `version`, `validityPeriod`, `titulationKey` (etiqueta "Clave de Titulación", reemplaza la antigua "Clave del Plan"), `effectiveFrom`, `totalLevels`, `minPassingGrade` (escala 0–10), `maxExtraordinaryExamsPerPeriod`, `requiresSocialService`, `socialServiceMinLevelId` (solo edición, `null` al crear).
- **Eliminado** el campo "Nombre del Plan" (decisión PO: el plan se identifica por programa + versión).
- **Niveles**: `levelNumber` explícito, tipo `REGULAR`/`INTERNSHIP` (se eliminan los tipos mock TSU/Continuidad), `description` opcional.
- **Crear**: `POST /plans` → `POST /plans/{id}/levels` secuencial, con reporte de fallos parciales y recuperación desde edición.
- **Editar**: `GET /plans/{id}` → `PUT /plans/{id}` → diff de niveles (DELETE → PUT ordenado topológicamente para evitar colisiones de `levelNumber` → POST). Ciclos puros de intercambio se bloquean pre-submit con mensaje guía. Manejo de 409 diferenciado (nivel con materias vs referenciado por servicio social).
- `shared/apiClient.ts`: nuevo helper `apiDelete` (mismas convenciones que el resto).
- Patrón responsivo completo (tabla → tarjetas móviles, grid apilado, botones full-width).
- Fuera de alcance (bloqueado por backend inexistente): materias por nivel, detalle del plan, escalas de calificación — ver `118-SISA-CLAUDE/docs/design/pendientes/2026-07-15-planes-form-wiring.md`.

---

## [2026-07-15] Nueva forma de trabajo — análisis documental antes de implementar

A partir de esta fecha, toda tarea (nueva implementación, nuevo requerimiento, actualización de funcionalidad o corrección) sigue este flujo obligatorio:

1. **Analizar la documentación** del proyecto `118-SISA-CLAUDE` (requerimientos, kernel de dominio, diseño) — es la fuente de verdad del negocio.
2. **Comparar** lo documentado contra lo ya implementado en `118-SISA-FRONT` y `118-SISA-BACK`, identificando brechas y desalineaciones.
3. **Crear un plan de implementación** y documentarlo en archivos MD dentro de cada repositorio que intervenga en la tarea.
4. **Explicar el plan en lenguaje llano**, recordando qué es cada clase/componente mencionado, ya que al crecer el proyecto los nombres internos se olvidan.

La regla operativa completa vive en `C:\workspace\SISAv2\CLAUDE.md` (sección *Task Workflow*), que es el archivo que Claude carga automáticamente al iniciar cada sesión.

---

## [2026-07-09] Diseño responsivo general + menú hamburguesa multilevel

### Nuevos componentes reutilizables (`src/app/shared/ui.tsx`)

| Exportación | Descripción |
|---|---|
| `SelectOption` | Interfaz `{ value: string; label: string }` — contrato de opción para selectores con búsqueda |
| `SearchSelectField` | Selector desplegable con buscador integrado; usa `SelectOption[]`; reemplaza copias locales del mismo patrón en 7+ páginas |

### Conexión con backend real — Programas Académicos

| Componente | Cambio |
|---|---|
| `pages/ProgramasList.tsx` | Reescritura completa: `apiGet /programs` + `apiPatch /programs/{id}/status`, paginación real, filtro por división desde `GET /divisions`, toggle de estado en lugar de botón eliminar |
| `pages/ProgramasForm.tsx` | Reescritura completa: `apiGet /programs/{id}` (ver/editar), `apiPost /programs` (registrar), `apiPut /programs/{id}` (guardar), 8 campos con validación inline, `SearchSelectField` para división |

### Diseño responsivo — Listas (patrón establecido)

Patrón aplicado uniformemente a `PlanesList.tsx`, `DivisionesList.tsx` y `ProgramasList.tsx`:

- **Contenedor**: `px-4 sm:px-8 py-6 sm:py-8`
- **Header**: `flex-col sm:flex-row` — botón de acción apilado en móvil
- **Filtros**: `flex-col sm:flex-row` — cada control ancho completo en móvil
- **Tabla**: `hidden md:block` — oculta en móvil
- **Tarjetas móviles**: `md:hidden space-y-3` — una tarjeta por registro con clave badge, toggle de estado, botones Ver/Editar full-width
- **Paginación móvil**: Anterior | `{page} / {totalPages}` | Siguiente

### Diseño responsivo — Formularios

Patrón aplicado a `ProgramasForm.tsx` y `DivisionesForm.tsx`:

- **Grid**: `col-span-12 sm:col-span-8/4` — todos los campos full-width en móvil
- **Botones de acción**: `flex-col-reverse sm:flex-row` + `w-full sm:w-auto` — apilados en móvil (primario arriba)
- **Breadcrumb**: `flex-wrap`

### Diseño responsivo — Login (`pages/Login.tsx`)

- Panel derecho: `px-5 sm:px-8 py-10 sm:py-12` — evita aplastamiento en 320–375 px
- Heading: `text-[22px] sm:text-[26px]`
- Contenedor raíz: `w-full overflow-x-hidden` — elimina scroll horizontal en móvil
- Panel derecho: `min-w-0` — previene que `flex-1` expanda más allá del viewport

### Menú hamburguesa + navegación multinivel (`layouts/AppLayout.tsx`)

#### Modelo de navegación

Reemplaza el array plano `NAV_ITEMS` con una estructura tipada de dos niveles:

```
NavEntry = NavLeaf | NavGroup
```

| Tipo | Campos clave |
|---|---|
| `NavLeaf` | `icon`, `label`, `base`, `path`, `roles` |
| `NavGroup` | `id`, `icon`, `label`, `children: NavLeaf[]` |

Árbol de navegación resultante:

```
Dashboard
▸ Configuración Académica  (id: 'config')
    Divisiones Académicas · Programas Educativos · Planes de Estudio
    Materias · Periodos Académicos · Grupos · Conceptos de Pago
    Escalas de Calificación
▸ Administración           (id: 'admin')
    Usuarios
▸ Módulos                  (id: 'modules')
    Admisión · Inscripciones
```

Agregar un nuevo nivel solo requiere añadir `children` a un `NavLeaf` existente — el sistema ya lo contempla.

#### Sidebar desktop (≥ md) — sin regresión

- Grupos con acordeón expand/colapsar (chevron animado)
- Estado `expandedGroups: Set<string>` — el grupo activo se auto-expande al navegar
- `config` abierto por defecto
- Colapsado (60px): lista plana de iconos de todas las hojas (`allLeafsForRole`) + tooltip hover
- Filtrado por rol: grupos con 0 hijos visibles se ocultan completamente

#### Menú hamburguesa mobile (< md)

- Icono `Menu` (hamburguesa) en el navbar izquierdo
- Drawer `fixed inset-0 z-50` — cubre 100% de la pantalla
- Animación: `transition-transform` desde `-translate-x-full` → `translate-x-0`
- Backdrop semitransparente (`bg-black/40`) cierra el drawer al tocar fuera
- Botón `X` en el header del drawer
- Grupos colapsables con borde-L como indicador de nivel
- Sección inferior: selector de rol (solo modo mock), cambiar contraseña, cerrar sesión
- Cierra automáticamente al navegar a cualquier ítem

#### Contenido principal

- Mobile: `ml-0` (sidebar no existe en el flujo del documento)
- Desktop: `md:ml-[240px]` / `md:ml-[60px]` según estado del sidebar

---

## [2026-07-08] Integración real backend — Divisiones y Programas

- `DivisionesList.tsx`, `DivisionesForm.tsx`: conectados a `GET/POST/PUT/PATCH /divisions`
- `ProgramasList.tsx`, `ProgramasForm.tsx`: conectados a `/programs` y `/divisions` (ver sección 2026-07-09 para detalles del refactor responsivo)
- `shared/apiClient.ts`, `shared/auth.ts`: modo real (`authMode === 'real'`) habilitado tras integración con `POST /auth/login`
