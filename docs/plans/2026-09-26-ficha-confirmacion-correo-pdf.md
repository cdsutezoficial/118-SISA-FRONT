# Plan — Confirmación de ficha, rediseño de correo y PDF

**Fecha:** 2026-09-26
**Alcance:** post-registro y recuperación de ficha de admisión
**Repos:** `118-SISA-FRONT`, `118-SISA-BACK`

---

## Objetivo

Dejar el cierre del proceso de ficha de admisión como el momento más sólido del
producto: que elAspirante no pueda ignorar que ya pagó, que el correo se vea como
SISA y llegue a la bandeja de entrada, que el PDF sea una constancia presentable, y
que ningún Aspirante pueda quedar atrapado con un pago que el gateway ya cobró.

---

## Hallazgos de la sesión de validación (2026-09-26)

Contexto: se recreó la base de datos local y se validaron los dos puntos de entrada
de pago sobre la API real y el gateway real.

| # | Hallazgo | Impacto |
|---|---|---|
| 1 | El pago funciona de extremo a extremo. Candidato `ADM-2026-000002` pagó y se emitió `REC-20260926-000002`. | Flujo validado |
| 2 | El correo **sí se envía** (llegó a spam). | El pipeline funciona; falla la entregabilidad |
| 3 | EVO rechaza un `order.id` solo cuando **ya recibió un pago**. Reutilizar uno sin pagar funciona. | El bloqueo es `order.id`, no `reference` |
| 4 | Un `reference` duplicado **no** molesta: `#2` pagó con `REF-20260926-000002` ya usado. | No hace falta hacer único el `reference` |
| 5 | Los catálogos usan `GenerationType.UUID` → dropear la BD cambia todos los UUID. | Nada de UUID hardcodeado; la UI ya resuelve por API |

### Documentación del gateway

De `cosas-pagos/evo.txt` (documentación oficial de EVO Hosted Checkout v72):

- **`order.id` — línea 188:**
  > "This value must be unique for every order you create using your merchant profile."
- `order.id` — máx. **40** caracteres (línea 192). El límite de 32 que usa el
  proyecto es propio, no del gateway.
- `reference` no aparece como campo con requisito de unicidad.
- `merchant` — hasta 12 caracteres.

**Conclusión:** el contador `checkout_attempts` que se habíaFeliz diseñado es
innecesario **e insuficiente** (arranca en 0 tras cada reset de BD). Lo único que
hace falta es derivar `order.id` de algo que no se repita.

---

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| React Email | Diseñar en el editor → exportar HTML → recurso estático en el backend |
| PDF | Ficha completa de 3 páginas, mejor jerarquía, identidad, **sin QR** |
| Logo | Usar `public/logo-utez.png` tal cual (ya tiene alfa) y moverlo al backend. **No** convertir `logo-iconos.jpg`: es un JPG de fondo café sin transparencia |
| `order.id` | Fragmento del UUID del candidato; subir el límite a 40 |
| Referencia | Se mantiene legible y puede repetirse entre environments |

---

## Assets nuevos

```
118-SISA-BACK/src/main/resources/
├── assets/
│   └── utez-logo.png                    ← 594×300 ARGB con alfa, 83.8 KB (copia byte a byte)
└── templates/
    ├── ficha-pago-confirmacion.html     ← export de React Email
    └── ficha-pago-confirmacion.txt      ← plain text (entregabilidad)
```

El backend genera **el correo y el PDF**, así que el asset vive del lado backend.

`118-SISA-FRONT/public/logo-utez.png` es la fuente y **ya viene optimizado**, con
alfa real; se copió sin reprocesar. Sigue estando en `public/` porque el front
también lo puede servir, pero hoy **nadie lo referencia** en `src/`.

> `public/logo-iconos.jpg` (900×900, 219 KB) quedó **descartado**: es un JPG con
> fondo café, ~196 colores y gradiente, sin canal alfa. Ver la Fase 2 para el
> detalle de la medición. No lo borro porque la decisión de qué es cada imagen es
> tuya, no mía.

---

## Fase 0 — La alerta que no se quita

**Objetivo:** que ningún overlay ni toast pueda quedar pegado o vacío.

### Causas identificadas

1. **`Toast` reinicia su propio timer.** `ui.tsx` hace el `setTimeout(onClose, 3500)`
   dentro de un `useEffect` con dependencia `[onClose]`. Cada pantalla le pasa
   `onClose={() => setToast('')}` — una función **nueva en cada render**. Cualquier
   re-render reinicia la cuenta regresiva, así que con renders frecuentes el toast
   nunca se cierra.
2. **El overlay de `processing`** es `fixed inset-0 z-[200]`: si el flag se cuelga en
   `true`, tapa la pantalla entera.
3. **El DOM que inyecta el SDK de EVO no se limpia.** `setEvoCheckout(null)` solo
   borra estado React; el nodo que creó `checkout.min.js` sigue en el documento.
4. Un toast con mensaje vacío renderiza la caja con icono y cierre, pero **sin texto**.

### Cambios

- `Toast`: callback estable vía `useRef`, y no renderizar si el mensaje está vacío.
- `useFichaPayment`: garantizar `processing` en `false` con `try/finally` en todos
  los caminos de salida.
- Remover el DOM de EVO al cerrar/cancelar (nodo del contenedor + iframe del SDK).
- Unificar en un solo mechanism de alerta con autocierre garantizado y cierre manual.

### Verificación

Pagar, cerrar la pestaña en el retorno 3DS, y confirmar que no queda nada pegado ni
con texto vacío.

---

## Fase 1 — La confirmación como pantalla principal

**Objetivo:** que el Aspirante no pueda ignorar que ya pagó.

Hoy la pantalla exitosa es la misma ficha con un bloque verde pequeño. La propuesta la
convierte en el estado más importante de la pantalla.

### Cambios

- Banda de éxito a ancho completo con el **folio como dato principal** y el monto pagado.
- Bloque de comprobante destacado: `REC-…`, fecha de pago, referencia.
- **Descargar comprobante** como botón primario dentro del bloque de éxito, no
  escondido al final de la página.
- Sección "qué sigue" con los próximos pasos y el aviso de que el correo ya salió.
- **Componente compartido** entre `FichaConfirmacion.tsx` y `PortalFichaPago.tsx` para
  que las dos pantallas se vean idénticas y no divergan.

**Estado: completada (2026-09-26).**

- `FichaPagoConfirmado.tsx` (nuevo) con los cinco bloques: éxito, folio, monto,
  comprobante, qué sigue. Verde institucional `#009574`, no `emerald`.
- En `PAID`, `FichaConfirmacion` y `PortalFichaPago` renderizan **solo** el bloque
  compartido. Eso eliminó de paso la tarjeta "Monto a pagar" de la recuperación,
  cuya etiqueta era incorrecta una vez pagado.
- Se **quitó el badge `Pagado`**: era un parche para cuando la banda verde no
  existía. El spec lo exigía, así que va un delta en
  `openspec/changes/confirmacion-pago-ficha-protagonista/`.
- `PortalFichaPago` **no** recibe el email: `payment-access` no lo expone porque
  folio + 3 de la CURP es identidad débil. Agregarlo filtraría un dato de contacto.

### Bug encontrado al cablear el componente

Los campos "Folio de comprobante" y "Fecha de pago" salían en `—` en
`/portal/registro/ficha`, pero **sí** en `/portal/ficha/pago`, para la misma ficha.

No era cosmético: la lente `FichaDisplay` no tenía dónde guardar `recibo` /
`fechaPago`, y ambos se leían **solo** de `confirmData`, que es `null` salvo tras
un confirm en vivo. O sea, cualquier recarga de la confirmación post-registro
decía no tener comprobante aunque el recibo existiera en la BD — y quien cerraba
la pestaña tras pagar volvía justo por esa recarga. `PortalFichaPago` ya tenía el
fallback a `acceso`; esa asimetría era la señal.

Corregido leyendo de la proyección del candidato, igual que hace la otra pantalla.

### Verificación

- `npm run typecheck` limpio; `npm run build` OK (1826 módulos).
- `GET /candidates/3551d4c2-…` devuelve `receiptNumber: REC-20260926-000002` y
  `paidAt: 2026-09-26T18:59:32Z` — confirmado a nivel de API, no solo de tipos.
- **Pendiente en navegador:** recargar `/portal/registro/ficha?id=3551d4c2-…` y
  confirmar que aparecen `REC-20260926-000002` y `26/09/2026`.

---

## Fase 2 — Asset del logo

**Objetivo:** dejar un logo utilizable en correo y PDF.

**Estado: completada (2026-09-26).** La premisa original resultó incorrecta y el
plan se corrigió sobre lo medido, no sobre lo supuesto.

### Hallazgo que cambió el plan

`logo-iconos.jpg` (900×900, JPG) **no es un logo plano con fondo transparente**:

| Medición | Valor | Lectura |
|---|---|---|
| `PixelFormat` | `Format24bppRgb` | Sin canal alfa (los JPEG no lo tienen) |
| Esquinas | `#9A6B4F` `#AD7856` `#855338` `#986344` | Fondo **café**, con gradiente diagonal |
| Centro | `#C9C7BB` | Gris claro, no blanco |
| Colores distintos | ~196 (muestreados) | Demasiados para arte plana; compatible con degradado |
| Nombre | `logo-iconos.jpg` | "iconos" en plural: posiblemente un set, no un logo único |

Convertirlo a PNG habría costado **más** peso sin ganancia (lossless + degradados)
y en el correo/PDF habría salido una caja café. La fase se redirigió al asset
correcto que el usuarioiscopaló: `public/logo-utez.png`.

### Cambios aplicados

- `public/logo-utez.png` → `118-SISA-BACK/src/main/resources/assets/utez-logo.png`,
  **copia byte a byte** (SHA-256 verificado: `616931F0…7FA891`). No se reprocesó:
  ya viene optimizado.
  - 594×300, `Format32bppArgb`, **con alfa real**, 83.8 KB, 96 dpi.
  - Las cuatro esquinas son `A=0`; ~65% del canvas es transparente (padding generoso).
  - Centro `#009475` — el verde de marca que usa el sistema (`#009574`).
  - 594×300 con alfa ya es lo que React Email y OpenPDF necesitan; no hace falta
    recortar ni cuantizar.
- `index.html`: el `public/favicon.ico` ya existía (32×32, `Format32bppArgb`, 24
  colores — un ícono real dibujado) pero **no estaba declarado**. El navegador
  caía al fallback automático de `/favicon.ico`, que se rompe con cualquier CDN o
  base path. Ahora se declara con `<link rel="icon">` y `<link rel="shortcut icon">`.

### Favicon: decisión y límite

Del lockup **no se puede sacar una marca cuadrada**: no hay columna vacía interna
(las únicas son los bordes `0..11` y `549..593`), y el reparto de altura confirma el
patrón marca-alta + texto (`izquierda 0-25%` ocupa `y[11..286]`, el texto derecho
solo `y[65..286]`, con baseline compartido en `y=286`). Un recorte cuadrado
arrastraría letras sueltas del nombre, y a 16 px sería ilegible.

Por eso **no se recortó a ciegas**: se declaró el ícono existente. Para tamaños
modernos (`192`, `512`, `apple-touch-icon` 180) hace falta un archivo cuadrado
propio; amplificar el de 32 px solo produciría desenfoque.

---

## Fase 3 — Rediseño del correo — **COMPLETADA 2026-09-26**

**Objetivo:** que se vea como SISA y no se pierda en spam.

### Cambios aplicados

- `templates/ficha-pago-confirmacion.html`: tablas + CSS inline, sin `<style>` (Gmail
  lo descarta), sin botón. Placeholders `{{nombre}}`, `{{folio}}`, `{{carrera}}`,
  `{{monto}}`, `{{referencia}}`, `{{recibo}}`, `{{fechaPago}}`, `{{logo}}`.
- `templates/ficha-pago-confirmacion.txt`: los mismos datos en texto plano.
- `CandidateFichaMailService`: carga de plantillas con cache (el fallo también se
  cachea, vía sentinel), sustitución de placeholders, escapado HTML y colapso de
  whitespace en ambas variantes, y `minimalTextBody` como fallback si la plantilla
  de texto no está en el classpath.
- Logo embebido por **CID** (`Content-ID: <utez-logo>`, `Disposition: INLINE`),
  no por URL pública: no requiere host y no filtra tracking.
- `sendPaymentConfirmation` cambió de `LocalDate deadline` a `Instant paidAt`, y
  `CandidateController` pasó a enviar `result.paidAt()`.

### Desviaciones respecto al plan original

Tres cosas se(done) distinta a lo planeado, y por qué:

1. **No se usó el editor de React Email.** La plantilla se escribió directamente
   como HTML email-safe. El resultado es el mismo artefacto estático, y el editor
   habría añadido un paso de export sin cambiar el archivo final.
2. **Sin `List-Unsubscribe`.** El plan lo pedía, pero es correo transaccional:
   la cabecera lo marca como masivo y **empeora** la entregabilidad. Se descartó.
3. **El árbol MIME se arma a mano, no con `MimeMessageHelper`.** No por
   preferencia: `MimeMessageHelper` tiene una sola parte principal y cada
   `setText` la sobrescribe, así que el segundo `setText(html, true)` **descarta
   el texto plano en silencio** en lugar de crear un `alternative`. Verificado
   empíricamente contra spring-context-support 6.2.19 antes de decidir. Se
   construye `related( alternative( plain, html ), logo )` de forma explícita.
   `MimeMessageHelper` se conserva solo para `To`/`Subject`.

### Advertencia

Esto mejora la presentación, pero **el envío a spam no se resuelve solo**. Hacen
falta SPF/DKIM alineados para `sisa@utez.edu.mx`, que es configuración de DNS y
depende de que el dominio lo controle la universidad.

La fecha se formatea en la **zona del servidor**, no la del Aspirante: un pago a
las 23:30 en `America/Mexico_City` puede mostrar el día siguiente si el servidor
corre en UTC. `paidAt` viaja crudo en la respuesta del confirm, así que se puede
formatear en el cliente si el caso aparece.

### Verificación

- `.\mvnw.cmd -o test` → **967 tests, 0 fallos** (antes 954). Los 15 nuevos de
  `CandidateFichaMailServiceTest` recorren el árbol MIME real; el mensaje se
  `saveChanges()` a mano porque el `send` mockeado no lo hace, igual que el
  `JavaMailSenderImpl` real.
- `npm run typecheck` y `npm run build` limpios.
- Preview renderizado con datos reales de la API y abierto en navegador
  (`%TEMP%\opencode\preview-correo-ficha.html`, 0 placeholders sin resolver).
- **Pendiente:** revisión visual en Gmail/Outlook. El modelo no puede ver
  imágenes, así que la maqueta final la tiene que ver una persona.

---

## Fase 3.5 — La jerarquía del estado PENDIENTE — **COMPLETADA 2026-09-26**

**Origen:** el usuario señaló que la ficha sin pagar no prioriza el folio, en
`/portal/registro/ficha?id=a342d72a-...` (folio `ADM-2026-000003`). La Fase 1 había
arreglado la jerarquía **solo del lado pagado**, que es la mitad que se ve después
de hecho el pago. El pendiente mostraba el folio como un `ReadField` más entre
seis campos, y en `/portal/ficha/pago` como uno de tres.

**Diagnóstico:** el mismo archivo que se había duplicationado para las
confirmaciones se había duplicado igual para los pendientes, y divergió igual.
Mismo dato, dos jerarquías, y se leía como si el folio importara una vez pagado.

### Cambios aplicados

- `FolioMontoClave.tsx` (nuevo): bloque de folio + monto, con tercer slot opcional
  para la fecha límite. Es la pieza que impide la divergencia futura, porque ambos
  estados la consumen literalmente.
- `FichaPagoPendiente.tsx` (nuevo): estado pendiente compartido por las dos vistas.
  Banda ámbar, folio + monto + fecha límite, datos de apoyo al fondo, acción de pago
  dentro de la tarjeta.
- `FichaPagoConfirmado.tsx`: ahora consume `FolioMontoClave`. Se eliminó el
  `montoTexto` que quedó sin uso.
- `FichaConfirmacion.tsx`: fuera el encabezado, la tarjeta de datos, el bloque azul
  de "Pago en línea" y la fila de acciones del PDF. El botón de pago pasó a
  primario y la descarga del PDF a secundaria **debajo** — estaba por encima, que es
  el orden invertido respecto a la intención.
- `PortalFichaPago.tsx`: fuera las tarjetas "Datos del candidato" y la ficha con el
  monto; se conserva el aviso degradado de 3DS y no se expone el correo.

### Dos decisiones que conviene no perder de vista

1. **La banda pendiente es ámbar, no verde.** El `#009574` institucional ya significa
   "pago recibido" en la confirmación. Reutilizarlo en el pendiente haría que una
   ficha sin pagar se leyera como pagada. No hay token de warning en el design
   system, así que se usó la rampa `amber-50/100/200/700`, que es la misma que ya
   usaba el bloque informativo anterior con `blue-50/200/700`.
2. **La fecha límite se muestra sin afirmar expiración.** Se verificó que el backend
   la guarda y la proyecta pero **ningún caso de uso la compara contra el reloj**:
   no hay enforcement. Presentarla como "paga antes o pierdes tu lugar" sería
   inventar una consecuencia que el sistema no ejecuta. Se muestra como dato.

### Verificación

- `npm run typecheck` y `npm run build` limpios (1828 módulos).
- Sin residuos del código viejo: `paymentSection`, `actionsRow`, `fichaCard` y
  `header` ya no existen; `ReadField` sale de `PortalFichaPago.tsx`.
- **Pendiente:** revisión visual de los dos estados pendientes en navegador.

---

## Fase 4 — Rediseño del PDF

**Objetivo:** que la ficha sea una constancia presentable.

`CandidateFichaPdfService` tiene 409 líneas con OpenPDF, 3 páginas, Helvetica y el
color de marca. La base es sólida; el trabajo es de jerarquía visual.

### Cambios

- Encabezado de identidad con el logo, folio y estado de pago.
- Jerarquía: encabezados de sección en color de marca, ritmo etiqueta/valor,
  importes alineados a la derecha.
- Se mantiene el aviso de "sin validez oficial" y el pie con folio y fecha.
- **Sin QR**, por decisión propia.

### Verificación

Generar el PDF de un candidato pagado y de uno pendiente; confirmar acentos, que no
se corte ninguna tabla y que el logo no se deforme.

---

## Fase 5 — `order.id` único y auto-cura

**Objetivo:** que nadie quede atrapado con un pago que EVO ya cobró.

### Cambios

1. `OrderIdBuilder.build(folio, candidateId)` → agrega un fragmento del UUID del
   candidato. Un reset de BD nunca puede recrear un `order.id` ya cobrado.
2. Subir `EVO_ORDER_ID_LENGTH` de 32 a 40 (el gateway permite 40; el límite de 32 es
   propio del proyecto y hoy recorta sin necesidad).
3. **Auto-cura:** si el checkout falla con "already received", consultar
   `retrieveOrder(orderId)`; si devuelve `SUCCESS`, marcar el pago `PAID` local en
   vez de dejar al Aspirante viendo "Pagar en línea" para siempre.

El caso que motiva el punto 3 es real y no es el del reset: si el Aspirante cierra
la pestaña en el retorno 3DS, el `confirm` nunca llega, la BD queda `PENDING`, el
gateway tiene el pago, y cada reintento es rechazado para siempre.

El `reference` **no** se toca: puede repetirse sin problema (hallazgo 4).

### Verificación

Reprocesar el caso `ADM-2026-000001` y ver que se auto-cura.

---

## Orden de ejecución

```
0 ✅ → 1 ✅ → 2 ✅ → 3 ✅ → 4 → 5
```

Las Fases 0 y 1 son las únicas que tocan comportamiento existente: van primero y
solas. La Fase 2 es rápida y desbloquea las dos de diseño.

**Estado al 2026-09-26:** Fases 0–3 implementadas. Pendiente únicamente la
revisión visual en navegador/cliente de correo de las Fases 1–3, y luego las
Fases 4 (PDF) y 5 (`order.id` + auto-curación EVO).

Cada fase con cambio de comportamiento lleva su change de OpenSpec. No se hace
commit sin autorización explícita.

---

## Fuera de alcance

- Pago en ventanilla, transferencia o envío de instrucciones de pago.
- **Reenvío del correo desde `/portal/ficha/pago`.** La vista solo informa que se
  envió; un botón de reenvío exigiría endpoint propio, autorización y rate
  limiting, y no se pidió. La Fase 3 deliberadamente no lo incluye.
- QR en el PDF.
- Backend de inducción.
- Configuración de DNS (SPF/DKIM) — depende del dominio de la universidad.
