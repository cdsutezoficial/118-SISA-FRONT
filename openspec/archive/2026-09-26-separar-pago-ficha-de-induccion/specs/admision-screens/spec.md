# Delta for Admision Screens

## ADDED Requirements

### Requirement: Portal Candidato — Acceso Pago de Ficha (`/portal/ficha`)

Complemento real (no es un Screen 16/17; esos números pertenecen a inducción) al acceso del curso de inducción. La pantalla pública sin chrome MUST presentar dos caminos de acceso claramente separados por un divisor visual: (a) LlaveMX con el botón oficial y el badge "Nuevo", y (b) folio + últimos 3 caracteres de la CURP.

El camino LlaveMX MUST mostrarse como placeholder navegable-por-ninguna-parte: al presionarlo MUST NOT navegar a ninguna ruta, porque no existe OAuth y el payload que `/portal/ficha/pago` requiere no puede generarse sin un proveedor de identidad. MUST communicate su indisponibilidad en lugar de fallar en silencio.

El camino folio + CURP MUST llamar al backend real `POST /candidates/payment-access` y MUST NOT comparar contra datos locales. La validación de cliente MUST exigir el patrón de folio y exactamente 3 caracteres de CURP (las homoclavas reales mezclan letras y dígitos, así que no es solo-dígitos). Este camino MUST NOT requerir `induccionHabilitada`: es la ficha, no el curso de inducción. En éxito MUST navegar a `/portal/ficha/pago`; en fallo MUST mostrar error inline sin navegar.

Because folio + CURP is a weak identity proof, la respuesta MUST ser mínima (solo datos de pago, nunca domicilio, perfil de salud, ingresos ni calificaciones), el folio inexistente y la CURP incorrecta MUST producir el MISMO mensaje genérico para que no sirva de enumeración, y el backend MUST limitar por IP.

#### Scenario: LlaveMX pressed on the ficha access screen
- GIVEN the candidate is on `/portal/ficha`
- WHEN they press the LlaveMX button
- THEN no navigation MUST occur
- AND an inline notice MUST state that LlaveMX access is not yet available and point to the folio + CURP path

#### Scenario: Valid folio and CURP suffix open the real payment screen
- GIVEN a candidate with a pending ficha payment
- WHEN they submit a well-formed folio and a 3-character CURP suffix that match
- THEN the system MUST call `POST /candidates/payment-access` and, on success, navigate to `/portal/ficha/pago` carrying the access payload

#### Scenario: Unknown folio and wrong CURP are indistinguishable
- GIVEN a folio that does not exist
- WHEN the candidate submits it with any 3-character suffix
- THEN the error shown MUST be identical to the error shown for an existing folio with a wrong suffix, and no navigation MUST occur

#### Scenario: Rate limit is surfaced, not swallowed
- GIVEN the candidate has exceeded the per-IP attempt limit
- WHEN they submit again
- THEN a 429-derived inline message MUST ask them to wait, and no navigation MUST occur

#### Scenario: Induction-only gate does not block ficha access
- GIVEN a candidate whose `induccionHabilitada` is false but who has a pending ficha payment
- WHEN they submit a matching folio and CURP suffix
- THEN access MUST be granted, because the induction gate governs the course, not the ficha

### Requirement: Portal Candidato — Pago de Ficha (`/portal/ficha/pago`)

 MUST mostrar únicamente datos de pago (nombre, programa, folio, monto, estatus) y, una vez pagado, el comprobante con fecha de confirmación, folio de comprobante, badge `Pagado` y la copia PDF no oficial. MUST NOT render la ficha completa aunque el lookup devuelva un `candidateId` que el backend podría usar para servirla.

El checkout MUST ser real contra EVO mediante el hook compartido `useFichaPayment`, y MUST soportar dos entradas: navegación fresca con el payload en route state, y retorno de un reto 3D Secure del banco, donde la página recarga en `?id=…&orderId=…` y el route state se pierde — por eso el payload MUST estar espejado en `sessionStorage` con clave por candidate id. La confirmación MUST dispararse una sola vez y MUST NOT iniciar un segundo pago.

La ruta de retorno al gateway MUST ser `/portal/ficha/pago` y MUST estar en la allowlist del backend; si el backend la ignora, el retorno del banco deja al candidato en una pantalla vacía.

#### Scenario: Fresh access from the ficha portal
- GIVEN the candidate navigated from `/portal/ficha` with an access payload in route state
- WHEN `/portal/ficha/pago` loads
- THEN it MUST render the payment summary and allow starting checkout

#### Scenario: Return from a bank 3D Secure challenge
- GIVEN the page reloads at `/portal/ficha/pago?id=<uuid>&orderId=…&resultIndicator=…` with no route state
- WHEN the screen mounts
- THEN it MUST recover the access payload from `sessionStorage` and render the confirmation instead of a blank screen

#### Scenario: Gateway return path is allowlisted
- GIVEN the backend allowlist is `/portal/registro/ficha,/portal/ficha/pago`
- WHEN checkout is initiated for the ficha recovery flow
- THEN the gateway return URL MUST resolve to `/portal/ficha/pago` and MUST NOT be silently dropped

#### Scenario: Degraded 3DS return with no cached payload
- GIVEN the page reloads from the gateway with `?id=…&orderId=…` but no cached payload is available
- WHEN the candidate asks to continue
- THEN the system MUST offer to look the ficha up again by folio and CURP and MUST NOT start a second payment

### Requirement: Los flujos de ficha e inducción MUST permanecer separados

El sistema MUST tratar `/portal/ficha*` y `/portal/induccion*` como dominios de negocio distintos, no como dos nombres del mismo flujo. Cada par MUST vivir en sus propios componentes de portal, y la implementación de uno MUST NOT sobrescribir la del otro. Ambos pares MUST seguir montados y accesibles; la allowlist de retorno EVO MUST incluir `/portal/ficha/pago` y MUST NOT incluir `/portal/induccion/pago`, porque el curso de inducción no se paga contra el gateway.

La ruta por defecto del rol `CANDIDATO` MUST ser `/portal/ficha`, por ser la única pantalla pública de candidato con API real en este momento.

#### Scenario: Both portal pairs are reachable
- GIVEN a signed-out visitor
- WHEN they navigate to `/portal/ficha`, `/portal/ficha/pago`, `/portal/induccion` or `/portal/induccion/pago`
- THEN each route MUST render its own screen, and `/portal/induccion*` MUST show induction content (mock) rather than ficha content

#### Scenario: Induction flow is unchanged by ficha work
- GIVEN the ficha flow was modified (routes, API, allowlist)
- WHEN a candidate uses `/portal/induccion` with mocked credentials
- THEN the local mock matching and its `induccionHabilitada` gate MUST behave exactly as the spec's Screens 16/17 describe

#### Scenario: Default candidate landing is the real flow
- GIVEN the `CANDIDATO` role is set outside a route its shell shows
- WHEN `AppLayout` redirects to the role default
- THEN it MUST land on `/portal/ficha`
