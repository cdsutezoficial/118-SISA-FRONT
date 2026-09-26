# Proposal: La confirmacion de pago de ficha pasa a ser la pantalla

## Intent

La confirmacion de pago es el momento en que el Aspirante debe entender que su
registro quedo completo y conservar su folio. Hoy no lo es: la pantalla depende
de como se llego al pago.

Al terminar el registro (`/portal/registro/ficha`) la confirmacion era un bloque
verde pequeno debajo de la ficha, con el PDF escondido en una fila de acciones al
final de la pagina. Al volver por el comprobante (`/portal/ficha/pago`) era otra
cosa: un bloque verde distinto, mas grande, con el PDF al frente. Dos versiones
del mismo instante, escritas por separado, que ya divergieron.

Este change convierte la confirmacion en la pantalla —sin importar el punto de
entrada— y delega su contenido a un solo componente compartido.

## Root cause

No fue un error de maquetado, fue duplicacion sin frontera. `PortalFichaPago.tsx`
nacio copiando el bloque de `FichaConfirmacion.tsx` y luego lo mejoro por su
cuenta (mas grande, badge `Pagado`, PDF arriba). El primer archivo nunca fue
actualizado. El resultado es que la version que se ve **un segundo despues de
pagar** — la que importa — era la mas debil de las dos.

Detalle: el badge `Pagado` en la version de consulta existia para compensar que
la banda verde sola no comunicaba el estado. Con la banda a ancho completo y el
check de 34px, el badge es redundante, y el spec lo exigia. Se quita y el spec se
actualiza en este change.

## Scope

### In Scope
- `FichaPagoConfirmado.tsx` (nuevo): componente compartido con la confirmacion.
- `FichaConfirmacion.tsx`: el estado `PAID` renderiza el componente y **nada
  mas** — sin ficha, sin bloque verde, sin fila de acciones.
- `PortalFichaPago.tsx`: el estado `PAID` renderiza el mismo componente.
- Delta de `admision-screens` que reemplaza el requisito de `/portal/ficha/pago`
  (se elimina el badge `Pagado`) y agrega el componente compartido.
- Fase 3 del plan, absorvida por este change: el correo de confirmacion pasa de
  texto plano con `String.format` a plantillas `multipart/alternative` con el logo
  incrustado por CID, y ambas pantallas avisan que el correo fue enviado.
- Backend: `CandidateFichaMailService` (plantillas, escapado, arbol MIME),
  `CandidateController` (pasa `paidAt` real en vez de `deadline`),
  `CandidateFichaMailServiceTest`, y los recursos
  `templates/ficha-pago-confirmacion.{html,txt}`.

### Out of Scope
- El PDF (Fase 4 del plan). Aqui se toca la pantalla y el correo.
- El boton o endpoint de **reenvio** de correo desde `/portal/ficha/pago`. La vista
  solo informa que el correo se envio. Reenviar exigiria endpoint propio,
  autorizacion y rate limiting, y nadie lo pidio explicitamente.
- El PDF y el resto del backend de admision que no sea el correo.
- La vista pendiente (antes de pagar) de ambas pantallas: no se toca.
- Corregir la corrupcion de encoding preexistente en `CambiarProgramaModal.tsx` y
  en los archives de OpenSpec (`pǧblicas`, `Ǹxito`, `MUST NOT` partido). Es
  preexistente y ajena a este change.

## Capabilities

### New Capabilities
- Ninguna.

### Modified Capabilities
- `admision-screens`: la confirmacion de pago pasa a ser un componente compartido
  por los dos puntos de entrada, se elimina el badge `Pagado`, el aviso de correo
  se renderiza en ambas vistas con direccion opcional, y se agrega el requisito
  del correo de confirmacion (multipart, CID, fecha de pasarela, escapado,
  fallback).

## Key Decisions

1. **Un componente, no dos parecidas.** La divergencia no se arreglo copiando la
   version buena a mano; se elimino la causa duplicando el JSX en un solo archivo.
   Las dos pantallas solo pasan datos.
2. **Pagado = SOLO la confirmacion.** En `FichaConfirmacion` la ficha completa, el
   encabezado y la fila de acciones desaparecen cuando `estado === 'PAID'`. Si se
   dejaran, la confirmacion seria "la primera de varias cosas" en vez de *la*
   pantalla. El detalle completo sigue en el PDF, que es para eso.
   En `PortalFichaPago` se aplica la misma regla por simetria, lo que ademas
   corrige la etiqueta "Monto a pagar" que sobrevivia al pago.
3. **Verde institucional, no `emerald`.** El encabezado de las pantallas publicas ya
   es `#009574`; usar un segundo verde para "exito" hacia que el estado de pago se
   leyera como una tarjeta mas en vez de como el cierre del proceso.
4. **Folio y monto en grande, no como un campo mas.** Son los dos datos que el
   Aspirante conserva; el resto va en la fila de comprobante.
5. **El boton de PDF vive dentro del bloque de exito.** Es la accion que de verdad
   se necesita, y en `FichaConfirmacion` estaba al final de la pagina.
6. **"Que sigue" solo afirma lo que el sistema ya hace.** Correo enviado,
   conservar folio, presentar el comprobante en induccion. No se inventan pasos del
   proceso que no existen.
7. **El aviso de correo va en las dos vistas; la direccion, solo en una.** La
   recuperacion por folio + 3 de la CURP es identidad debil, asi que
   `payment-access` no expone el correo y no se agrega: eso seria entregar un dato
   de contacto a quien solo sabe folio y tres letras. Pero *no decir nada* es peor
   que decirlo sin direccion — el Aspirante que pago y no ve ningun aviso no sabe
   si el correo salio. El componente recibe `email={{ direccion? }}`: el aviso se
   renderiza siempre, la direccion solo cuando la vista ya es dueña de ella
   (post-registro).
8. **El correo se arma a mano, no con `MimeMessageHelper`.** Se documento como
   hallazgo, porque no falla de forma visible: `MimeMessageHelper` tiene una sola
   "parte principal" y cada `setText` la sobrescribe, de modo que el segundo
   `setText(html, true)` **descarta el texto plano en silencio** en vez de crear un
   `alternative` (verificado contra spring-context-support 6.2.19: el arbol
   resultante contenia unicamente `text/html`). Con `addInline` en medio peor
   todavia. Un correo de confirmacion sin alternativa de texto plano es
   precisamente lo que cae en spam, asi que el arbol se construye explicito:
   `related( alternative( plain, html ), logo )`. `MimeMessageHelper` se conserva
   solo para `To`/`Subject`.
9. **La fecha de pago viene de la pasarela, no del reloj.** El servicio pasaba
   `ficha.deadline()`, un parametro que el cuerpo nunca uso, y el cuerpo usaba
   `LocalDate.now()`. Una reconfirmacion o un envio encolado estamparian "hoy"
   sobre un comprobante de ayer. Ahora recibe `result.paidAt()`. Un dato ausente
   sale como guion, porque un comprobante sin fecha es honesto y uno con la fecha
   equivocada es un ticket de soporte.
10. **Escapado y colapso de espacio en blanco en las dos variantes.** El nombre es
    texto libre capturado en el registro. Sin escapar, un `<` reordena la tabla del
    comprobante; sin colapsar, un `\n` puede forjar una linea con apariencia de
    campo. El logo es markup nuestro y queda exento del escapado.
11. **Una plantilla ausente cuesta formato, no el comprobante.** Si falta la
    plantilla en el classpath se manda un cuerpo minimo en texto plano, y la cache
    de plantillas recuerda tambien el fallo (sentinel) para no reintentar el escaneo
    del classpath en cada Aspirante.
12. **Sin `List-Unsubscribe` y sin boton.** Es un correo transaccional; la cabecera
    lo señalaria como masivo y prejudica la entregabilidad. Y el boton de descarga
    no se pone porque el PDF vive dentro del portal, que es donde vive la sesion.
13. **El subtitulo distingue "lo acabo de confirmar" de "ya estaba pagado".** El
    segundo caso no trae `receiptNumber`; prometer un comprobante que la vista no
    tiene es peor que decirlo.
14. **El comprobante se lee de la BD, no solo del confirm en vivo.** Al cablear el
    componente compartido se conecto `recibo` y `fechaPago` unicamente a
    `confirmData`, que es `null` salvo tras un `POST /payments/confirm` de la sesion
    actual. Consecuencia real, no cosmetica: quien cerraba la pestana tras pagar y
    volvia a `/portal/registro/ficha?id=<uuid>` veía "—" en folio de comprobante y
    fecha, mientras `/portal/ficha/pago` si los mostraba para la MISMA ficha. El
    dato existia en los dos endpoints (`CandidateFichaResponse`,
    `FichaPaymentAccessResponse`); lo perdia la lente del frontend. Se agrega
    `recibo`/`fechaPago` a la lente y se leen del backend. `PortalFichaPago` ya
    tenia el fallback a `acceso` y por eso era la unica que funcionaba — la asimetria
    entre las dos pantallas era la senal.

## Risks

- **Se pierde informacion visible en la vista de pago.** Al ocultar la tarjeta
  "Datos del candidato" (nombre, carrera) en el estado pagado, esa info solo queda
  en el encabezado y en el PDF. El nombre ya esta en el header de
  `PortalFichaPago`; el post-registro no lo muestra. Riesgo bajo y aceptable: son
  datos que el Aspirante acaba de teclear, y el objetivo de la pantalla es el
  comprobante.
- **Doble banda verde.** En el mount publico queda el header `#009574` de la
  pagina y la banda de exito del mismo color. Se evalua en navegador; si se lee
  como un bloque unico, se atenua el header en el estado pagado.
- **`noUnusedLocals` es `true`.** Quitar el bloque verde dejo `CheckCircle2`,
  `Download` y `BadgePill` sin uso; si se olvidara alguno, el typecheck falla. Es
  la red de seguridad, no un riesgo.
- **El logo incrustado pesa ~84 KB en cada correo.** Es el costo de un correo que
  se ve presentable sin que el cliente-SAIDI tenga que permitir imagenes externas.
  Aceptable a este volumen; si creciera, la alternativa es un hosted image con
  tracking de apertura, que aqui se descarto a proposito.
- **La fecha se formatea en la zona del servidor, no en la del Aspirante.** Un
  pago hecho a las 23:30 en America/Mexico_City puede mostrar el dia siguiente si
  el servidor corre en UTC. El valor crudo (`paidAt`) viaja en la respuesta del
  confirm, asi que la correccion —formatear en el cliente con la zona del
  Aspirante— es posible si el caso se presenta.
- **`openspec validate --strict` no se pudo ejecutar** porque el CLI no esta
  instalado en ninguno de los dos repos. Los deltas se revisaron a mano contra el
  formato de los archives, pero no hay verificacion automatica.
