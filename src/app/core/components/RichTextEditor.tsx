import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, Color, BackgroundColor } from '@tiptap/extension-text-style'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link2,
  Link2Off,
  Undo2,
  Redo2,
  Baseline,
  Highlighter,
} from 'lucide-react'
import { useOpenDirection } from '@app/core/infra/hooks'
import { FieldError } from './ui'
import { sanitizeHtml } from './richText'

// ─── Design tokens ─────────────────────────────────────────────────────────────
// Primary: #009574, hover: #007a5e
// Text: #333333, secondary: #6B7280
// Border: #E5E7EB, bg-secondary: #F8F9FA, active tint: #e6f5f1

// ─── Paletas ─────────────────────────────────────────────────────────────────
const TEXT_COLORS = [
  '#111827', '#6B7280', '#009574', '#4F46E5',
  '#B91C1C', '#B45309', '#0F766E', '#7C3AED', '#DB2777',
]
const BG_COLORS = [
  '#FEF3C7', '#DBEAFE', '#D1FAE5', '#FCE7F3',
  '#EDE9FE', '#FEE2E2', '#F3F4F6', '#FFF7ED',
]

const TOOLBAR_BTN =
  'inline-flex items-center justify-center h-8 min-w-8 px-1.5 rounded-md cursor-pointer border-none transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed'
const TOOLBAR_BTN_IDLE = 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#333333]'
const TOOLBAR_BTN_ACTIVE = 'bg-[#e6f5f1] text-[#009574]'

function Separator() {
  return <div className="w-px h-5 bg-[#E5E7EB] mx-1 flex-shrink-0" />
}

function ToolbarButton({ icon, label, active = false, disabled = false, onClick }: {
  icon: ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`${TOOLBAR_BTN} ${active ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN_IDLE}`}
    >
      {icon}
    </button>
  )
}

// ─── ColorPopover ─────────────────────────────────────────────────────────────
// Popover de paleta (color de texto / fondo) con cierre al click afuera y
// apertura hacia arriba cuando no hay espacio abajo (mismo `useOpenDirection`
// que los demás dropdowns de la app).
function ColorPopover({ trigger, title, children }: {
  trigger: ReactNode
  title: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { openUp, measureAndSet } = useOpenDirection(ref)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={open}
        onClick={() => { if (!open) measureAndSet(); setOpen(o => !o) }}
        className={`${TOOLBAR_BTN} ${open ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN_IDLE}`}
      >
        {trigger}
      </button>
      {open && (
        <div className={`absolute ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 w-48 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 p-2`}>
          <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5">{title}</p>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Props ─────────────────────────────────────────────────────────────────────
interface RichTextEditorProps {
  value?: string
  onChange?: (html: string) => void
  label?: string
  id?: string
  error?: string
  /** true → renderiza el contenido sanitizado en solo lectura (sin toolbar). */
  readonly?: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function RichTextEditor({
  value = '',
  onChange,
  label,
  id,
  error = '',
  readonly = false,
}: RichTextEditorProps) {
  const autoId = useId()
  const fieldId = id || autoId

  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      horizontalRule: false,
      link: false,
      underline: false,
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
    }),
    TextStyle,
    Color.configure({ types: ['textStyle'] }),
    BackgroundColor.configure({ types: ['textStyle'] }),
    TextAlign.configure({ types: ['paragraph'] }),
  ], [])

  const editor = useEditor({
    content: value,
    extensions,
    editorProps: {
      attributes: {
        id: fieldId,
        class: 'rich-text-content w-full min-h-[140px] px-4 py-3 outline-none resize-y',
      },
    },
    editable: !readonly,
    onUpdate: ({ editor: current }) => onChange?.(current.getHTML()),
  })

  // Sincroniza el estado de edición con `readonly` — `useEditor` solo toma
  // `editable` en la creación, así que cambiar view→edit (ModeSwitcher) dejaba
  // el contentEditable en false y no permitía escribir. Se re-aplica aquí.
  useEffect(() => {
    editor?.setEditable(!readonly)
  }, [editor, readonly])

  // Resincroniza el editor cuando el form lo resetea externamente (crear/editar),
  // pero solo si el HTML difiere para no pisar la posición del cursor mientras
  // el usuario escribe (onUpdate ya dejó value === editor.getHTML()).
  useEffect(() => {
    if (!editor) return
    if ((value || '') !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  useEffect(() => {
    return () => editor?.destroy()
  }, [editor])

  function isActive(name: string, attributes?: Record<string, unknown>): boolean {
    if (!editor) return false
    return attributes ? editor.isActive(name, attributes) : editor.isActive(name)
  }

  function toggleLink() {
    if (!editor) return
    if (isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const url = window.prompt('URL del enlace:')
    if (!url) return
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const marks: { key: string; icon: ReactNode; label: string; active: boolean; action: () => void }[] = [
    { key: 'bold', icon: <Bold className="w-4 h-4" />, label: 'Negrita', active: isActive('bold'), action: () => editor?.chain().focus().toggleBold().run() },
    { key: 'italic', icon: <Italic className="w-4 h-4" />, label: 'Cursiva', active: isActive('italic'), action: () => editor?.chain().focus().toggleItalic().run() },
    { key: 'underline', icon: <UnderlineIcon className="w-4 h-4" />, label: 'Subrayado', active: isActive('underline'), action: () => editor?.chain().focus().toggleUnderline().run() },
    { key: 'strike', icon: <Strikethrough className="w-4 h-4" />, label: 'Tachado', active: isActive('strike'), action: () => editor?.chain().focus().toggleStrike().run() },
  ]

  return (
    <div>
      {label && (
        <label className="block text-[12px] font-semibold text-[#333333] mb-1" htmlFor={fieldId}>
          {label}
        </label>
      )}

      {readonly ? (
        // Modo lectura: contenido ya sanitizado, sin toolbar.
        <div className={`rich-text-content rounded-lg bg-[#F8F9FA] border px-4 py-3 min-h-[120px] ${error ? 'border-red-400' : 'border-[#E5E7EB]'}`}>
          {sanitizeHtml(value) ? (
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }} />
          ) : (
            <span className="text-[#9CA3AF]">Sin contenido</span>
          )}
        </div>
      ) : (
        <div
          className={
            'rounded-lg bg-[#F8F9FA] border transition duration-150 focus-within:bg-white focus-within:border-[#009574] focus-within:shadow-[0_0_0_2px_rgba(0,149,116,0.15)] ' +
            (error ? 'border-red-400' : 'border-[#E5E7EB]')
          }
        >
          <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b border-[#E5E7EB]">
            {/* Normal (párrafo) */}
            <ToolbarButton
              icon={<span className="text-[12px] font-semibold px-0.5">Normal</span>}
              label="Texto normal"
              active={isActive('paragraph') && !isActive('blockquote') && !isActive('bulletList') && !isActive('orderedList')}
              onClick={() => editor?.chain().focus().setParagraph().run()}
            />

            <Separator />

            {marks.map(m => (
              <ToolbarButton key={m.key} icon={m.icon} label={m.label} active={m.active} onClick={m.action} />
            ))}

            <Separator />

            <ToolbarButton
              icon={<List className="w-4 h-4" />}
              label="Lista con viñetas"
              active={isActive('bulletList')}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
              icon={<ListOrdered className="w-4 h-4" />}
              label="Lista numerada"
              active={isActive('orderedList')}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            />

            <Separator />

            <ToolbarButton
              icon={<Quote className="w-4 h-4" />}
              label="Cita"
              active={isActive('blockquote')}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            />

            <Separator />

            <ToolbarButton icon={<AlignLeft className="w-4 h-4" />} label="Alinear a la izquierda" active={isActive('paragraph', { textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()} />
            <ToolbarButton icon={<AlignCenter className="w-4 h-4" />} label="Centrar" active={isActive('paragraph', { textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()} />
            <ToolbarButton icon={<AlignRight className="w-4 h-4" />} label="Alinear a la derecha" active={isActive('paragraph', { textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()} />
            <ToolbarButton icon={<AlignJustify className="w-4 h-4" />} label="Justificar" active={isActive('paragraph', { textAlign: 'justify' })} onClick={() => editor?.chain().focus().setTextAlign('justify').run()} />

            <Separator />

            <ColorPopover trigger={<Baseline className="w-4 h-4" />} title="Color de texto">
              <div className="grid grid-cols-5 gap-1">
                {TEXT_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => editor?.chain().focus().setColor(c).run()}
                    className={`w-7 h-7 rounded-md border ${isActive('textStyle', { color: c }) ? 'ring-2 ring-[#009574] ring-offset-1' : 'border-[#E5E7EB]'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#E5E7EB]">
                <input
                  type="color"
                  title="Color personalizado"
                  onChange={e => editor?.chain().focus().setColor(e.target.value).run()}
                  className="w-8 h-6 border border-[#E5E7EB] rounded cursor-pointer bg-transparent p-0"
                />
                <button type="button" onClick={() => editor?.chain().focus().unsetColor().run()} className="text-[11px] font-medium text-[#6B7280] hover:text-[#333333]">
                  Sin color
                </button>
              </div>
            </ColorPopover>

            <ColorPopover trigger={<Highlighter className="w-4 h-4" />} title="Fondo del texto">
              <div className="grid grid-cols-4 gap-1">
                {BG_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => editor?.chain().focus().setBackgroundColor(c).run()}
                    className={`h-7 rounded-md border ${isActive('textStyle', { backgroundColor: c }) ? 'ring-2 ring-[#009574] ring-offset-1' : 'border-[#E5E7EB]'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#E5E7EB]">
                <input
                  type="color"
                  title="Fondo personalizado"
                  onChange={e => editor?.chain().focus().setBackgroundColor(e.target.value).run()}
                  className="w-8 h-6 border border-[#E5E7EB] rounded cursor-pointer bg-transparent p-0"
                />
                <button type="button" onClick={() => editor?.chain().focus().unsetBackgroundColor().run()} className="text-[11px] font-medium text-[#6B7280] hover:text-[#333333]">
                  Sin fondo
                </button>
              </div>
            </ColorPopover>

            <Separator />

            <ToolbarButton
              icon={isActive('link') ? <Link2Off className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              label={isActive('link') ? 'Quitar enlace' : 'Insertar enlace'}
              active={isActive('link')}
              onClick={toggleLink}
            />

            <div className="flex-1" />

            <ToolbarButton icon={<Undo2 className="w-4 h-4" />} label="Deshacer" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()} />
            <ToolbarButton icon={<Redo2 className="w-4 h-4" />} label="Rehacer" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()} />
          </div>
          <EditorContent editor={editor} />
        </div>
      )}

      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}