# Delta for Admision Screens

## MODIFIED Requirements

### Requirement: Portal Candidato - Pago de Ficha (`/portal/ficha/pago`)

MUST mostrar únicamente datos de pago (nombre, programa, folio, monto, estatus) y, una vez pagado, la confirmación compartida descrita abajo. MUST NOT render la ficha completa aunque el lookup devuelva un `candidateId` que el backend podría usar para servirla.
El checkout MUST ser real contra EVO mediante el hook compartido `useFichaPayment`, y MUST soportar dos entradas: navegación fresca con el payload en route state, y retorno de un reto 3D Secure del banco, donde la página recarga en `?id=.&orderId=.` y el route state se pierde - por eso el payload MUST estar espejado en `sessionStorage` con clave por candidate id. La confirmación MUST dispararse una sola vez y MUST NOT iniciar un segundo pago.

La ruta de retorno al gateway MUST ser `/portal/ficha/pago` y MUST estar en la allowlist del backend; si el backend la ignora, el retorno del banco deja al candidato en una pantalla vacía.

En el estado pagado, la vista MUST renderizar el componente compartido de confirmación y MUST NOT renderizar la tarjeta "Datos del candidato" ni la tarjeta "Monto a pagar", porque la etiqueta "a pagar" es incorrecta una vez pagado y ambas compiten con el comprobante. MUST NOT renderizar el badge `Pagado`: la banda de éxito a ancho completo comunica el estado y el badge era un parche para cuando esa banda no existia. MUST NOT exponer el correo del candidato en esta vista, porque `payment-access` no lo devuelve por diseño (folio + 3 de la CURP es una prueba de identidad débil) y agregarlo entregaria un dato de contacto a quien solo conoce folio y tres caracteres.

#### Scenario: Paid recovery shows the shared confirmation
- GIVEN the candidate reached `/portal/ficha/pago` and the payment is confirmed or already paid
- WHEN the view renders
- THEN it MUST render the shared confirmation component and MUST NOT render the "Datos del candidato" card nor the "Monto a pagar" card

#### Scenario: Fresh access from the ficha portal
- GIVEN the candidate navigated from `/portal/ficha` with an access payload in route state
- WHEN `/portal/ficha/pago` loads
- THEN it MUST render the shared pending state with the folio as the dominant figure, and allow starting checkout from within it

#### Scenario: Return from a bank 3D Secure challenge
- GIVEN the page reloads at `?id=<uuid>&orderId=<id>` after a bank challenge
- WHEN the access payload is found in `sessionStorage` or the confirm call succeeds
- THEN the paid state MUST render the shared confirmation; and if the payload is absent, the degraded "Confirmando tu pago…" view MUST be shown instead of a stranded spinner

## ADDED Requirements

### Requirement: Confirmacion de Pago de Ficha compartida

La confirmación de pago de ficha MUST ser un componente compartido único, usado por los dos puntos de entrada que aceptan el pago: la confirmación post-registro (`/portal/registro/ficha`) y el pago/recuperación (`/portal/ficha/pago`). La duplicación del JSX de confirmación MUST NOT regresar en ninguna de las dos vistas.

El componente MUST presentar la información en el orden en que el Aspirante la necesita, en cinco bloques: (1) confirmation de que el pago fue recibido, (2) el folio, (3) el monto pagado, (4) el detalle del comprobante —folio de comprobante, fecha de pago, referencia—, y (5) los próximos pasos. El folio y el monto MUST standout visualmente sobre los demás datos porque son los dos valores que el Aspirante conserva; el resto MUST presentarse como campos de apoyo.

La acción de descargar el comprobante MUST estar dentro del bloque de éxito y MUST ser alcanzable sin desplazarse más allá de la vista del comprobante; MUST NOT quedar al final de la página ni detrás de un bloque plegable. El aviso de que el PDF es una copia sin validez oficial MUST acompanar al boton.

Los próximos pasos MUST afirmar únicamente lo que el sistema ya realiza: que se envió un correo de confirmación, que el folio debe conservarse, y que el comprobante se presenta al ingresar al curso de inducción. MUST NOT afirmar pasos del proceso de admisión que el sistema no ejecuta.

El componente MUST aceptar un aviso de correo con la dirección como dato opcional: el aviso MUST renderizarse en ambas vistas, y la dirección MUST renderizarse únicamente cuando se entregue. La vista post-registro, donde el correo es un dato propio del registro recién creado, MUST pasarla; la vista de recuperación, donde `payment-access` no la devuelve, MUST omitir la dirección y MUST NOT intentar obtenerla por otra vía.

#### Scenario: Post-registration confirmation is the whole screen
- GIVEN a candidate whose ficha payment was just confirmed on `/portal/registro/ficha`
- WHEN the screen renders in the paid state
- THEN only the shared confirmation MUST be rendered; the ficha card, the small green block, and the bottom action row MUST NOT be rendered

#### Scenario: Both entry points render the same confirmation
- GIVEN two candidates in the paid state, one arriving from post-registration and one from the recovery lookup
- WHEN each screen renders
- THEN both MUST render the same confirmation component with the same layout, and the receipt and download action MUST be in the same place in both

#### Scenario: Folio and amount are the visual focus
- GIVEN a paid ficha
- WHEN the confirmation renders
- THEN the folio and the amount paid MUST be visually dominant, and the receipt details MUST be present but subordinate

#### Scenario: Download is reachable without leaving the receipt
- GIVEN a paid ficha with a real backend candidate id
- WHEN the confirmation renders
- THEN a download button for the receipt MUST appear within the success block, and the non-official-copy disclaimer MUST be visible next to it

#### Scenario: Recovery shows the notice without disclosing an address
- GIVEN a paid ficha rendered from the recovery lookup, where the access payload carries no email
- WHEN the confirmation renders
- THEN the confirmation MUST state that a confirmation email was sent to the address used at registration, and MUST NOT render any email address, because `payment-access` deliberately withholds it

#### Scenario: Post-registration shows the address it already owns
- GIVEN a paid ficha rendered from post-registration, where the candidate projection carries the email
- WHEN the confirmation renders
- THEN the confirmation MUST render the notice including that address, because this screen belongs to the session that just created the record

#### Scenario: Reloading a paid post-registration ficha shows the receipt
- GIVEN a candidate whose ficha payment was confirmed in an earlier browser session
- WHEN they reopen `/portal/registro/ficha?id=<uuid>` with no payment session in progress
- THEN the receipt number and the payment date MUST be read from the candidate projection and MUST NOT be shown as unavailable, because no live confirm occurs on a plain reload

#### Scenario: The receipt survives without depending on the payment session
- GIVEN the confirmation renders on a screen reached by reload or by the recovery lookup rather than by a live confirm
- WHEN it reads the receipt number and payment date
- THEN it MUST fall back to the candidate projection or the payment-access payload, and MUST NOT depend solely on the live confirm response

#### Scenario: Already-paid without a receipt is stated honestly
- GIVEN a ficha marked as paid whose stored payment carries no receipt number
- WHEN the confirmation renders
- THEN the receipt field MUST display the same unavailable placeholder used elsewhere in the system, and the subtitle MUST indicate the ficha was already paid rather than promising a receipt for the current visit

### Requirement: Estado pendiente de ficha con el folio protagonista

El estado PENDIENTE de la ficha MUST ser un componente compartido único, usado por los mismos dos puntos de entrada que aceptan el pago, y MUST NOT duplicar su marcado en cada vista. El folio MUST usar el mismo bloque destacado que la confirmación —mismo componente, mismo tamaño, misma posición—, porque el folio no cambia al pagar: si se ve distinto antes y después, se está comunicando que el dato solo cobra importancia post-pago, que es falso.

El estado pendiente MUST presentar la información en el orden en que el Aspirante la necesita: (1) que la ficha está lista y falta el pago, (2) el folio, (3) el monto a pagar y la fecha límite de pago, (4) los datos de apoyo —nombre, CURP, carrera, referencia, fecha límite de inscripción—, y (5) la acción de pago. El monto MUST destacar al menos tanto como en la confirmación: es el segundo dato que el Aspirante conserva, y su tamaño no depende de que el pago esté hecho.

La acción de pagar MUST estar DENTRO de la tarjeta de estado pendiente, MUST ser la acción primaria de la pantalla, y MUST NOT quedar en una caja separada debajo de la ficha: es la razón por la que el Aspirante está en esa pantalla. La descarga del PDF MUST ser una acción secundaria, debajo de pagar, y MUST NOT aparecer por encima del pago.

La banda de estado pendiente MUST NOT usar el verde institucional `#009574`, que en la confirmación significa "pago recibido"; un pendiente que se lee con el color de un pagado comunica un estado que no ocurrió.

#### Scenario: The folio reads the same before and after paying
- GIVEN the same folio, unpaid
- WHEN the pending state renders
- THEN the folio MUST appear in the same shared block, at the same size and position it occupies in the confirmation, because the value does not change on payment

#### Scenario: The amount is as prominent unpaid as it is paid
- GIVEN an unpaid ficha
- WHEN the pending state renders
- THEN the amount MUST be visually dominant, and the support fields MUST be subordinate, so paying is not the first time the Aspirante sees the amount he owes

#### Scenario: Paying is the primary action of the pending screen
- GIVEN an unpaid ficha with a payable amount
- WHEN the pending state renders
- THEN the pay button MUST appear inside the pending card as the primary action, and the PDF download MUST be offered below it as a secondary action

#### Scenario: A pending ficha is not dressed as a paid one
- GIVEN an unpaid ficha
- WHEN the pending state renders
- THEN the status band MUST NOT use the institutional green that marks a confirmed payment, and no wording MUST state that the ficha has been voided or that payment is impossible

#### Scenario: The recovery pending view shows the same hierarchy
- GIVEN a candidate who reached `/portal/ficha/pago` and has not paid
- WHEN the view renders
- THEN it MUST use the shared pending component, MUST NOT render the separate "Datos del candidato" card, and MUST NOT render any email address

### Requirement: Las dos ventanas de la ficha se nombran por separado

El estado pendiente MUST distinguir la ventana de inscripción de la ventana de pago, porque contestan preguntas distintas y una sola columna no puede contestarlas bien.

La fecha límite de inscripción es el cierre de la venta, snapshot con el que se emitió la ficha; para cuando el Aspirante la lee ya pasó, y por eso explica por qué existe su ficha, no qué tiene que hacer hoy. La fecha límite de pago es `payment_concept.available_until`, se lee en vivo en cada request, y es la única que hoy decide si el cobro entra: el checkout la compara contra el reloj. MUST NOT colapsarse en una sola columna `deadline`; una fecha de inscripción rotulada como fecha de pago promete un pago para el día en que ya se cerró el registro.

La ventana que gobierna el pago MUST ser la fecha destacada del bloque de folio, y la de inscripción MUST aparecer como dato de apoyo. Cuando la de pago está presente, la pantalla MUST explicar en su propio texto por qué esa fecha manda, para que no se lea como decorativa y no dependa de que el Aspirante haya leído un aviso previo. Ese texto MUST NOT calcular un "quedan N días" ni afirmar que el pago expira, porque la fecha puede cambiar en el catálogo. Cuando cualquiera de las dos fechas no viene, su fila MUST omitirse sin renderizar un placeholder: un concepto sin `available_until` es un periodo sin fin, no una fecha perdida.

#### Scenario: The payment window is labelled as the payment window
- GIVEN an unpaid ficha whose registration window closed on 30/09 and whose payment concept closes on 05/10
- WHEN the pending state renders
- THEN 05/10 MUST be the highlighted "Fecha límite de pago" and 30/09 MUST appear separately as "Fecha límite de inscripción", because the number under a promise of "pay by" must be the date the payment is actually accepted

#### Scenario: The screen says why that date governs the payment
- GIVEN an unpaid ficha with a payment closing date
- WHEN the pending state renders
- THEN the screen MUST state in its own text that the date comes from the payment concept and is checked when the payment starts, so the consequence is visible on the screen itself rather than only in a notice the Aspirante may have missed

#### Scenario: A ficha that predates an extension pays by the extended date
- GIVEN a ficha registered before the payment concept's closing date was extended
- WHEN the Aspirante returns to the pending state
- THEN the displayed payment closing date MUST be the one read live from the catalog, not the snapshot taken at registration, so an extension reaches fichas issued weeks earlier

#### Scenario: A concept with no closing date shows no payment row
- GIVEN an unpaid ficha whose payment concept has no `available_until`
- WHEN the pending state renders
- THEN no "Fecha límite de pago" row MUST appear, and no dash or placeholder MUST stand in for it, because an open-ended period is not a missing date

#### Scenario: A missing registration deadline is not invented
- GIVEN a ficha whose registration deadline was not returned
- WHEN the pending state renders
- THEN no "Fecha límite de inscripción" row MUST appear and the screen MUST NOT substitute a computed date such as "ten days from today", because a date not derived from either catalog is a contradiction of both

### Requirement: Correo de confirmación de ficha

El correo de confirmación de pago MUST enviarse una sola vez, disparado por la confirmación del pago, y MUST conservar el contrato best-effort existente: un fallo de SMTP MUST registrarse con traza completa y MUST NOT propagarse a la respuesta HTTP ni retrasarla. El envío MUST permanecer asíncrono fuera del modo de desarrollo, y el flag `sisa.mail.fail-fast` MUST conservarse como único mecanismo de envío síncrono.

El correo MUST incluir los mismos datos que la vista de confirmación: folio, monto pagado, folio de comprobante, referencia, fecha de pago y carrera. La fecha de pago MUST tomarse del instante confirmado por la pasarela y MUST NOT leerse del reloj del backend al renderizar, porque una reconfirmación o un envío encolado estamparían hoy sobre un comprobante anterior. Un dato ausente MUST renderizarse como guion y MUST NOT sustituirse por la fecha del día.

El cuerpo MUST ser `multipart/alternative` con `text/plain` primero y `text/html` después, ambos desde plantillas en `resources/templates`. El texto plano MUST existirse porque un correo de solo texto tiene mayor probabilidad de caer en spam. El logo MUST incrustarse por CID en la variante HTML y MUST NOT referenciarse por URL pública.

Los valores interpolados en la variante HTML MUST escaparse, y el espacio en blanco MUST colapsarse en ambas variantes: el nombre es texto libre capturado en el registro, y sin esas dos transformaciones un `\"` rompería la maquetación y un salto de línea podría forjar una línea con apariencia de campo del comprobante.

Si falta una plantilla en el classpath, el correo MUST enviarse igualmente con un cuerpo mínimo en texto plano. Una plantilla ausente MUST costar formato, MUST NOT costar el comprobante.

El correo MUST NOT incluir cabecera `List-Unsubscribe`: es un correo transaccional y añadirla lo señala como masivo, lo que perjudica la entregabilidad. El cuerpo MUST NOT incluir botón ni enlace de descarga, porque el comprobante se descarga dentro del portal, que es donde vive la sesión del Aspirante.

#### Scenario: Receipt reaches the applicant even when SMTP is down
- GIVEN the payment was confirmed and the mail server is unreachable
- WHEN the confirm endpoint responds
- THEN it MUST return the payment confirmation successfully, and the send failure MUST appear only in the logs

#### Scenario: The receipt carries the gateway date, not the send date
- GIVEN a payment whose gateway-confirmed instant is earlier than today
- WHEN the confirmation email is rendered
- THEN the date shown MUST be the gateway-confirmed instant's date, and MUST NOT be the current date

#### Scenario: Both bodies survive in the sent message
- GIVEN a payment is confirmed and the mail is captured
- WHEN the MIME tree is inspected
- THEN it MUST contain a `text/plain` body and a `text/html` body under a `multipart/alternative`, with the plain body first, and the HTML part MUST be nested so the `cid:` logo reference resolves

#### Scenario: Free text cannot forge receipt fields
- GIVEN a candidate whose registered name contains HTML markup and a newline followed by text shaped like a receipt field
- WHEN the confirmation email is rendered
- THEN the HTML body MUST contain the markup escaped, and no body MUST contain the injected text at the start of a line

#### Scenario: A missing template still delivers the receipt
- GIVEN the HTML template is absent from the classpath
- WHEN a payment is confirmed
- THEN a confirmation email MUST still be sent carrying the folio, amount, reference, date and receipt number in plain text
