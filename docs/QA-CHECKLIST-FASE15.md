# KOSMO CRM — Checklist de QA manual (Fase 15)

**Fecha:** 2026-09-26 · **Alcance:** auditoría manual + checklist de regresión antes de cada despliegue a producción.

Este checklist no reemplaza pruebas automatizadas (no hay suite de tests en el proyecto todavía) — es la guía de verificación manual mínima antes de cada release, agrupada por módulo. Márcalo cada vez que se despliegue un cambio significativo.

---

## 1. Autenticación y sesiones

- [ ] Login con credenciales correctas redirige al Dashboard.
- [ ] Login con contraseña incorrecta muestra error sin revelar si el correo existe.
- [ ] Cambio de contraseña (`/change-password`) funciona y la sesión sigue válida después.
- [ ] Cerrar sesión invalida la sesión en base de datos (no solo borra la cookie) — verificar que un token viejo copiado no siga funcionando.
- [ ] Una cuenta desactivada no puede iniciar sesión.

## 2. Roles y permisos (RBAC)

- [ ] Un usuario **Agent** no puede ver leads/clientes/ventas de otros agentes (salvo permiso `view_all`).
- [ ] Un usuario **Viewer** no puede editar ni eliminar nada, solo ver.
- [ ] Solo un **Super Admin** existente puede crear/asignar el rol Super Admin a otro usuario (fix de Fase 15 — verificar que un Admin normal ya NO puede auto-promoverse ni promover a otros a Super Admin).
- [ ] No se puede degradar o desactivar al **último Super Admin** del sistema (fix de Fase 15 — probar intentarlo y confirmar que se bloquea con mensaje claro).
- [ ] Los datos sensibles (SSN, cuentas bancarias) se muestran enmascarados a usuarios sin el permiso `sensitive_data.view`.

## 3. Leads y conversión a Cliente

- [ ] Crear un lead nuevo, moverlo por las etapas del pipeline y verificar que cada cambio queda en `PipelineHistory`.
- [ ] Convertir un lead a cliente una sola vez funciona correctamente (se crea el `Client`, `Lead.convertedClientId` se actualiza).
- [ ] **Doble-clic / doble-submit en "Convertir a cliente"**: hacer clic dos veces rápido (o abrir el lead en dos pestañas y convertir en ambas casi simultáneamente) — debe crear **un solo** cliente, nunca dos (fix de Fase 15, condición de carrera).
- [ ] Actividades, notas, documentos y tareas del lead original siguen visibles desde el detalle del cliente convertido.

## 4. Ventas y Pólizas

- [ ] Mover una venta por su pipeline (Kanban y vista de tabla) actualiza correctamente la etapa.
- [ ] **Mover la misma venta de etapa desde dos pestañas casi al mismo tiempo**: no debe romperse ni duplicar registros — debe manejarse sin error 500 visible al usuario (fix de Fase 15, catch de conflicto de escritura concurrente).
- [ ] Al llegar una venta a una etapa marcada como "ganada" (`isWon`), se genera automáticamente la `Policy` correspondiente.
- [ ] Al crearse la póliza, se genera la `Commission` con la tarifa vigente correcta.
- [ ] Cambiar el estado de una póliza a un valor **inválido** (probar manipulando el request si es posible, o confirmar que el selector de UI solo ofrece estados válidos) es rechazado por el servidor, no solo por la UI (fix de Fase 15 — validación server-side de estados en Pólizas, Tareas, Calendario y Comisiones).

## 5. Reportes diarios / Actividades

- [ ] Un reporte diario pendiente puede aprobarse o rechazarse una sola vez.
- [ ] **Aprobar y rechazar el mismo reporte casi simultáneamente** (dos pestañas, dos usuarios con permiso): solo el primero debe tener efecto; el segundo debe fallar de forma controlada, no sobrescribir el resultado del primero (fix de Fase 15).

## 6. Reconocimientos (Recognition)

- [ ] Enviar un reconocimiento a otro usuario funciona y genera notificación.
- [ ] **Un usuario ya no puede enviarse un reconocimiento a sí mismo** — probar seleccionarse como destinatario y confirmar que se bloquea con mensaje claro (fix de Fase 15).

## 7. Tareas, Calendario, Comisiones

- [ ] Cambiar el estado de una tarea a "Completada" genera correctamente el evento del sistema en el Feed (ver sección 9).
- [ ] Los selectores de estado en Tareas, Calendario y Comisiones no permiten enviar valores fuera del enum esperado (validación agregada en Fase 15).

## 8. Notificaciones

- [ ] Las notificaciones se generan para: tareas próximas a vencer, citas próximas, documentación pendiente, clientes por cumplir 65 años ("Turning 65").
- [ ] No se generan notificaciones **duplicadas** para el mismo evento en corridas sucesivas del programador (verificar tras dos ejecuciones seguidas del scheduler que no aparezcan notificaciones repetidas).
- [ ] El listado de notificaciones de un usuario con muchos meses de historial carga con buena velocidad (índices agregados en Fase 15 sobre `Notification`).

## 9. Feed de Actividades

- [ ] Publicar un post con texto, menciones (@usuario y @Todos), adjuntos y selector de audiencia (Todos / Mi equipo / Usuarios específicos) funciona y respeta la audiencia elegida (un usuario fuera de la audiencia no debe ver el post).
- [ ] Reaccionar (👍❤️🎉👏), comentar y responder a un comentario (un nivel de respuestas) funciona.
- [ ] Fijar/desfijar un post respeta el permiso `feed:moderate`.
- [ ] Los eventos automáticos del sistema (Nuevo cliente, Venta completada, Tarea finalizada, Usuario se unió) aparecen en el Feed sin intervención manual.
- [ ] Completar una tarea genera **un solo** post de "Tarea finalizada" en el Feed, no duplicados, incluso si el estado se actualiza más de una vez seguida.
- [ ] Las actualizaciones en tiempo real (nuevo post, nuevo comentario, nueva reacción) llegan a otras pestañas abiertas sin necesidad de recargar, y sin perder el filtro/orden/scroll que el usuario tenía.
- [ ] El acceso a `/feed` respeta permisos igual que el resto del CRM (un usuario sin acceso no debería ver contenido fuera de su audiencia).
- [ ] Ningún otro módulo (Clientes, Ventas, Tareas, Calendario, Documentos, Usuarios, Notificaciones) cambió de comportamiento visual o funcional tras la integración del Feed.

## 10. General / regresión rápida antes de cada deploy

- [ ] `npx tsc --noEmit` sin errores.
- [ ] La app arranca en local sin errores de consola en las páginas principales: Dashboard, Leads, Clientes, Ventas, Pólizas, Tareas, Calendario, Comisiones, Reportes, Configuración, Feed, Mensajería.
- [ ] Navegar a una URL inexistente muestra la página 404 con el estilo de KOSMO, no la pantalla genérica de Next.js (agregado en Fase 15).
- [ ] Forzar un error en una página (temporalmente) muestra la pantalla de error con estilo de KOSMO y el botón "Reintentar" funciona (agregado en Fase 15).
- [ ] Probar en una ventana angosta (móvil) que el Sidebar, el Dashboard y el Feed siguen siendo usables.
