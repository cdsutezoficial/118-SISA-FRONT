// Etiqueta única de una carrera para dropdowns, tablas y filtros.
//
// Formato: "DSM — Desarrollo de Software Multiplataforma (Presencial)".
// `GET /programs` ya trae `modality` (enum `PRESENCIAL` | `MIXTA`), así que el
// paréntesis se pinta siempre que el catálogo lo incluya; `GET /programs/options`
// no lo trae y ahí queda sólo "código — nombre".

export type ProgramModality = 'PRESENCIAL' | 'MIXTA'

export const MODALITY_LABELS: Record<ProgramModality, string> = {
  PRESENCIAL: 'Presencial',
  MIXTA: 'Mixta',
}

export interface ProgramLabelItem {
  code: string
  name: string
  modality?: string
}

export function programLabel(p: ProgramLabelItem): string {
  const modality = p.modality ? ` (${MODALITY_LABELS[p.modality as ProgramModality] ?? p.modality})` : ''
  return `${p.code} — ${p.name}${modality}`
}

export function programLabelById(
  programs: readonly (ProgramLabelItem & { id: string })[],
  programId: string | null | undefined,
): string {
  const p = programs.find(item => item.id === programId)
  return p ? programLabel(p) : '—'
}
