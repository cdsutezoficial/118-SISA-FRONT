## Qué cambia y por qué
<!-- 1–3 líneas. -->

**Historia / incidencia:** HU-XXX-NNN
**Plan:** `docs/plans/...` (si aplica)

## Archivos compartidos
<!-- Si marcas alguno, avisa en el chat del equipo antes de mergear. -->
- [ ] Ninguno
- [ ] `router.tsx` (ruta nueva: ¿lleva `RequirePermission`?)
- [ ] `core/components/*` (cambia algo que usan otras pantallas)
- [ ] `core/validation/*`
- [ ] `core/infra/apiClient.ts`
- [ ] `.env.example` (variable nueva: avisar a infraestructura)

## API
- [ ] Consume endpoints que ya existen en `develop` del backend
- [ ] Depende de un PR del backend sin mergear → enlace:

## Verificación
- [ ] `npm run typecheck` y `npm run build` en verde
- [ ] Probado a mano con el backend real (no mock):
- [ ] Capturas de pantalla (si cambia la UI)

## Cierre
- [ ] `CHANGELOG.md` actualizado
