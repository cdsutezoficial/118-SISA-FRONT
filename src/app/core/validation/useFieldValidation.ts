import { useCallback, useRef, useState } from 'react'
import { applyRules, type FieldRule } from './fieldRules'

// ─── Tipos ──────────────────────────────────────────────────────────────────

/** Declaración de un campo en el schema del hook. */
export interface FieldSpec {
  /**
   * Reglas atómicas, evaluadas en orden. Acepta tuplas readonly para que los
   * schemas declarados con `as const` fuera del componente encajen sin casts.
   */
  rules?: readonly FieldRule[]
  /**
   * Normalizador aplicado en `handleChange`, antes de evaluar las reglas, y
   * cuyo resultado **se escribe de vuelta en el input**.
   *
   * Sólo para valores donde recortar en cada pulsación no estorbe: los códigos,
   * que además se pasan a mayúsculas. No usarlo en textos libres, porque
   * `normalizeText` en cada tecla impide escribir un espacio ("División " se
   * convierte en "División" y nunca se puede teclear la siguiente palabra).
   * Para textos libres usa `validateOn`.
   */
  normalize?: (value: string) => string
  /**
   * Transformación aplicada **sólo al evaluar las reglas**, sin escribirse de
   * vuelta en el input. Por defecto se recorta el valor.
   *
   * Es lo que permite validar contra el texto normalizado sin esa
   * normalización estorbe al teclear: `validateOn: normalizeText` hace que
   * `required` y `maxLength` vean el texto ya recortado, mientras el input
   * conserva los espacios que el usuario está escribiendo.
   */
  validateOn?: (value: string) => string
}

/** Schema: un `FieldSpec` por nombre de campo. */
export type FieldSchema<F extends string> = Partial<Record<F, FieldSpec>>

/** Errores de campo: como mucho un mensaje por campo. */
export type FieldErrors<F extends string> = Partial<Record<F, string>>

/** Reglas entre campos: reciben todos los valores y devuelven errores por campo. */
export type CrossRules<F extends string, V> = (values: V) => FieldErrors<F>

export interface UseFieldValidationOptions<F extends string, V> {
  /** Validaciones que necesitan ver más de un campo a la vez. */
  crossRules?: CrossRules<F, V>
}

export interface UseFieldValidation<F extends string, V extends Record<F, string>> {
  /** Valor actual de cada campo, ya normalizado. */
  values: V
  /** Errores calculados, incluidos los de `crossRules`. */
  errors: FieldErrors<F>
  /**
   * Campos con los que el usuario ya interactuó, de alguna forma: Teclear
   * cuenta igual que salir del campo, así que desde la primera pulsación el
   * error se muestra y se mantiene al día. Sólo `validate()` los marca todos.
   */
  touched: Record<F, boolean>
  /** `touched[field] ? errors[field] : undefined` — para el `error` del campo. */
  fieldError: (field: F) => string | undefined
  /** Normaliza el valor, marca el campo como tocado y re-evalúa sus reglas. */
  handleChange: (field: F) => (value: string) => void
  /** Marca el campo como tocado y evalúa sus reglas. */
  handleBlur: (field: F) => () => void
  /** Asigna un valor sin pasar por `handleChange` (carga inicial, resets). */
  setFieldValue: (field: F, value: string) => void
  /**
   * Inyecta un error vindo del backend (típicamente un 409). Marca el campo
   * como tocado para que el error se vea aunque el usuario no lo haya tocado.
   */
  setFieldError: (field: F, message: string | undefined) => void
  /** Descarta los errores 409 antes de un nuevo intento. */
  clearFieldError: (field: F) => void
  /** Limpia todos los errores, respetando `touched`. */
  clearErrors: () => void
  /** Restablece valores, errores y `touched`. */
  reset: (values?: Partial<V>) => void
  /** Marca todos los campos como tocados y valida todo. `false` si hay errores. */
  validate: () => boolean
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Estado de validación de un formulario, con el patrón "interactuar activa,
 * seguir escribiendo mantiene":
 *
 * - Un campo con el que el usuario nunca ha interactuado no muestra error,
 *   aunque esté vacío. Eso evita el rojo encima de un formulario recién abierto.
 * - En la **primera pulsación** el campo ya se evalúa y muestra su error: no
 *   hace falta salir del campo para enterarse. Un `onBlur` sigue declarándose
 *   porque es la red de seguridad de los campos que se rellenan sin teclear
 *   (autofill, pegado, selección de un valor).
 * - Mientras se sigue escribiendo, el error se actualiza en cada tecla.
 * - `validate()` marca todos los campos como tocados y los evalúa todos.
 *
 * Antes esto era "onBlur activa + onChange mantiene", y el error de un campo
 * recién enfocado no aparecía hasta salir de él. Se cambió porque es lo que se
 * espera de un formulario: si tecleas un carácter prohibido, lo sabes al
 * teclearlo.
 *
 * @param schema        reglas y normalizadores por campo
 * @param initialValues valores iniciales
 * @param options       `crossRules` para validaciones entre campos
 */
export function useFieldValidation<F extends string, V extends Record<F, string>>(
  schema: FieldSchema<F>,
  initialValues: V,
  options: UseFieldValidationOptions<F, V> = {},
): UseFieldValidation<F, V> {
  const { crossRules } = options
  const fields = Object.keys(schema) as F[]

  const [values, setValues] = useState<V>(initialValues)
  const [touched, setTouched] = useState<Record<F, boolean>>({} as Record<F, boolean>)
  // Los errores inyectados por el backend (409) se guardan aparte: no se
  // recalculan desde el schema porque su verdad es el servidor, y deben
  // sobrevivir a un `handleChange` de otro campo.
  const [backendErrors, setBackendErrors] = useState<FieldErrors<F>>({})
  // Espejo síncrono de los errores calculados, para que `validate()` pueda
  // responder sin esperar al siguiente render.
  const computed = useRef<FieldErrors<F>>({})

  const fieldNames = fields.join('|')

  /** Normaliza y evalúa las reglas de un campo contra los valores dados. */
  const runFieldRules = useCallback(
    (field: F, source: V): string | undefined => {
      const spec = schema[field]
      if (!spec?.rules?.length) return undefined
      const raw = source[field]
      // Las reglas ven el valor normalizado: por defecto recortado, para que
      // `required` y `maxLength` no cuenten espacios que el usuario aún está
      // escribiendo. Nunca se escribe de vuelta al input.
      const value = spec.validateOn ? spec.validateOn(raw) : raw.trim()
      return applyRules(value, ...spec.rules)
    },
    // `schema` se declara como constante fuera del componente; si algún día
    // fuera dinámico habría que incluirlo en las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fieldNames],
  )

  /** Evalúa el schema completo más las reglas entre campos. */
  const runAllRules = useCallback(
    (source: V): FieldErrors<F> => {
      const next: FieldErrors<F> = {}
      for (const field of fields) {
        const error = runFieldRules(field, source)
        if (error) next[field] = error
      }
      if (crossRules) Object.assign(next, crossRules(source))
      return next
    },
    [crossRules, runFieldRules, fieldNames],
  )

  /**
   * Re-evalúa los errores de los campos ya tocados contra `source`.
   *
   * Las reglas entre campos también se recalculan aquí, no sólo en
   * `validate()`: si no, un error del tipo "la fecha final debe ser posterior a
   * la inicial" se quedaría congelado con el valor viejo hasta el submit. Se
   * filtran por `touchedSnapshot` por la misma razón que las demás: no se
   * muestra el error de un campo con el que el usuario no ha interactuado.
   */
  const refreshTouched = useCallback(
    (source: V, touchedSnapshot: Record<F, boolean>): FieldErrors<F> => {
      const next: FieldErrors<F> = {}
      for (const field of fields) {
        if (!touchedSnapshot[field]) continue
        const error = runFieldRules(field, source)
        if (error) next[field] = error
      }
      if (crossRules) {
        const cross = crossRules(source)
        for (const field of fields) {
          if (touchedSnapshot[field] && cross[field]) next[field] = cross[field]
        }
      }
      return next
    },
    [crossRules, runFieldRules, fieldNames],
  )

  const handleChange = useCallback(
    (field: F) => (raw: string) => {
      const spec = schema[field]
      const value = spec?.normalize ? spec.normalize(raw) : raw
      const source = { ...values, [field]: value } as V
      // Teclear cuenta como tocar el campo. `touched` no significa "el usuario
      // salió de él" sino "el usuario interactuó con él", y por eso el error
      // aparece desde la primera tecla en lugar de esperar al blur. Un select
      // que no emita blur también queda cubierto por esta misma vía.
      const nextTouched = { ...touched, [field]: true }
      computed.current = refreshTouched(source, nextTouched)
      setValues(source)
      // `nextTouched` es un objeto nuevo en cada tecla, así que llamar a
      // `setTouched` sin guard provocaría un re-render por pulsación en todo el
      // formulario. Con el guard sólo se marca una vez por campo.
      if (!touched[field]) setTouched(nextTouched)
      // El 409 de este campo deja de ser válido en cuanto el usuario edita el
      // valor; los 409 de los demás campos se conservan.
      setBackendErrors(previous => {
        if (!(field in previous)) return previous
        const next = { ...previous }
        delete next[field]
        return next
      })
    },
    [schema, values, touched, refreshTouched],
  )

  const handleBlur = useCallback(
    (field: F) => () => {
      const next = { ...touched, [field]: true }
      computed.current = refreshTouched(values, next)
      setTouched(next)
    },
    [touched, values, refreshTouched],
  )

  const setFieldValue = useCallback((field: F, value: string) => {
    const normalized = schema[field]?.normalize ? schema[field].normalize(value) : value
    setValues(previous => ({ ...previous, [field]: normalized } as V))
  }, [schema])

  const setFieldError = useCallback((field: F, message: string | undefined) => {
    setBackendErrors(previous => {
      const next = { ...previous }
      if (message) next[field] = message
      else delete next[field]
      return next
    })
    // Se marca como tocado para que el 409 sea visible aunque el usuario no
    // haya salido del campo.
    if (message) setTouched(previous => ({ ...previous, [field]: true }))
  }, [])

  const clearFieldError = useCallback((field: F) => {
    setBackendErrors(previous => {
      if (!(field in previous)) return previous
      const next = { ...previous }
      delete next[field]
      return next
    })
  }, [])

  const clearErrors = useCallback(() => {
    setBackendErrors({})
    computed.current = {}
  }, [])

  const reset = useCallback((next?: Partial<V>) => {
    const source = { ...initialValues, ...next } as V
    computed.current = {}
    setValues(source)
    setTouched({} as Record<F, boolean>)
    setBackendErrors({})
  }, [initialValues])

  const validate = useCallback((): boolean => {
    const allTouched = Object.fromEntries(fields.map(field => [field, true])) as Record<F, boolean>
    const next = runAllRules(values)
    computed.current = { ...next, ...backendErrors }
    setTouched(allTouched)
    const hasErrors = fields.some(field => Boolean(computed.current[field]))
    return !hasErrors
  }, [fields, runAllRules, values, backendErrors, fieldNames])

  return {
    values,
    errors: { ...computed.current, ...backendErrors },
    touched,
    fieldError: useCallback(
      (field: F) => (touched[field] ? computed.current[field] ?? backendErrors[field] : undefined),
      [touched, backendErrors],
    ),
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
    clearFieldError,
    clearErrors,
    reset,
    validate,
  }
}
