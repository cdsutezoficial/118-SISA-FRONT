# Tasks: La confirmacion de pago de ficha pasa a ser la pantalla

## 1. Componente compartido

- [x] 1.1 Crear `modules/admision/components/FichaPagoConfirmado.tsx` con los cinco bloques: exito, folio, monto, comprobante, que sigue
- [x] 1.2 Props: `folio`, `monto`, `referencia`, `recibo`, `fechaPago`, `email` (opcional), `subtitulo`, `onDescargarPdf`, `busyPdf`, `puedeDescargar`
- [x] 1.3 Banda de exito con `#009574` (verde institucional, no `emerald`) y check de 34px
- [x] 1.4 Folio y monto en grande; comprobante y proximos pasos subordinados
- [x] 1.5 Boton de PDF dentro del bloque de exito, con el aviso de "copia sin validez oficial" al lado
- [x] 1.6 Linea de correo siempre presente; la direccion es opcional (`email={{ direccion? }}`)
- [x] 1.7 Docblock que explique el por que de compartirlo y el por que del verde institucional

## 2. Post-registro (`FichaConfirmacion.tsx`)

- [x] 2.1 Importar `FichaPagoConfirmado`; quitar `CheckCircle2` del import de iconos
- [x] 2.2 `header` pasa a ser solo el estado pendiente (se elimina la variante "Registro exitoso")
- [x] 2.3 Eliminar el bloque `paymentDone` (verde pequeno) y derivar su informacion a `subtituloConfirmacion`
- [x] 2.4 `subtituloConfirmacion` distingue confirmacion recien hecha / ya pagado / generico
- [x] 2.5 Estado `PAID` renderiza **solo** el componente compartido: sin `header`, sin `fichaCard`, sin `actionsRow`
- [x] 2.6 Mover `actionsRow` dentro de la rama pendiente (antes se renderizaba tambien en pagado, con el PDF duplicado)
- [x] 2.7 `paymentSection` y el panel EVO intactos (ya guardados con `!pagado`)

## 2b. Fix: el comprobante no se perdia al recargar

- [x] 2b.1 `FichaDisplay`: agregar `recibo` y `fechaPago` (`string | null`) — la lente no tenia por donde guardar lo que el backend ya mandaba
- [x] 2b.2 `buildInitial()`: ambos en `null` (el route state viene de un pago recien creado)
- [x] 2b.3 `apiGet`: mapear `f.receiptNumber` / `f.paidAt` — este es el paso que arregla la recarga
- [x] 2b.4 `onConfirmed`: setear ambos desde el confirm en vivo
- [x] 2b.5 Props: `confirmData?.x ?? ficha.x`, misma precedencia que `PortalFichaPago.tsx:148`
- [x] 2b.6 Mantener `—` para el caso de ficha pagada sin comprobante en la BD
- [x] 2b.7 Escenario de spec para la recarga (no cubierto antes; por eso se colo el bug)
- [ ] 2b.8 Verificar que `/portal/registro/ficha?id=3551d4c2-6f8a-419e-9cdc-354eeee1d7c4` ya muestra `REC-20260926-000002` y `26/09/2026`

## 3. Recuperacion (`PortalFichaPago.tsx`)

- [x] 3.1 Importar `FichaPagoConfirmado`; quitar `CheckCircle2`, `Download` y `BadgePill` de los imports
- [x] 3.2 Estado `pagado` renderiza el componente compartido en lugar del bloque verde
- [x] 3.3 Envolver la vista pendiente (datos del candidato, monto a pagar, checkout, retorno degradado) en el `else`
- [x] 3.4 Pasar `email={{}}` (aviso sin direccion): `payment-access` no expone el correo y agregarlo filtraria un dato de contacto a quien solo tiene folio + 3 de la CURP
- [x] 3.5 Dejar el encabezado de pagina y el return degradado 3DS sin cambios

## 4. Verificacion

- [x] 4.1 `npm run typecheck` limpio
- [x] 4.2 `npm run build` exitoso, 1826 modulos (antes 1825)
- [x] 4.3 `noUnusedLocals` respetado: ningun import huerfano por los bloques eliminados
- [x] 4.4 Encoding: los tres archivos validados como UTF-8 sin U+FFFD
- [ ] 4.5 Revisar en navegador `/portal/registro/ficha?id=<uuid>` con ficha pagada
- [ ] 4.6 Revisar en navegador `/portal/ficha` -> `/portal/ficha/pago` con ficha pagada
- [ ] 4.7 Confirmar que las dos pantallas se ven iguales y que la banda verde doble se lee bien
- [ ] 4.8 Confirmar que el boton de PDF descarga desde ambas entradas

## 5. Spec

- [x] 5.1 Delta con MODIFIED para `/portal/ficha/pago` (se elimina el badge `Pagado`, se prohíben las tarjetas en estado pagado, se prohíbe exponer el correo)
- [x] 5.2 Delta con ADDED para el componente compartido, con escenarios
- [x] 5.3 Delta con ADDED para el correo de confirmacion: `multipart/alternative`, CID del logo, fecha de la pasarela, escapado y colapso de espacio en blanco, fallback sin plantilla, y la exclusion de `List-Unsubscribe`
- [ ] 5.4 `openspec validate --strict` (CLI no instalado en el repo; queda pendiente)

## 6. Fase 3 - correo de confirmacion

- [x] 6.1 `ficha-pago-confirmacion.html` en `resources/templates`: tablas + CSS inline, sin `<style>`, sin boton, `{{logo}}` como placeholder (no `cid:` fijo, para poder quitarlo si falta el asset)
- [x] 6.2 `ficha-pago-confirmacion.txt` con los mismos datos y la misma informacion
- [x] 6.3 `CandidateFichaMailService`: carga de plantillas con cache (incluido el fallo, via sentinel), sustitucion de placeholders, escapado HTML y colapso de whitespace
- [x] 6.4 `doSend`: construir el arbol MIME a mano. `MimeMessageHelper` no puede: cada `setText` sobrescribe la parte principal, asi que el segundo `setText` descarta el texto plano en silencio (verificado en spring-context-support 6.2.19: el arbol resultante solo tenia `text/html`)
- [x] 6.5 `MimeMessageHelper` conservado solo para `To`/`Subject` (validacion de direccion y codificacion RFC 2047 del asunto con acentos)
- [x] 6.6 Logo incrustado con `Content-ID: <utez-logo>` explicito y `Disposition: INLINE`
- [x] 6.7 `sendPaymentConfirmation`: `LocalDate deadline` (parametro muerto) -> `Instant paidAt`; se elimino `LocalDate.now()` del cuerpo
- [x] 6.8 `CandidateController`: pasar `result.paidAt()` en lugar de `ficha.deadline()`
- [x] 6.9 Fallback `minimalTextBody` cuando la plantilla de texto no esta en el classpath
- [x] 6.10 `CandidateFichaMailServiceTest`: 15 tests que recorren el arbol MIME real (`saveChanges()` a mano, porque el `send` mockeado no lo hace)
- [x] 6.11 `.\mvnw.cmd -o test`: 967 tests, 0 fallos (antes 954)
- [x] 6.12 `npm run typecheck` y `npm run build` limpios
- [x] 6.13 Preview renderizado con datos reales de la API, abierto en navegador para revision visual del diseno
- [ ] 6.14 Revision visual del correo en un cliente real (Gmail/Outlook) — el modelo no puede ver imagenes

## Fase 3.5 — Jerarquia del estado PENDIENTE

El usuario reporto que la ficha sin pagar no prioriza el folio: en `/portal/registro/ficha?id=a342d72a-72c2-4929-af95-b4f25a0fecee` (folio `ADM-2026-000003`) el folio era un `ReadField` mas entre seis, mientras la confirmacion lo pone en 24px. El mismo defecto estaba en el pendiente de `/portal/ficha/pago`. La jerarquia se habia arreglado solo del lado pagado, que es la mitad que se ve despues de hecho el pago.

- [x] 7.1 `FolioMontoClave.tsx`: bloque compartido de folio y monto, con tercer slot opcional para la fecha limite. Existe para que el folio no vuelva a divergir entre los dos estados
- [x] 7.2 `FichaPagoPendiente.tsx`: estado pendiente compartido. Banda ambar (no verde institucional, que significa "pagado"), folio + monto + fecha limite, datos de apoyo al fondo, y la accion de pago DENTRO de la tarjeta
- [x] 7.3 `FichaPagoConfirmado.tsx`: consumir `FolioMontoClave` para que ambos estados compartan literalmente el mismo bloque
- [x] 7.4 `FichaConfirmacion.tsx`: eliminar encabezado + tarjeta de datos + `paymentSection` + `actionsRow` del pendiente; el boton de pago pasa a primario y la descarga del PDF a secundaria debajo
- [x] 7.5 `PortalFichaPago.tsx`: eliminar las tarjetas "Datos del candidato" y la ficha con el monto; usar el pendiente compartido, conservando el aviso degradado 3DS y sin exponer correo
- [x] 7.6 La fecha limite se muestra sin afirmar expiracion: el backend la guarda y proyecta, ningun caso de uso la compara contra el reloj
- [x] 7.7 `npm run typecheck` y `npm run build` limpios
- [ ] 7.8 Revision visual de los dos pendientes en navegador (el modelo no puede ver imagenes)

## Deferred (Fases 4-5 del plan)

- [x] Fase 2: logo `utez-logo.png` en el backend, usado por correo y PDF
- [x] Fase 3: correo con plantilla estatica (HTML + texto)
- [ ] Fase 4: PDF de 3 paginas rediseñado, sin QR
- [ ] Fase 5: `order.id` con fragmento de UUID (max 40) + auto-curacion cuando EVO responde SUCCESS y la BD sigue PENDING
- [ ] Corregir la corrupcion de encoding preexistente en `CambiarProgramaModal.tsx` y en los archives de OpenSpec
