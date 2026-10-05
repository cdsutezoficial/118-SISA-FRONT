// ─── Reglas de validación de campo ───────────────────────────────────────────
// Librería de reglas atómicas compartida por todos los formularios de
// configuración académica. Cada regla es una función pura que recibe el valor
// del campo y devuelve `string | undefined`.
//
// El patrón de la librería es "onBlur activa + onChange mantiene" (ver
// useFieldValidation). Estas reglas no saben nada de React: solo describen
// qué es un valor inválido.
//
// Los mensajes son en español y se redactan con el artículo del campo ya
// incluido: `required('nombre de la división')` produce "El nombre de la
// división es requerido.". El género se pasa explícitamente porque el copy
// mezclaba "El nombre es requerido" con "La clave es requerida".

/** Género gramatical del campo, para acordar artículo y verbo. */
export type Gender = 'm' | 'f'

/** Regla atómica: recibe el valor crudo y devuelve el error o `undefined`. */
export type FieldRule = (value: string) => string | undefined

/** Artículo concordante con el género. */
function article(gender: Gender): string {
  return gender === 'f' ? 'La' : 'El'
}

/**
 * El `label` que recibe cada regla es el sujeto **sin artículo**: la regla
 * lo antepone. Pasarlo con artículo produciría "El el nombre...".
 * Ej. `maxLength(150, 'nombre')` -> "El nombre no puede superar 150 caracteres."
 */
// C0 (0x00-0x1F) + DEL (0x7F) + C1 (0x80-0x9F). Equivale al
// `@Pattern(regexp = "^[^\p{Cc}]*$")` que usa el backend, para que el frontend
// no acepte lo que el backend va a rechazar.
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/

// Formato de los códigos de catálogo: segmentos alfanuméricos separados por
// guiones, sin guiones al inicio, al final ni doubles. Ejemplos válidos:
// "INT-C-ADM", "REG-UPD-DUP-B", "DTI", "COL".
const CODE_PATTERN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/

// ─── Presencia ──────────────────────────────────────────────────────────────

/**
 * El campo es obligatorio.
 *
 * @param label  sujeto sin artículo, p.ej. `'nombre de la división'`
 * @param gender `'f'` para campos como "clave" o "fecha"; `'m'` por defecto.
 *
 * @example required('nombre de la división')  // "El nombre de la división es requerido."
 * @example required('clave', 'f')             // "La clave es requerida."
 */
export function required(label: string, gender: Gender = 'm'): FieldRule {
  const verb = gender === 'f' ? 'requerida' : 'requerido'
  const message = `${article(gender)} ${label} es ${verb}.`
  return value => (value.trim() ? undefined : message)
}

/** Un select está sin elegir. El `label` aquí sí lleva su artículo. */
export function selectionRequired(label: string): FieldRule {
  const message = `Selecciona ${label}.`
  return value => (value.trim() ? undefined : message)
}

// ─── Longitud ───────────────────────────────────────────────────────────────

/** El campo no puede superar `max` caracteres. */
export function maxLength(max: number, label: string, gender: Gender = 'm'): FieldRule {
  const message = `${article(gender)} ${label} no puede superar ${max} caracteres.`
  return value => (value.length > max ? message : undefined)
}

/** El campo debe tener al menos `min` caracteres. */
export function minLength(min: number, label: string, gender: Gender = 'm'): FieldRule {
  const message = `${article(gender)} ${label} debe tener al menos ${min} caracteres.`
  return value => (value.length < min ? message : undefined)
}

/** El campo debe tener entre `min` y `max` caracteres, ambos incluidos. */
export function lengthBetween(min: number, max: number, label: string, gender: Gender = 'm'): FieldRule {
  const message = `${article(gender)} ${label} debe tener entre ${min} y ${max} caracteres.`
  return value => (value.length < min || value.length > max ? message : undefined)
}

// ─── Caracteres ─────────────────────────────────────────────────────────────

/** El campo no contiene caracteres de control (C0, DEL ni C1). */
export function noControlChars(label: string, gender: Gender = 'm'): FieldRule {
  const message = `${article(gender)} ${label} contiene caracteres no válidos.`
  return value => (CONTROL_CHARACTERS.test(value) ? message : undefined)
}

/**
 * El campo es un código de catálogo: segmentos alfanuméricos unidos por guiones.
 *
 * @param label  sujeto sin artículo. Si se omite, el mensaje no lleva sujeto
 *               ("Solo puede contener letras, números y guiones."), que es lo
 *               adecuado cuando el error ya se pinta debajo de su campo.
 */
export function codePattern(label?: string, gender: Gender = 'm'): FieldRule {
  const message = label
    ? `${article(gender)} ${label} solo puede contener letras, números y guiones.`
    : 'Solo puede contener letras, números y guiones.'
  return value => (CODE_PATTERN.test(value) ? undefined : message)
}

// Un código es una palabra: ni espacios, ni dígitos, ni guiones. Se admiten
// letras Unicode para que "Ñ" y las tildes valgan (regla de negocio de las
// claves de división); el backend usa `^[\p{L}]+$` para lo mismo.
const LETTERS_ONLY_PATTERN = /^\p{L}+$/u

// Texto libre como un nombre: letras y acentos, separados por espacios o por
// guiones. Tolera espacios al inicio y al final porque el valor se normaliza
// antes de evaluarlo. Sin dígitos, paréntesis, comas ni caracteres de control.
//
// El separador de palabras es un espacio simple, o guiones con espacios
// opcionales alrededor. Así "Económica – Administrativa" y "Ac-DE" valen.
//
// La clase de espacios es `[ \uFEFF\u00A0\u2000-\u200A]`: espacio ASCII, el
// BOM de ancho cero, el espacio duro y los espacios Unicode finos. Cubre lo que
// aparece al pegar texto de una web o de un PDF. **Acepta rachas a propósito**
// (`+` y no un espacio suelto): esta regla ve el texto ya compacto, porque
// `validateOn: normalizeText` colapsa antes de evaluar. El `@Pattern` del
// backend tiene que aceptar lo mismo por el mismo motivo — se evalúa antes que
// el normalizador, y si rechazara las rachas el 400 se adelantaría a la
// limpieza. La compactación es la que limpia; el patrón sólo define la forma.
//
// Quedan fuera a propósito el tabulador y `U+3000`: `name` es un campo de una
// línea y ninguno de los dos es tecleable ahí. El backend los seguiría
// compactando si llegado el caso, pero rechazo preferible a un 500.
//
// Se aceptan las cinco variantes Unicode de guion U+2010-U+2015 además del guion
// ASCII, porque los nombres ya guardados en la base las usan
// ("División Académica Económica – Administrativa"). Se permiten también
// espacios a ambos lados del guion (`Ac - DE`), no sólo pegado a las letras.
// La misma expresión está en `CreateAcademicDivisionRequest` y
// `UpdateAcademicDivisionRequest`: si divergieran, el navegador dejaría pasar
// lo que el servidor rechaza.
const LETTERS_SPACES_AND_HYPHENS_PATTERN = /^[ \uFEFF\u00A0\u2000-\u200A]*\p{L}+(?:(?:[ \uFEFF\u00A0\u2000-\u200A]+|[ \uFEFF\u00A0\u2000-\u200A]*[\u2010-\u2015-][ \uFEFF\u00A0\u2000-\u200A]*)\p{L}+)*[ \uFEFF\u00A0\u2000-\u200A]*$/u

/**
 * El campo sólo contiene letras, sin espacios. Para códigos.
 *
 * @example lettersOnly('clave', 'f')  // "La clave solo puede contener letras."
 */
export function lettersOnly(label?: string, gender: Gender = 'm'): FieldRule {
  const message = label
    ? `${article(gender)} ${label} solo puede contener letras.`
    : 'Solo puede contener letras.'
  return value => (LETTERS_ONLY_PATTERN.test(value) ? undefined : message)
}

/**
 * El campo sólo contiene letras, espacios y guiones. Para nombres: no admite
 * dígitos, paréntesis, comas ni caracteres de control.
 *
 * @example lettersSpacesAndHyphens('nombre') // "El nombre solo puede contener letras, espacios y guiones."
 */
export function lettersSpacesAndHyphens(label?: string, gender: Gender = 'm'): FieldRule {
  const message = label
    ? `${article(gender)} ${label} solo puede contener letras, espacios y guiones.`
    : 'Solo puede contener letras, espacios y guiones.'
  return value => (LETTERS_SPACES_AND_HYPHENS_PATTERN.test(value) ? undefined : message)
}

// ─── Números ────────────────────────────────────────────────────────────────

interface NumericOptions {
  /** Etiqueta sin artículo: p.ej. `'el cupo'` se escribe `'cupo'`. */
  label: string
  gender?: Gender
  min?: number
  max?: number
  /** true (default) si sólo se admiten enteros. */
  integer?: boolean
}

/**
 * El campo es un número dentro del rango indicado.
 *
 * @example numeric({ label: 'cupo', min: 1 })
 */
export function numeric({ label, gender = 'm', min, max, integer = true }: NumericOptions): FieldRule {
  const subject = `${article(gender)} ${label}`
  const invalid = `${subject} debe ser un número válido.`
  const outOfRange =
    min !== undefined && max !== undefined ? `${subject} debe estar entre ${min} y ${max}.`
    : min !== undefined ? `${subject} no puede ser menor que ${min}.`
    : max !== undefined ? `${subject} no puede ser mayor que ${max}.`
    : invalid
  return value => {
    if (!NUMBER_PATTERN.test(value)) return invalid
    if (integer && /[.]\d/.test(value)) return invalid
    const parsed = Number(value)
    if (min !== undefined && parsed < min) return outOfRange
    if (max !== undefined && parsed > max) return outOfRange
    return undefined
  }
}

// ─── Genéricas ──────────────────────────────────────────────────────────────

/** Regla con expresión regular y mensaje propios. */
export function pattern(regexp: RegExp, message: string): FieldRule {
  return value => (regexp.test(value) ? undefined : message)
}

/** Regla ad hoc para casos que no cubre ninguna de las anteriores. */
export function custom(check: (value: string) => boolean, message: string): FieldRule {
  return value => (check(value) ? undefined : message)
}

// ─── Normalizadores ─────────────────────────────────────────────────────────
// Se aplican en `handleChange`, antes de evaluar las reglas, y replican lo que
// hace el backend antes de persistir y antes de comparar duplicados.

/** Normalización de códigos: recorta y pasa a mayúsculas. */
export function normalizeCode(value: string): string {
  return value.trim().toUpperCase()
}

/**
 * Normalización de texto: **compacta** las rachas de whitespace y recorta. No
 * translitera ni toca acentos.
 *
 * Colapsa todo el whitespace Unicode, no sólo el espacio ASCII: `\s` en
 * JavaScript cubre también el espacio duro `U+00A0` y los espacios de
 * `U+2000`–`U+200A`, que es lo que llega al pegar desde un navegador o un
 * documento de Word. El backend hace lo mismo con `(?U)\s`.
 *
 * Se usa en dos sitios, y en ninguno se escribe de vuelta en el input:
 * como `validateOn` del schema, para que las reglas midan el texto ya compacto,
 * y al construir el payload de envío. No escribir de vuelta es deliberado:
 * reescribir el valor en cada pulsación mueve el cursor al final del campo.
 *
 * El `U+FEFF` (BOM / zero-width no-break) se **elimina**, no se convierte en
 * espacio: es de anchura cero, así que convertirlo en un espacio partiría la
 * palabra por la mitad. Además hay que hacerlo a mano porque JS y Java no
 * coinciden en él —
 * el `\s` de ECMAScript lo incluye, pero el `(?U)\s` de Java usa la propiedad
 * Unicode *White_Space*, de la que Unicode lo eliminó en 4.0.1. Sin esta línea,
 * `"a\uFEFFb"` se guardaría como `"a b"` en el frontend y como `"a\uFEFFb"` en el
 * backend.
 *
 * @example normalizeText('   a \t\n  b  ')  // 'a b'
 */
export function normalizeText(value: string): string {
  return value.replace(/\uFEFF/g, '').replace(/\s+/gu, ' ').trim()
}

// ─── Combinador ─────────────────────────────────────────────────────────────

/**
 * Aplica las reglas en orden y devuelve el primer error encontrado.
 * Devuelve `undefined` si todas pasan.
 */
export function applyRules(value: string, ...rules: FieldRule[]): string | undefined {
  for (const rule of rules) {
    const error = rule(value)
    if (error) return error
  }
  return undefined
}
