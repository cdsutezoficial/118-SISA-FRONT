import { useRef, useState } from 'react'
import { Upload, X, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

/**
 * Generic, reusable file-upload primitive. No real upload/storage backend —
 * selection is simulated/local only (matches the module-wide "simulate
 * everything" rule). Consumed first by Screens 6/10 (payment receipts), but
 * carries no Admisión-specific naming or copy.
 */
export interface UploadedFile {
  name: string
  size: number
  status: 'uploading' | 'done' | 'error'
}

interface FileUploadProps {
  /** e.g. `"application/pdf,image/*"` or `".pdf,.jpg"`. Omit to accept anything. */
  accept?: string
  label: string
  required?: boolean
  value: UploadedFile | null
  onChange: (file: UploadedFile | null) => void
}

const SIMULATED_UPLOAD_MS = 900

function fileMatchesAccept(fileName: string, mimeType: string, accept?: string): boolean {
  if (!accept) return true
  const patterns = accept.split(',').map(p => p.trim().toLowerCase()).filter(Boolean)
  if (patterns.length === 0) return true
  const lowerName = fileName.toLowerCase()
  return patterns.some(pattern => {
    if (pattern.startsWith('.')) return lowerName.endsWith(pattern)
    if (pattern.endsWith('/*')) return mimeType.startsWith(pattern.slice(0, -1))
    return mimeType === pattern
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUpload({ accept, label, required = false, value, onChange }: FileUploadProps) {
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!fileMatchesAccept(file.name, file.type, accept)) {
      setError(`Tipo de archivo no permitido. Formatos aceptados: ${accept}`)
      return
    }

    setError('')
    onChange({ name: file.name, size: file.size, status: 'uploading' })

    // Simulated upload only — no network call, no persistence anywhere.
    setTimeout(() => {
      onChange({ name: file.name, size: file.size, status: 'done' })
    }, SIMULATED_UPLOAD_MS)
  }

  function handleRemove() {
    setError('')
    onChange(null)
  }

  return (
    <div>
      <label className="block text-[12px] font-semibold text-[#333333] mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {!value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-[#E5E7EB] rounded-md text-[#6B7280] hover:border-[#009574] hover:text-[#009574] hover:bg-[#e6f5f1]/40 transition-colors"
        >
          <Upload size={20} />
          <span className="text-[12px] font-medium">Haz clic para seleccionar un archivo</span>
          {accept && <span className="text-[11px] text-[#6B7280]">Formatos: {accept}</span>}
        </button>
      ) : (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 border border-[#E5E7EB] rounded-md bg-[#F8F9FA]">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-[#6B7280] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] text-[#333333] truncate">{value.name}</p>
              <p className="text-[11px] text-[#6B7280]">{formatSize(value.size)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {value.status === 'uploading' && <Loader2 size={15} className="text-[#009574] animate-spin" />}
            {value.status === 'done' && <CheckCircle2 size={15} className="text-emerald-500" />}
            {value.status === 'error' && <AlertCircle size={15} className="text-red-500" />}
            <button
              type="button"
              onClick={handleRemove}
              className="p-1 rounded hover:bg-red-50 hover:text-red-500 text-[#6B7280] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <input ref={inputRef} type="file" accept={accept} onChange={handleSelect} className="hidden" />

      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  )
}
