/**
 * Ruta publica bajo la que se sirve la app, sin "/" final: "" en local y
 * "/SGA" detras del reverse proxy. Sale del `base` de Vite (VITE_BASE_PATH).
 *
 * `navigate()` y `<Link>` ya la aplican via el `basename` del router; esto es
 * solo para lo que sale del router: `window.location` y las rutas que el
 * backend devuelve al navegador (retorno del pago en linea).
 */
export const BASE_PATH: string = import.meta.env.BASE_URL.replace(/\/+$/, '')

/** Convierte una ruta del router ("/login") en la ruta real del navegador ("/SGA/login"). */
export function toBrowserPath(routePath: string): string {
  return `${BASE_PATH}${routePath}`
}
