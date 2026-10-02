import { GraduationCap } from 'lucide-react'

/**
 * Screen 17 — Portal Candidato: Pago del Curso de Inducción.
 *
 * The backend contract for induction access and payment does not exist yet.
 * Keep the route for existing links, but never render invented candidate or
 * payment data.
 */
export default function PortalInduccionPago() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-[#009574] px-6 py-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <GraduationCap size={18} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-[14px] leading-tight">UTEZ — SISA v2</p>
          <p className="text-white/70 text-[11px] leading-tight">Curso de Inducción</p>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-6 py-16">
        <section className="rounded-lg border border-[#E5E7EB] bg-white p-8 text-center">
          <h1 className="text-[20px] font-semibold text-[#333333]">Pago no disponible</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-[#6B7280]">
            El acceso y pago del Curso de Inducción estarán disponibles cuando el servicio del servidor esté habilitado.
          </p>
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900">
            Esta pantalla no consulta candidatos, genera referencias ni simula pagos.
          </p>
        </section>
      </main>
    </div>
  )
}
