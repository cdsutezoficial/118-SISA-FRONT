# Proposal: Separar el pago de ficha del acceso de inducción

## Intent

`/portal/induccion*` iba a ser el acceso y el pago del **curso de inducción** (Screens 16/17 del spec, hoy 100% mock), pero su código fue sobrescrito por el flujo **real** de "vuelve a pagar mi ficha": acceso por folio + CURP contra `POST /candidates/payment-access`, checkout con EVO, confirmación y PDF. El resultado era que las rutas `/portal/induccion*` servían la ficha, el spec describía inducción, y la allowlist del backend apuntaba a `/portal/induccion/pago` para un flujo que no es inducción.

Este change separa los dos dominios en rutas y archivos propios, y deja explícito que **son flujos distintos**, no dos nombres del mismo flujo.

## Root cause

No fue un error de nombres sino de dominio: el flujo de ficha se implementó *encima* de las rutas de inducción porque ambas son "públicas, sin chrome, candidato anónimo, folio + CURP". La distinguición real es de negocio:

| | Pago de **ficha** | Pago de **inducción** |
|---|---|---|
| Ruta | `/portal/ficha*` | `/portal/induccion*` |
| Qué paga | inscripción al proceso de admisión | curso de inducción |
| Backend | real (EVO + `payment-access`) | mock |
| Gate | folio existe + pago pendiente | `induccionHabilitada === true` (S15) |
| Estado actual | producción | prototipo |

## Scope

### In Scope
- `PortalFicha.tsx` (nuevo) = el flujo real actual, movido tal cual desde `PortalInduccion.tsx`.
- `PortalFichaPago.tsx` (nuevo) = pago real, movido desde `PortalInduccionPago.tsx`.
- `PortalInduccion.tsx` / `PortalInduccionPago.tsx` restaurados a su implementación original de inducción (mock, consistente entre sí).
- LlaveMX como camino visible en `/portal/ficha`, **sin navegación** (placeholder).
- `router.tsx`: 4 rutas públicas separadas.
- `layoutRoles.ts`: `ROLE_DEFAULT_PATHS.CANDIDATO` → `/portal/ficha`.
- Backend: allowlist `sisa.evo.allowed-return-paths` → `/portal/registro/ficha,/portal/ficha/pago`, con su default en `UseCaseConfig` y los tests asociados.

### Out of Scope
- **Backend de inducción.** No se implementa el pago de inducción: `AdmissionPaymentConcept.INDUCTION_COURSE` sigue solo en el enum, `Candidate.isEnabledForInduction` sigue sin caso de uso que la habilite, y `payment_concepts.csv` sigue sin el concepto. Es Fase 2.
- Decidir si inducción se paga con EVO o ventanilla (pregunta de negocio abierta).
- OAuth real de LlaveMX en cualquier flujo.
- Migraciones SQL (el usuario recrea la base).
- Any other module/screen.

## Capabilities

### New Capabilities
- Ninguna.

### Modified Capabilities
- `admision-screens`: se agrega el par de rutas `/portal/ficha*` como flujo complementario real, y se prohíbe explícitamente que un flujo reemplace al otro.

## Key Decisions

1. **Cuatro archivos, no dos renombrados.** El par de inducción se restaura desde `HEAD`; el contenido real se copia a los archivos nuevos. Se evita un `git mv` encadenado que perdería el historial útil de cada pantalla.
2. **El par de ficha NO recibe número de screen.** 16/17 pertenecen a inducción según el spec. El par de ficha se documenta como "flujo complementario" para no crear una colisión de nomenclatura.
3. **LlaveMX sin navegación en ficha.** El spec pide el botón y el badge "Nuevo", pero no hay OAuth: una navegación honesta lo llevaría a un destino inexistente, y el payload que exige `/portal/ficha/pago` no puede generarse sin un proveedor de identidad. Se muestra el botón y un aviso de disponibilidad futura. La asimetría con inducción (donde sí navega) es intencional: allí todo el flujo es simulado.
4. **`CANDIDATO` apunta a `/portal/ficha`.** Es la única pantalla pública de candidato con API real hoy.
5. **El par de inducción conserva su mock.** Restaurarlo no es una regresión: es el estado que el spec describe, y en Fase 1 no existe backend que lo respalde.
6. **Allowlist = 2 entradas.** `/portal/registro/ficha` (post-registro) y `/portal/ficha/pago` (recuperación). Se quita `/portal/induccion/pago` porque ese flujo no vuelve de un gateway.

## Risks

- **Baja probabilidad, alto impacto:** que exista un enlace externo o marcador guardado a `/portal/induccion` esperando el flujo de ficha. Mitigación: ambas rutas siguen existiendo y sirven su propio dominio; los enlaces de inducción ya eran incorrectos bajo el estado anterior.
- **`candidateId` reutilizable.** `POST /candidates/payment-access` devuelve un UUID que sirve contra los endpoints de UUID. Preexistente, fuera de este change; anotado en el docblock de `PortalFicha.tsx`.
- **Divergencia de confianza entre dos pantallas casi idénticas.** Inducción muestra datos de mock y da sensación de real; ficha cobra de verdad. Documentado en los docblocks de ambos archivos.
