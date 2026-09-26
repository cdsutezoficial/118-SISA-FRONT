# SDD Archive Report — Separar el pago de ficha del acceso de inducción

**Change**: separar-pago-ficha-de-induccion
**Status**: Complete and Archived
**Date**: 2026-09-26
**Artifact Store**: openspec (file-based)
**Project**: 118-SISA-FRONT (+ allowlist en 118-SISA-BACK)

---

## Executive Summary

`/portal/induccion*` estaba sirviendo el flujo **real** de pago de ficha (acceso por folio + CURP contra `POST /candidates/payment-access`, checkout EVO, confirmación y PDF), mientras el spec describía ahí el acceso y pago del **curso de inducción** (Screens 16/17, mock). Este change separó los dos dominios: el contenido real se movió a `PortalFicha.tsx` / `PortalFichaPago.tsx` con rutas `/portal/ficha*`, y el par de inducción se restauró a su implementación original. Verificación: FRONT typecheck y build limpios, BACK 954/954 tests verdes, y cero residuos de la ruta vieja fuera del par de inducción.

---

## What Was Built

### Los dos pares, ya separados

| | Pago de **ficha** | Pago de **inducción** |
|---|---|---|
| Archivos | `PortalFicha.tsx`, `PortalFichaPago.tsx` | `PortalInduccion.tsx`, `PortalInduccionPago.tsx` |
| Rutas | `/portal/ficha`, `/portal/ficha/pago` | `/portal/induccion`, `/portal/induccion/pago` |
| Backend | real (EVO + `payment-access`) | mock |
| Estado | producción | prototipo (Fase 2) |

### LlaveMX como placeholder en ficha

`PortalFicha.tsx` ahora muestra los dos caminos de acceso que pide el spec, separados por un divisor:

1. **LlaveMX** con el botón oficial y el badge "Nuevo" — **no navega**. Sin OAuth no hay a dónde ir honestamente, y el payload que exige `/portal/ficha/pago` no puede generarse sin un proveedor de identidad. Muestra un aviso inline de disponibilidad futura.
2. **Folio + últimos 3 caracteres de CURP** — contra el backend real, sin `induccionHabilitada` (ese gate es del curso, no de la ficha).

La asimetría con inducción (donde el botón sí navega) es intencional y está documentada en ambos docblocks: allí todo el flujo es simulado y puede permitirse fingir una navegación.

### Backend: allowlist de retorno EVO

`sisa.evo.allowed-return-paths` = `/portal/registro/ficha,/portal/ficha/pago` (antes terminaba en `/portal/induccion/pago`). Se actualizó también el default del `@Value` en `UseCaseConfig`, los javadocs de `InitiateFichaPaymentUseCase` y `CheckoutInitiationRequest`, y los tests de `InitiateFichaPaymentUseCaseImplTest` (10 ocurrencias) y `CandidateControllerTest` (3).

### Navegación

- `router.tsx`: 4 rutas públicas bajo `AuthLayout`, con comentarios que declaran que son dos pares sin relación.
- `layoutRoles.ts`: `ROLE_DEFAULT_PATHS.CANDIDATO` → `/portal/ficha`.
- Docblocks actualizados en `RoleContext.tsx` y `useFichaPayment.ts`, que aún apuntaban a la ruta vieja como ejemplo.

---

## Verificación

```
npm run typecheck   → limpio, sin errores
npm run build       → ✓ built in 5.13s, 1825 módulos
                       (warning preexistente: chunk >500 kB, no bloqueante)
.\mvnw.cmd -o test  → Tests run: 954, Failures: 0, Errors: 0 — BUILD SUCCESS
```

Grep de residuos en BACK: **cero** referencias a `/portal/induccion`.
Grep de residuos en FRONT: solo queda en el par de inducción (restaurado) y en comentarios que lo nombran explícitamente como flush hermano.

El restore fue **byte-exact**: `PortalInduccion.tsx` y `PortalInduccionPago.tsx` no aparecen en `git status`, es decir, son idénticos a `HEAD`.

---

## Findings

### Critical
None.

### Warnings

1. **`openspec validate --strict` no se pudo correr.** El CLI no está instalado en el repo ni hay referencia a él en `package.json`. La validación formal del delta queda pendiente hasta que haya CLI. El contenido se revisó a mano contra el formato de `real-login-integration`.

2. **Archive ejecutado manualmente.** Sin CLI no hay `openspec archive`, así que el delta se copió a `openspec/archive/2026-09-26-.../` y se sincronizó a `openspec/specs/admision-screens.md` a mano. Revisar el contenido si más adelante se instala el CLI.

3. **Riesgo residual de `candidateId`.** Preexistente, fuera de alcance: `POST /candidates/payment-access` devuelve un UUID que sirve contra los endpoints de UUID. Anotado en el docblock de `PortalFicha.tsx`.

### Suggestions

1. **Fase 2 (backend de inducción)** sigue sin arrancar: falta el caso de uso, `AdmissionPaymentRepository.findByCandidateId` es singular y no soportaría dos conceptos, falta el seed en `payment_concepts.csv`, y falta el caso de uso que habilite `Candidate.isEnabledForInduction`.

2. **Pregunta de negocio abierta:** si el curso de inducción se paga con EVO o ventanilla. Hoy el spec (Screen 17) describe ambas pestañas; la decisión determina si `/portal/induccion/pago` entra a la allowlist del gateway.

---

## Spec Sync

`openspec/specs/admision-screens.md` actualizado:
- Propósito amended para mencionar el tercer par.
- Nueva tabla "Complementary Flow (sin número de screen)" con las dos rutas de ficha y su nota de dominio independiente.
- 3 requirements agregados (Acceso Pago de Ficha, Pago de Ficha, y la separación de flujos) con 12 scenarios.

Los Screens 16/17 **no se tocaron**: ya describían inducción correctamente, que es justamente por qué el código era el que estaba mal.

---

## Rollback

Puramente aditivo en frontend (2 archivos nuevos + 3 modificados de navegación); en backend, solo el valor de la allowlist y ejemplos en javadocs/tests.

1. Borrar `src/app/portal/PortalFicha.tsx` y `PortalFichaPago.tsx`.
2. Revertir las 2 rutas de `router.tsx` y `ROLE_DEFAULT_PATHS.CANDIDATO` a `/portal/induccion`.
3. Revertir la allowlist a `/portal/registro/ficha,/portal/induccion/pago`.

---

## Archive Contents

- `proposal.md` — intent, root cause, scope, decisiones, riesgos
- `tasks.md` — 6 secciones + backlog de Fase 2
- `specs/admision-screens/spec.md` — delta (3 ADDED requirements)
- `archive-report.md` — este documento

---

**Status**: ARCHIVED ✓
