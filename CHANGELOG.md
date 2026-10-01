# Changelog — 118-SISA-FRONT

Todos los cambios relevantes del prototipo frontend se documentan aquí en orden cronológico inverso.

---

## [2026-10-01] El aviso de "no se puede pagar" ya no convive con un botón de pagar

Commit: pendiente.

### Qué cambió

- `PortalFichaPago.tsx`: con `pagoNoDisponible` puesto, el botón se **deshabilita**,
  se **relabela** a "Pago en línea no disponible" y pasa a `secondary`. El párrafo
  que explica que el pago se hace en esta misma página se oculta, porque con el pago
  bloqueado también es falso.
- `FichaConfirmacion.tsx`: lo mismo. El aviso y el botón habilitable estaban en las
  dos pantallas de pago, no solo en el portal, y arreglar una sola dejaba la otra
  contradiciéndose.
- `FichaPagoPendiente.tsx`: el bloque "¿Por qué esta fecha?" deja de ser texto fijo y
  describe lo que el backend mandó. Tres variantes según lo que llegó: si ambas fechas
  coinciden, si el pago cierra antes que la inscripción, o si no vino la de inscripción.

### Por qué el botón se apaga en vez de solo avisar

`pagoNoDisponible` no es un toast que se va: es un hecho permanente sobre la ficha, y el
backend lo devolvió ya con su propio motivo (`ADMISSION_QUOTA_REACHED`,
`ADMISSION_PAYMENT_WINDOW_CLOSED`). Con el aviso arriba y un botón "Pagar en línea —
$0.00" habilitado abajo, la pantalla se contradecía y empujaba a repetir un intento que
iba a devolver el mismo 409. Insistir no cambia nada, así que el botón deja de ofrecer
esa opción. El motivo sigue siendo el del backend: el front solo apaga y rotula, no
inventa la razón.

La variante visual acompaña: `secondary` en vez de `primary` verde, que en este flujo ya
significa "pago confirmado" (`FichaPagoConfirmado`). Un botón verde deshabilitado al 60%
de opacidad todavía se lee como la acción principal de la pantalla.

### Por qué la explicación de la fecha ya no afirma nada que no se pueda comprobar

Decía, sin mirar ningún dato:

> "...es la fecha más corta entre el cierre del registro y los días de plazo que corren
> desde que tu ficha se generó, y el sistema la revisa al iniciar el pago. No es la
> fecha en que se cerró el registro: esa ya pasó, y por eso tu ficha existe."

Las tres afirmaciones eran un problema a la vez:

1. **"La fecha viene del concepto de pago"** y **"la revisa al iniciar el pago"**:
   describir la regla del backend desde el front es una afirmación que la pantalla no
   puede verificar, y que cambia si el backend cambia. `paymentDeadline` es lo que
   llegó; eso es lo que se puede decir.
2. **"El registro ya pasó"**: es **falsa** para quien se acaba de registrar. Si el
   registro sigue abierto, esa fecha no es un cierre que ya ocurrió sino una que todavía
   va a ocurrir, y el texto afirmaba un hecho pasado que nadie comprobó. Era el caso
   mayoritario: la mayoría de las fichas se emiten el día 1 y se pagan después.

Ahora el texto se limita a las dos fechas del payload y explica por qué pueden verse
iguales, que es el caso que más confunde cuando las dos muestran el mismo número.

---

## [2026-09-30] El navegador avisa cuando el Aspirante abandona el pago

Commit: `eb0fbaf`.

### Qué cambió

- `useFichaPayment.ts`: `onEvoError` y `onEvoTimeout` ahora hacen
  `POST /candidates/{id}/payments/release` con el `orderId` que ya estaba guardado, en
  lugar de solo limpiar el estado local.
- `types.ts`: `PaymentReleaseBackend` y `PaymentReleaseOutcome`.

### Qué estaba roto

Cuando el SDK del banco emitía `timeout` o `error`, el front limpiaba su estado y le
avisaba al Aspirante, pero **el backend no se enteraba**. El lugar del cupo seguía
apartado, así que la siguiente persona que pulsaba "Pagar" en esa carrera recibía
"El cupo de esta carrera se agotó" por un lugar que el primer Aspirante ya había
soltado — y el primero, además, no podía pagar aunque quedara sitio.

### Por qué los cuatro mensajes son distintos

El endpoint **no le cree al navegador**. Un timeout y un error del navegador son
compatibles con una orden que EVO creó y capturó segundos después, así que el backend
pregunta al banco y decide con su respuesta. De ahí los cuatro mensajes:

| `outcome` | Qué se le dice |
|---|---|
| `SLOT_RELEASED` | No se completó, ya puedes reintentar |
| `PAYMENT_CAPTURED` | El dinero **sí** entró; no intentes otra vez |
| `PAYMENT_IN_PROGRESS` | Sigue en proceso con el banco, espera |
| `RETAINED_UNEXPLAINED` | El mensaje original |

`PAYMENT_CAPTURED` es el que obliga a no usar un mensaje genérico de "no se pudo
completar": sería una mentira que la persona actúa pagando una segunda vez.

El POST es best-effort y la limpieza local ocurre igual. Si falla, el lugar simplemente
queda apartado un poco más — el barrido diario lo recupera igual — mientras que
esperarlo bloquearía el panel.

---

## [2026-09-30] El botón "Pagar" desaparece cuando la ficha ya venció

Commit: `304b782`.

### Qué cambió

- `CandidateStatus` incluye `PAYMENT_EXPIRED`, con su badge en `STATUS_META`
  ("Pago Vencido", ámbar) y sin acciones en `STATUS_ACTIONS`: no hay pago que confirmar
  y la persona puede volver a registrarse, lo cual es otro folio, no una acción de fila.
  Usa ámbar y no el rojo de "Rechazado" a propósito: ese estado es de la evaluación
  académica, no de un pago que no llegó.
- `STATUS_ORDER` en `CandidatosList.tsx` lo coloca justo después de `REGISTERED`, que es
  donde está en el tiempo: es la misma ficha, vencida sin pagar. Antes una ficha
  vencida se veía idéntica a una viva y se filtraba dentro del mismo "Registrado".
- `FichaPaymentAccessBackend` suma `candidateStatus` y `paymentExpired`.
- `PortalFichaPago.tsx`: cuando `paymentExpired` es true se muestra el aviso de
  vencimiento **sin botón de pagar**.

### Por qué se usa `paymentExpired` y no `candidateStatus`

Porque responden a preguntas distintas. El estado es lo que el barrido de las 00:10 dejó
escrito; el flag es lo que el backend calcula hoy. Entre que un plazo vence y el barrido
corre se diferencian, y ofrecer un botón que el checkout va a rechazar con 409 es
exactamente el defecto que el flag evita.

El flag **no** se vuelve a derivar aquí desde `paymentDeadline`. En este endpoint la
pantalla no tiene `registeredAt`, y una segunda copia de la regla de ventana en
TypeScript es justo cómo el portal y el motor empiezan a discrepar.

---

## [2026-09-30] "Pagar" no se puede pulsar dos veces, y el intento anterior no se filtra al reintento

Commit: pendiente.

### Por qué

Fase 0 del plan de cupo, los dos puntos que se notan de inmediato:

- El botón "Pagar en línea" solo se deshabilitaba mientras el backend contestaba el
  `POST /payments/checkout`. En cuanto la sesión abría, volvía a habilitarse, así que
  un segundo clic creaba **otro** `orderId` y el backend apartaba **otro** lugar de la
  carrera para el mismo pago. `PortalFichaPago.tsx` además solo lo deshabilitaba con
  `processing`, y `FichaConfirmacion.tsx` no lo deshabilitaba nunca.
- `checkout.min.js` deja en `sessionStorage` la llave
  `HostedCheckout_embedContainer#sisa-evo-checkout` y nadie la borraba (§2.8), así que
  un reintento podía arrancar con el estado del intento anterior. Además, si el
  Aspirante navegaba fuera con el panel abierto, quedaban el iframe de EVO y esa llave.

### Qué cambió

- `useFichaPayment` expone `pagoEnCurso` (`processing || evoLoading || evoCheckout`):
  la ventana completa en la que no se acepta un segundo intento, no solo la petición.
  La regla queda en el hook y las dos vistas la comparten.
- `FichaConfirmacion.tsx` y `PortalFichaPago.tsx`: el botón usa `disabled={pagoEnCurso}`.
- `teardownEvoDom()` borra también la llave `HostedCheckout_embedContainer#…`, no solo
  el iframe. El `<script>` y `window.Checkout` se siguen dejando, que es lo correcto:
  se cachean por sesión de página.
- `useFichaPayment` barre el DOM de EVO **al desmontar**, igual que en las rutas de
  cierre y cancelación.

### Verificación

`npm run typecheck` limpio.

---

## [2026-09-30] La ficha muestra su plazo real de pago, no la ventana del concepto

Commit: pendiente. Requiere el backend de `feat/cupo-proceso-admision`.

### Por qué

La pantalla de pago pendiente mostraba como "Fecha límite de pago" el
`paymentClosesOn` (el `available_until` del Concepto de Pago), que es una frontera
del motor y no la fecha sobre la que el Aspirante puede actuar. El backend ahora
manda `paymentDeadline`: el más corto entre el cierre de la venta y los N días de
la ficha.

### Qué cambió

- `VentanaFechas` (data/types.ts) gana `paymentDeadline`, y el comentario explica
  las tres fechas. `FichaPaymentBackend`, `FichaPaymentAccessBackend` y
  `CandidateFichaBackend` lo heredan.
- `PortalFichaPago.tsx`, `FichaConfirmacion.tsx` y `CandidatoRegistro.tsx` usan
  `paymentDeadline` para "Fecha límite de pago" en vez de `paymentClosesOn`.
- `FichaPagoPendiente.tsx`: el aviso "¿Por qué esta fecha?" ya no afirma que la
  fecha sea la del Concepto de Pago; dice que es el plazo más corto entre el cierre
  del registro y los días de la ficha.

### Verificación

`npx tsc --noEmit` sin errores.

---

## [2026-09-29] El precio de la ficha se cotiza desde la tarifa

Commits de esta rama: `f86e106` y `9d75b90`. Requiere el backend de
`feat/ficha-precio-desde-tarifas` en `118-SISA-BACK` (`97ce2b4`, `5c80810`, `c38fd6c`).

### Editar ya no vuelve a preguntar el alcance

Abrir un concepto en **Editar** traía el formulario de registro con el alcance de las tarifas
en blanco, y recapturar los montos a mano. Ahora la sección **Tarifas** carga el historial
existente y se edita ahí: cada fila sube con `POST` (el backend cierra la tarifa vigente y
abre la nueva, así que el historial nunca se reescribe), muestra avance de cuántas ya
entraron, y un fallo reintenta solo las que faltan, con los montos con los que se submieron.

El alcance se infiere de las tarifas que ya existen, con `inferScopeFromRates()`. Si todas
las filas apuntan a lo mismo, el `ScopePicker` queda bloqueado en ese valor: no hay nada
que decidir. Con historial mixto, o sin historial, el selector se mantiene editable, porque
no se puede inferir un alcance y presentarlo como si fuera el único.

### El concepto ya no declara a qué carreras aplica

El switch **¿Aplica para alguna carrera en específico?** y su multiselect salen del
formulario, junto con `programIds` del payload y de las dos interfaces de tipos. Lo mismo
que el backend en `c38fd6c`.

El switch era una segunda declaración de alcance, y de la clase que produce los errores
difíciles de encontrar: el concepto decía una cosa, las tarifas otra, y nada obligaba a que
coincidieran. El conflicto no aparecía al guardar, sino al cobrar, cuando el backend ya no
encontraba la tarifa que correspondía. Ahora hay un solo lugar donde vive el alcance y es el
mismo que el backend lee para cotizar.

Los `programIds` que quedan en el archivo no son este: son el destino de cada fila de tarifa
(alcance *Por carreras*), que es un uso distinto y sigue vivo.

### De paso

- El comentario del submit que listaba los switches con valor secundario ya no menciona
  carreras.

`tsc --noEmit` y `npm run build` en verde (1830 módulos).

---

## [2026-09-28] El catálogo ofrece Admisión + el alcance de tarifas se elige una vez

Dos commits: `a99a154` y `0dd9039`.

### El catálogo no tenía un tipo "Admisión" que registrar

El backend ya distingue la cuota de admisión de la cuota cuatrimestral de inscripción, pero
`TYPE_LABELS` no ofrecía ninguna. Quien preparaba el precio de una ficha tenía que crear un
concepto de inscripción y renombrarlo para que el Aspirante viera algo razonable en su recibo.

`ADMISSION: 'Admisión'` entra al union de tipos y al mapa de etiquetas, en el formulario de
registro (`ConceptosForm`) y en el listado (`ConceptosList`). En el listado el badge va en
verde: es el tipo que el flujo de fichas busca para cotizar y cobrar, con `isTuition` encendido.
Distinguirlo de un vistazo es la diferencia entre que la ficha salga con precio o con 409.

> **Requiere el backend de `feat/tipo-concepto-admision` y su migración de datos.** Sin ella el
> listado muestra el tipo nuevo pero la cotización devuelve 409.

De paso, el badge pasa por `typeBadge()` en vez de acceder a `TYPE_BADGE_MAP` directo. El mapa es
exhaustivo para TypeScript pero el valor que llega por runtime no lo es, y con versiones
desalineadas durante un despliegue `TYPE_BADGE_MAP[row.type].className` es `undefined.className`,
que tumba la lista entera. Mostrar la clave cruda degrada; una pantalla en blanco no.

### El editor de tarifas repetía la misma pregunta en cada fila

Cada fila de tarifas tenía su propio select de general / por nivel / por carreras. Con cinco
tarifas eran cinco decisiones, y nada impedía mezclarlas: tres filas "general" con tres montos
distintos, o la misma carrera en dos filas con dos precios. El backend acepta ambas cosas
porque guarda una fila por `conceptId + programId + level`; el conflicto aparece al cobrar, y no
es evidente de dónde.

Ahora el alcance se elige una vez, arriba, con `ScopePicker`, y las filas heredan:

| Alcance | Tarifas | `cost` enviado | Dónde vive el precio |
|---|---|---|---|
| General | Una sola | La tarifa | También en `PaymentConcept.cost` |
| Por nivel | Una por nivel | `null` | `PaymentRate` de la ventana del concepto |
| Por carreras | Una por carrera | `null` | `PaymentRate` de la ventana del concepto |

El paso a dos etapas evita el error de siempre: elegir un alcance y perder lo capturado al
cambiarlo. El monto viaja con la fila; solo se limpian los destinos, que sí dependen del alcance.
Al volver a General queda el primer monto, que es el único que aplica.

Los selectores de nivel y carrera se filtran contra lo que las demás filas ya tomaron, así que
un destino ocupado no se puede volver a elegir. La validación de duplicados se queda como red de
seguridad: si el filtro alguna vez deja pasar algo, el submit avisa en vez de mandar datos que el
backend aceptaría.

### De paso

- **La vigencia sale del editor.** `PaymentRate` hereda la ventana de `PaymentConcept` y el
  backend no la recibía, así que el `DatePicker` era decoración: se capturaba, se perdía y no lo
  decía nadie. La columna Vigencia y el badge Vigente salen de la tabla de historial.
- **Se borra `ConceptosTarifaForm.tsx` y su ruta `/conceptos/tarifa/form`.** Era la pantalla
  vieja de una tarifa, sin autorización por programa y sin reintento parcial.
- **El reintento parcial conserva el lote pendiente:** si un solo POST falla, los que sí entraron
  no se vuelven a mandar.
- **Editar un concepto preserva `data.cost`**, que antes se pisaba con el monto de la primera
  tarifa.
- El comentario de `router.tsx` que describía el alcance por fila quedó alineado.

`tsc --noEmit` y `npm run build` en verde (1829 módulos).

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
