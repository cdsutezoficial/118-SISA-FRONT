Vas a diseñar el Sistema Integral de Servicios Académicos (SISA) de la Universidad Tecnológica Emiliano Zapata del Estado de Morelos (UTEZ). Es un sistema institucional académico que administra el ciclo de vida completo del estudiante: desde candidato hasta egresado.

Antes de generar cualquier pantalla, incorpora y respeta estrictamente el siguiente Design System. Confirma que lo entendiste antes de continuar.

---

TIPOGRAFÍA
Familia única: Inter
Jerarquía construida únicamente con tamaño y peso. Sin otras familias tipográficas.

---

PALETA DE COLORES
- Primario institucional: #009574
  Usar SOLO para: botones primarios, estados activos, indicadores, enlaces, elementos destacados
- Texto principal: #333333
- Fondo principal: #FFFFFF
- Fondo secundario: #F8F9FA
- Bordes: #E5E7EB
- Texto secundario: #6B7280
- Éxito: verde | Advertencia: amarillo | Error: rojo | Información: azul
  Usar colores de estado SOLO para comunicar estados. No decoración.

---

ESPACIADO
Escala estricta: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px
No usar medidas fuera de esta escala.

---

GRID
12 columnas responsivas. Sin espacios vacíos por mala distribución.

---

ESTRUCTURA BASE (obligatoria en TODAS las pantallas)
1. Navbar superior fijo: nombre del sistema a la izquierda | cambio de rol + manual + cerrar sesión a la derecha
2. Sidebar lateral colapsable:
   - Expandido: imagen institucional + nombre del usuario + rol activo + icono y nombre de cada opción de menú
   - Contraído: solo iconos con tooltip al pasar el cursor
   - Opción activa resaltada con color primario (#009574)
3. Breadcrumb (siempre antes del título principal)
4. Título de la pantalla
5. Descripción breve de la funcionalidad
6. Contenido principal
7. Zona de acciones al final (cuando aplique)

---

REGLAS ABSOLUTAS — nunca violar
- Sin paneles dentro de paneles
- Sin Tabs para operaciones CRUD
- Sin buscadores por columna en tablas
- Sin botones de color para iconos de acción (área clicable invisible + tooltip)
- Sin modales para registrar, editar o capturar información
- Un solo botón primario por pantalla, alineado a la derecha
- Botón secundario (Cancelar / Regresar) siempre a la izquierda del primario
- Separar contenido con espaciado, títulos y separadores discretos. Sin barras grises ni contenedores anidados.

---

TABLAS
Toda tabla incluye:
- Columna # con numeración continua entre páginas
- Columnas de datos relevantes
- Columna Estado con Badge (cuando aplique)
- Columna Acciones (concentra todas las operaciones: ver, editar, cambiar estado, etc.)
Encima de toda tabla: buscador general único + filtros cuando aplique.

---

FORMULARIOS
Cada campo: etiqueta + placeholder + ayuda opcional + mensaje de error
Estados: normal / hover / focus (color primario) / error / solo lectura / deshabilitado
El mismo formulario se reutiliza para: Registrar (vacío) | Ver detalle (lleno + disabled) | Modificar (lleno + habilitado)

---

COMPONENTES CLAVE
- Select: siempre con buscador interno, limpiar selección, placeholder
- Date Picker: calendario desplegable, formato dd/MM/yyyy
- Upload: drag & drop + botón + nombre + tamaño + preview (imagen) o icono (documento)
- Stepper: para procesos multi-paso; nunca usar Tabs para representar pasos
- Badge: estados con colores suaves (Activo, Inactivo, Pendiente, Completado, etc.)
- Empty State: ilustración sencilla + mensaje descriptivo + acción sugerida
- Loader: Spinner o Skeleton durante toda carga; nunca mostrar "Sin registros" mientras carga
- Toast: notificación temporal en esquina superior derecha para operaciones exitosas
- Modal: SOLO para confirmaciones, advertencias, alertas, éxito y error

---

FLUJO CRUD ESTÁNDAR
Consulta (tabla principal)
  → [Registrar] → pantalla independiente → Toast éxito → regresa a Consulta
  → [Ver detalle] → mismo formulario con campos disabled → [Regresar]
  → [Editar] → mismo formulario con campos habilitados → Toast éxito → regresa a Consulta
  → [Cambiar estado / Eliminar] → Modal de confirmación → Toast éxito → actualiza tabla

---

FLUJO WIZARD (procesos multi-paso)
Stepper visible en todo momento mostrando: completados / actual / pendientes
Zona de acciones: [Anterior] [Siguiente] | último paso: [Cancelar] [Finalizar]
No usar Tabs para representar pasos del proceso.

---

PATRONES DE PANTALLA DISPONIBLES
1. Dashboard — KPIs, gráficas, accesos rápidos, actividad reciente
2. Consulta / Listado — tabla con buscador + filtros + paginación
3. Registro — formulario en pantalla independiente
4. Detalle — mismo formulario, campos disabled
5. Modificación — mismo formulario, campos habilitados con datos precargados
6. Wizard — proceso paso a paso con Stepper
7. Perfil — tarjeta de usuario + formulario
8. Gestión de Archivos — upload + listado de documentos
9. Reportes — filtros + tabla/gráfica + exportar

Confirma que entendiste el Design System y estás listo para recibir los prompts de cada pantalla.