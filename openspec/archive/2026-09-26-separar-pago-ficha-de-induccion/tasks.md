# Tasks: Separar el pago de ficha del acceso de inducción

## 1. Preservar el flujo real antes de restaurar

- [x] 1.1 Copiar `PortalInduccion.tsx` (contenido real de ficha) a `PortalFicha.tsx` sin transformaciones
- [x] 1.2 Copiar `PortalInduccionPago.tsx` (contenido real de ficha) a `PortalFichaPago.tsx`
- [x] 1.3 Confirmar que ambos archivos nuevos existen y los originales están intactos antes de restaurar
- [x] 1.4 `git checkout HEAD -- src/app/portal/PortalInduccion.tsx src/app/portal/PortalInduccionPago.tsx`
- [x] 1.5 Verificar que el par restaurado es coherente consigo mismo (mock matching, gate `induccionHabilitada`, tabs online/ventanilla)

## 2. Ajustar los componentes de ficha

- [x] 2.1 `PortalFicha.tsx`: renombrar el componente a `PortalFicha`
- [x] 2.2 `PortalFicha.tsx`: `navigate('/portal/induccion/pago')` → `navigate('/portal/ficha/pago')`
- [x] 2.3 `PortalFicha.tsx`: tarjeta LlaveMX con badge "Nuevo", sin navegación, con aviso inline de indisponibilidad
- [x] 2.4 `PortalFicha.tsx`: separador "o ingresa tus datos manualmente" entre los dos caminos
- [x] 2.5 `PortalFicha.tsx`: encabezado "Elige cómo acceder"
- [x] 2.6 `PortalFicha.tsx`: docblock que explique por qué LlaveMX no navega y por qué la asimetría con inducción es intencional
- [x] 2.7 `PortalFichaPago.tsx`: renombrar componente e interface de location state
- [x] 2.8 `PortalFichaPago.tsx`: `RETURN_PATH` → `/portal/ficha/pago`
- [x] 2.9 `PortalFichaPago.tsx`: los tres `navigate('/portal/induccion')` → `/portal/ficha` (replace, normal, botón secundario)
- [x] 2.10 `PortalFichaPago.tsx`: docblock que apunte al hermano de inducción y a las dos entradas (route state / 3DS)

## 3. Rutas y navegación

- [x] 3.1 `router.tsx`: registrar `ficha` y `ficha/pago` como rutas públicas bajo `AuthLayout`
- [x] 3.2 `router.tsx`: conservar `induccion` y `induccion/pago` montadas
- [x] 3.3 `router.tsx`: comentarios que expliquen que son dos pares sin relación
- [x] 3.4 `layoutRoles.ts`: `ROLE_DEFAULT_PATHS.CANDIDATO` → `/portal/ficha` (+ nota en el docblock)
- [x] 3.5 `RoleContext.tsx`: docblock del tier `CANDIDATO` menciona ambas rutas
- [x] 3.6 `useFichaPayment.ts`: el ejemplo de `returnPath` ya no apunta a inducción

## 4. Backend: allowlist de retorno EVO

- [x] 4.1 `application.properties`: allowlist → `/portal/registro/ficha,/portal/ficha/pago`
- [x] 4.2 `UseCaseConfig`: el default `@Value` de la allowlist coincide con properties
- [x] 4.3 `InitiateFichaPaymentUseCase` / `CheckoutInitiationRequest`: ejemplos de javadoc actualizados
- [x] 4.4 `InitiateFichaPaymentUseCaseImplTest`: paths de la allowlist y expectativas de `cancelUrl`/`returnUrl`
- [x] 4.5 `CandidateControllerTest`: `returnPath` del body de prueba
- [x] 4.6 Confirmar que no queda ninguna referencia a `/portal/induccion` en el backend

## 5. Verificación

- [ ] 5.1 `npm run typecheck` limpio
- [ ] 5.2 `npm run build` exitoso
- [ ] 5.3 `.\mvnw.cmd -o test` verde (suite completa)
- [ ] 5.4 `git diff` revisado: ningún archivo ajeno tocado, sin cambios accidentales de encoding
- [ ] 5.5 Grep de residuos: `/portal/induccion` solo queda en el par de inducción y en comentarios que los nombran explícitamente

## 6. Archive

- [ ] 6.1 `openspec validate --strict` (si el CLI está disponible en el repo)
- [ ] 6.2 Archive del change con su reporte
- [ ] 6.3 `openspec/specs/admision-screens.md` actualizado con el par `/portal/ficha*` vía el archive

## Deferred (Fase 2 — fuera de alcance)

- [ ] Backend del pago de inducción: caso de uso, `AdmissionPaymentRepository.findByCandidateId` (hoy singular, no soporta dos conceptos), seed de `payment_concepts.csv`, y el caso de uso que habilite `Candidate.isEnabledForInduction`
- [ ] Definir si el curso de inducción se paga con EVO o ventanilla
- [ ] OAuth real de LlaveMX (hoy placeholder en ambos flujos)
- [ ] Revisar el riesgo de `candidateId` reutilizable contra endpoints UUID
