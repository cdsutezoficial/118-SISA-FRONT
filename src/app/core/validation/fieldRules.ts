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

/**
 * Género gramatical del campo, para acordar artículo y verbo. El plural importa:
 * "horas semanales" y "unidades de evaluación" necesitan "Las … son
 * requeridas", no "El … es requerido".
 */
export type Gender = 'm' | 'f' | 'mp' | 'fp'

/** Regla atómica: recibe el valor crudo y devuelve el error o `undefined`. */
export type FieldRule = (value: string) => string | undefined

const ARTICLES: Record<Gender, string> = {
  m: 'El',
  f: 'La',
  mp: 'Los',
  fp: 'Las',
}

/** Artículo concordante con el género y el número. */
function article(gender: Gender): string {
  return ARTICLES[gender]
}

/** true si el campo es plural ("mp", "fp"). */
function isPlural(gender: Gender): boolean {
  return gender === 'mp' || gender === 'fp'
}

/** Concuerda un verbo: "debe" / "deben", "puede" / "pueden". */
function verb(gender: Gender, singular: string, pluralForm: string): string {
  return isPlural(gender) ? pluralForm : singular
}

/** Concordancia del auxiliar: "es" / "son". */
function toBe(gender: Gender): string {
  return verb(gender, 'es', 'son')
}

/** Concordancia de la perífrasis: "debe tener" / "deben tener". */
function must(gender: Gender): string {
  return verb(gender, 'debe', 'deben')
}

/** Concordancia de la posibilidad: "no puede" / "no pueden". */
function cannot(gender: Gender): string {
  return verb(gender, 'no puede', 'no pueden')
}

/** Concordancia de un adjetivo terminado en vocal: "requerido" / "requerida",
 * y en plural "requeridos" / "requeridas". Se pasa la raíz sin terminación. */
function agreeing(gender: Gender, stem: string): string {
  const feminine = gender === 'f' || gender === 'fp'
  const suffix = isPlural(gender) ? (feminine ? 'as' : 'os') : feminine ? 'a' : 'o'
  return `${stem}${suffix}`
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
 * @param gender `'f'` para campos como "clave" o "fecha"; `'mp'` para
 *               "créditos" o "horas semanales"; `'m'` por defecto.
 *
 * @example required('nombre de la división')      // "El nombre de la división es requerido."
 * @example required('clave', 'f')                 // "La clave es requerida."
 * @example required('créditos', 'mp')             // "Los créditos son requeridos."
 */
export function required(label: string, gender: Gender = 'm'): FieldRule {
  const message = `${article(gender)} ${label} ${toBe(gender)} ${agreeing(gender, 'requerid')}.`
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
  const message = `${article(gender)} ${label} ${cannot(gender)} superar ${max} caracteres.`
  return value => (value.length > max ? message : undefined)
}

/** El campo debe tener al menos `min` caracteres. */
export function minLength(min: number, label: string, gender: Gender = 'm'): FieldRule {
  const message = `${article(gender)} ${label} ${must(gender)} tener al menos ${min} caracteres.`
  return value => (value.length < min ? message : undefined)
}

/** El campo debe tener entre `min` y `max` caracteres, ambos incluidos. */
export function lengthBetween(min: number, max: number, label: string, gender: Gender = 'm'): FieldRule {
  const message = `${article(gender)} ${label} ${must(gender)} tener entre ${min} y ${max} caracteres.`
  return value => (value.length < min || value.length > max ? message : undefined)
}

// ─── Caracteres ─────────────────────────────────────────────────────────────

/** El campo no contiene caracteres de control (C0, DEL ni C1). */
export function noControlChars(label: string, gender: Gender = 'm'): FieldRule {
  const message = `${article(gender)} ${label} ${verb(gender, 'contiene', 'contienen')} caracteres no válidos.`
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
    ? `${article(gender)} ${label} solo ${verb(gender, 'puede', 'pueden')} contener letras, números y guiones.`
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
    ? `${article(gender)} ${label} solo ${verb(gender, 'puede', 'pueden')} contener letras.`
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
    ? `${article(gender)} ${label} solo ${verb(gender, 'puede', 'pueden')} contener letras, espacios y guiones.`
    : 'Solo puede contener letras, espacios y guiones.'
  return value => (LETTERS_SPACES_AND_HYPHENS_PATTERN.test(value) ? undefined : message)
}

// Nombres de catálogo: letras, dígitos, espacios y guiones. Es el contrato de
// `lettersSpacesAndHyphens` **más los dígitos**, y sin la restricción de que el
// guion tenga que ser ASCII. Ejemplos válidos: "Materia integradora - 1",
// "Inglés III", "Práctica Profesional", "ServicioSocial", "Ingles-III".
// Rechaza paréntesis, comas, signos de puntuación y caracteres de control.
//
// El separador de palabras es un espacio, o guiones con espacios opcionales
// alrededor. Se aceptan las cinco variantes Unicode U+2010–U+2015 además del
// guion ASCII, porque los datos ya guardados en la base usan la raya `–`. Por eso
// "Materia integradora - 1" vale: el guion lleva un espacio a cada lado.
//
// La clase de espacios es `[ \uFEFF\u00A0\u2000-\u200A]`, igual que en
// `LETTERS_SPACES_AND_HYPHENS_PATTERN`, y **acepta rachas a propósito** (`+` y
// no un espacio suelto): esta regla ve el texto ya compacto, porque
// `validateOn: normalizeText` colapsa antes de evaluar. El `@Pattern` del
// backend tiene que aceptar lo mismo por el mismo motivo — se evalúa antes que
// el normalizador, y si rechazara las rachas el 400 se adelantaría a la
// limpieza. La compactación es la que limpia; el patrón sólo define la forma.
//
// La misma expresión está en `CreateSubjectClassificationRequest` y
// `UpdateSubjectClassificationRequest`.
const LETTERS_NUMBERS_SPACES_AND_HYPHENS_PATTERN = /^[ \uFEFF\u00A0\u2000-\u200A]*[\p{L}\p{N}]+(?:(?:[ \uFEFF\u00A0\u2000-\u200A]+|[ \uFEFF\u00A0\u2000-\u200A]*[\u2010-\u2015-][ \uFEFF\u00A0\u2000-\u200A]*)[\p{L}\p{N}]+)*[ \uFEFF\u00A0\u2000-\u200A]*$/u

/**
 * El campo sólo contiene letras, números, espacios y guiones. Para nombres de
 * catálogo: no admite paréntesis, comas ni signos de puntuación.
 *
 * @example lettersNumbersSpacesAndHyphens('nombre')
 *   // "El nombre solo puede contener letras, números, espacios y guiones."
 */
export function lettersNumbersSpacesAndHyphens(label?: string, gender: Gender = 'm'): FieldRule {
  const message = label
    ? `${article(gender)} ${label} solo ${verb(gender, 'puede', 'pueden')} contener letras, números, espacios y guiones.`
    : 'Solo puede contener letras, números, espacios y guiones.'
  return value => (LETTERS_NUMBERS_SPACES_AND_HYPHENS_PATTERN.test(value) ? undefined : message)
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
  const invalid = `${subject} ${must(gender)} ser un número válido.`
  const outOfRange =
    min !== undefined && max !== undefined ? `${subject} ${must(gender)} estar entre ${min} y ${max}.`
    : min !== undefined ? `${subject} ${cannot(gender)} ser ${verb(gender, 'menor', 'menores')} que ${min}.`
    : max !== undefined ? `${subject} ${cannot(gender)} ser ${verb(gender, 'mayor', 'mayores')} que ${max}.`
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

/**
 * Opciones de `decimal`. `fraction` e `intDigits` son el espejo de los dos
 * argumentos de `@Digits` del backend (`fraction` e `integer`), para que la
 * regla del navegador rechace exactamente lo que Hibernate Validator rechaza.
 */
export interface DecimalOptions extends NumericOptions {
  /** Máximos decimales admitidos. Espejo de `@Digits(fraction = …)`. */
  fraction?: number
  /** Máximos dígitos enteros admitidos. Espejo de `@Digits(integer = …)`. */
  intDigits?: number
}

// Forma de un número con signo opcional y parte decimal opcional. Los dos
// límites (decimales y dígitos enteros) se comprueban aparte para que cada
// problema tenga su propio mensaje, en vez de un "no es un número" genérico.
const NUMBER_SHAPE = /^-?\d+(?:[.]\d+)?$/

/**
 * El campo es un decimal dentro del rango indicado, con un número máximo de
 * decimales y de dígitos enteros.
 *
 * Es la regla equivalente a `@Digits` del backend: los dos límites
 * (decimales y dígitos enteros) tienen que ser los mismos, o el navegador
 * dejaría pasar un valor que el servidor rechaza con 400.
 *
 * El orden de los límites importa para el copy: el **rango va antes que los
 * dígitos enteros**. En `minPassingGrade` ambos aplican a la vez (rango
 * [0, 10] y `@Digits(integer = 2, fraction = 1)`), y "debe estar entre 0 y 10"
 * es el mensaje accionable; "admite hasta 2 dígitos enteros" sonaría como un
 * límite arbitrario para un valor que además ya está fuera de rango.
 *
 * @example decimal({ label: 'calificación mínima', gender: 'f', min: 0, max: 10, intDigits: 2 })
 *   // 7.0 ✓   7.55 ✗ (2 decimales)   11 ✗ (fuera de rango)   100 ✗ (fuera de rango, no "3 dígitos")
 */
export function decimal({ label, gender = 'm', min, max, integer = false, fraction = 1, intDigits }: DecimalOptions): FieldRule {
  const subject = `${article(gender)} ${label}`
  const invalid = `${subject} ${must(gender)} ser un número válido.`
  const noDecimals = `${subject} ${cannot(gender)} admitir decimales.`
  const outOfRange =
    min !== undefined && max !== undefined ? `${subject} ${must(gender)} estar entre ${min} y ${max}.`
    : min !== undefined ? `${subject} ${cannot(gender)} ser ${verb(gender, 'menor', 'menores')} que ${min}.`
    : max !== undefined ? `${subject} ${cannot(gender)} ser ${verb(gender, 'mayor', 'mayores')} que ${max}.`
    : invalid
  const maxDecimals = Math.max(0, Math.floor(fraction))
  const maxIntegerDigits = intDigits !== undefined ? Math.max(0, Math.floor(intDigits)) : undefined
  return value => {
    if (!NUMBER_SHAPE.test(value)) return invalid
    if (integer && /[.]\d/.test(value)) return noDecimals
    const dot = value.indexOf('.')
    const decimals = dot === -1 ? 0 : value.length - dot - 1
    if (decimals > maxDecimals) {
      return `${subject} admite hasta ${maxDecimals} decimal${maxDecimals !== 1 ? 'es' : ''} como máximo.`
    }
    const parsed = Number(value)
    if (min !== undefined && parsed < min) return outOfRange
    if (max !== undefined && parsed > max) return outOfRange
    // El signo no cuenta como dígito: `-10` son dos dígitos enteros, no tres.
    const integerDigits = (dot === -1 ? value.length : dot) - (value.startsWith('-') ? 1 : 0)
    if (maxIntegerDigits !== undefined && integerDigits > maxIntegerDigits) {
      return `${subject} admite hasta ${maxIntegerDigits} dígito${maxIntegerDigits !== 1 ? 's' : ''} entero${maxIntegerDigits !== 1 ? 's' : ''} como máximo.`
    }
    return undefined
  }
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

/** Opciones de las reglas de fecha. */
export interface DateOptions {
  label: string
  gender?: Gender
  /** Año mínimo inclusive. Por defecto 2000: descarta basura, no el futuro. */
  minYear?: number
}

/**
 * El campo es una fecha real en `dd/mm/yyyy` (sin overflow: `31/02/2020` no
 * pasa) y su año no es anterior a `minYear`.
 *
 * **No** tope superior: un plan puede quedar vigente a partir del próximo
 * cuatrimestre, así que el `DatePicker` deja navegar y teclear fechas
 * futuras. La máscara y `required` son los que garantizan el formato; aquí se
 * mide que la fecha exista de verdad.
 *
 * @example dateOnOrAfter({ label: 'fecha de vigencia', gender: 'f' })
 *   // "La fecha de vigencia debe ser una fecha válida (dd/mm/yyyy)."
 */
export function dateOnOrAfter({ label, gender = 'm', minYear = 2000 }: DateOptions): FieldRule {
  const invalid = `${article(gender)} ${label} ${must(gender)} ser una fecha válida (dd/mm/yyyy).`
  const tooOld = `${article(gender)} ${label} ${cannot(gender)} ser anterior al 01/01/${minYear}.`
  return value => {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
    if (!match) return invalid
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])
    const date = new Date(year, month - 1, day)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return invalid
    if (year < minYear) return tooOld
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
