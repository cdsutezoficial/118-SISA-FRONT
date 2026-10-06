import { GraduationCap } from 'lucide-react'

/**
 * Screen 16 — Portal Candidato: Acceso al pago del Curso de Inducción.
 *
 * Public, chrome-less (`AuthLayout`, no Sidebar/Navbar). The backend domain
 * for course access and payment is not available yet, so this route must not
 * invent a candidate, identity, period, amount, or payment result.
 */

export default function PortalInduccion() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-[#009574] px-6 py-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <GraduationCap size={18} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-[14px] leading-tight">UTEZ — SISA v2</p>
          <p className="text-white/70 text-[11px] leading-tight">Curso de Inducción</p>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left panel — 40%, soft primary background */}
        <div className="lg:w-[40%] bg-[#e6f5f1] flex flex-col items-center justify-center px-10 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#009574]/15 flex items-center justify-center mb-5">
            <GraduationCap size={28} className="text-[#009574]" />
          </div>
          <h1 className="text-[22px] font-bold text-[#333333] leading-snug max-w-xs">
            Acceso al pago del Curso de Inducción
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-3 max-w-xs">
            Si fuiste habilitado por Servicios Escolares, aquí puedes consultar y pagar tu curso de inducción.
          </p>
        </div>

        {/* Right panel — 60% */}
        <div className="lg:w-[60%] flex flex-col items-center justify-center px-6 py-14">
          <div className="w-full max-w-sm">
            <h2 className="text-[18px] font-bold text-[#333333] mb-3">Acceso no disponible</h2>
            <p className="text-[13px] text-[#6B7280] leading-relaxed">
              El acceso y pago del Curso de Inducción estarán disponibles cuando el servicio del servidor esté habilitado.
            </p>
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900">
              No se puede validar la identidad, consultar una ficha ni generar un pago desde esta pantalla.
            </div>

            <p className="text-center text-[12px] text-[#9CA3AF] mt-6 leading-relaxed">
              ¿Problemas para acceder? Acude a la ventanilla de Servicios Escolares.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
