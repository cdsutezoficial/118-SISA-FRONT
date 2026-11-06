import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Banknote, Search } from 'lucide-react'
import { PageContainer, Breadcrumb, PageHeader, ErrorBanner, LoadingState, EmptyState } from '@app/core/components/list'
import { Button, TextField } from '@app/core/components/form'
import { apiGet, getApiErrorMessage } from '@app/core/infra/apiClient'
import type { CandidateListPage, CandidateListRow } from '../data/types'

/**
 * Caja (F1): buscar al candidato por folio, nombre o CURP y abrir su cobro en
 * efectivo. La búsqueda usa la lista de candidatos (`CANDIDATES_READ`); el cobro,
 * `PAYMENT_WINDOW_CONFIRM`. Caja no ve el detalle ni edita la ficha.
 */

const ESTADO: Record<string, string> = {
  REGISTERED: 'Registrado',
  PAID: 'Ficha pagada',
  PAYMENT_EXPIRED: 'Vencida',
}

export default function CajaCobros() {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [termino, setTermino] = useState('')
  const [resultados, setResultados] = useState<CandidateListRow[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setTermino(busqueda.trim()), 300)
    return () => clearTimeout(timer)
  }, [busqueda])

  useEffect(() => {
    if (termino.length < 3) {
      setResultados([])
      return
    }
    let cancelado = false
    setCargando(true)
    setError('')
    apiGet<CandidateListPage>('/candidates', { search: termino, page: 0, size: 10 })
      .then(page => { if (!cancelado) setResultados(page.items) })
      .catch(err => { if (!cancelado) setError(getApiErrorMessage(err, 'No se pudo buscar al candidato.')) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [termino])

  return (
    <PageContainer>
      <Breadcrumb items={[{ label: 'Caja' }, { label: 'Cobro en efectivo' }]} />
      <PageHeader title="Cobro en efectivo" subtitle="Busca al candidato por folio, nombre o CURP." />

      <div className="mb-5 max-w-xl">
        <TextField
          label="Buscar candidato"
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Ej. ADM-2026-000123"
        />
      </div>

      {error && <ErrorBanner message={error} />}

      {cargando ? (
        <LoadingState label="Buscando…" />
      ) : termino.length < 3 ? (
        <EmptyState title="Escribe al menos 3 caracteres" hint="Puedes buscar por folio, nombre o CURP." icon={<Search size={28} className="text-[#E5E7EB]" />} />
      ) : resultados.length === 0 ? (
        <EmptyState title="Sin resultados" hint="Revisa el folio o la CURP con el candidato." />
      ) : (
        <div className="space-y-2">
          {resultados.map(c => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#333333]">{c.fullName}</p>
                <p className="text-[12px] text-[#6B7280]">
                  <span className="font-mono">{c.folio}</span> · {c.programName} · {ESTADO[c.status] ?? c.status}
                </p>
              </div>
              <Button size="sm" onClick={() => navigate(`/admision/candidatos/pago-ficha?id=${c.id}`)}>
                <Banknote size={14} /> Cobrar
              </Button>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  )
}
