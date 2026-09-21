import DOMPurify from 'dompurify'

// ─── Allowlist ─────────────────────────────────────────────────────────────────
// Etiquetas/atributos permitidos para el HTML enriquecido de descripciones y
// políticas. Contiene exactamente lo que `RichTextEditor` puede emitir:
//   - Bloques: p, br, blockquote (cita), ul/ol/li (listas), div
//   - Marcas: strong (B), em (I), u, s (tachado), span (color/fondo)
//   - Enlaces: a
// `style` se permite porque color, fondo y alineación se guardan como estilos
// inline; DOMPurify lo sanea contra su allowlist CSS (descarta propiedades
// peligrosas como `position`, `behavior`, etc.).
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'a', 'blockquote', 'span', 'div']
const ALLOWED_ATTR = ['href', 'style']

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/**
 * Sanitiza HTML generado por el usuario antes de guardarlo o de inyectarlo con
 * `dangerouslySetInnerHTML`. Obligatorio en ambos lados: el HTML viene de un
 * editor manejado por el usuario y se muestra a otras personas, así que nunca
 * se confía en él tal cual.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  return html ? DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR }) : ''
}

/**
 * Extrae el texto visible de un HTML enriquecido, para validación ("obligatorio"
 * debe ignorar un editor con solo `<p></p>`) y para previews en listas/tablas
 * que no deben renderizar HTML.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(sanitizeHtml(html), 'text/html')
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
}