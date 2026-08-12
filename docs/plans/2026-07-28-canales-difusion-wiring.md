# Plan de implementación — Canales de Difusión (OutreachChannel wiring)

**Fecha**: 2026-07-28
**Repos**: `118-SISA-BACK` (backend ya cerrado — `docs/plans/2026-07-28-outreach-channel.md`) · `118-SISA-FRONT` (este plan)

## Contexto

`CanalesDifusion.tsx` (Pantalla 2 de Admisión) ya existe como mock con modal inline de registro/edición. Se cablea contra `GET/POST/PUT/PATCH /outreach-channels` (backend cerrado).

## Ajustes respecto al mock actual

1. **Columna "Candidatos Registrados" se elimina** — no tiene respaldo real (`OutreachChannelResponse` no expone ese dato; necesitaría `Candidate`, que no existe). No se inventa un número.
2. **"Cambiar estado" pasa de `ConfirmModal` a `Switch` bidireccional inline** — mismo criterio ya aplicado a Grupos/Generaciones/Conceptos de Pago: el backend modela el estado como toggle idempotente simple, sin necesidad de confirmación.
3. Se mantiene el **modal inline** para Registrar/Editar (no una pantalla separada) — es consistente con la simplicidad del catálogo (2 campos) y ya está en el mock; no hace falta rediseñar a página completa para esto.

## Contrato de API

| Verbo | Endpoint | Body/Query |
|---|---|---|
| GET | `/outreach-channels` | `status`, `search`, `page`, `size` |
| POST | `/outreach-channels` | `{ name }` |
| GET | `/outreach-channels/{id}` | — |
| PUT | `/outreach-channels/{id}` | `{ name }` |
| PATCH | `/outreach-channels/{id}/status` | `{ status: 'ACTIVE'\|'INACTIVE' }` |

## Registro de ejecución

**Fecha**: 2026-07-28 — implementado, `npx tsc --noEmit` limpio.

- `CanalesDifusion.tsx` reescrito: cableado a `GET/POST/PUT/PATCH /outreach-channels` (paginado, búsqueda debounced). Se mantuvo el modal inline de Registrar/Editar (un solo campo, no justifica pantalla completa). Columna "Candidatos Registrados" eliminada (sin respaldo en el backend). "Cambiar estado" pasó de `ConfirmModal` a `Switch` bidireccional inline, mismo criterio que Generaciones/Grupos/Conceptos de Pago. Responsivo: tabla desktop + tarjetas móvil, mismo patrón ya establecido.
