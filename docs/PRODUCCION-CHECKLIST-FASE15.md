# KOSMO CRM — Checklist de preparación para producción (Fase 15)

**Fecha:** 2026-09-26 · **Alcance:** auditoría de variables de entorno/config + endurecimiento de despliegue.

## 1. Acción pendiente inmediata — migración de base de datos

La Fase 15 agregó dos índices nuevos al modelo `Notification` en `prisma/schema.prisma` (mejora de rendimiento para el listado de notificaciones por usuario). **Todavía no existe una migración para este cambio.** Antes de desplegar, en tu máquina local:

```bash
npx prisma migrate dev --name add_notification_indexes
```

Esto es exactamente el mismo flujo ya usado para las fases anteriores (el entorno donde corre Claude no tiene salida de red hacia los binarios de Prisma, así que este paso siempre lo corres tú). El `start` script de producción (`prisma migrate deploy && next start`) aplicará esta migración automáticamente en Railway al desplegar, una vez que exista el archivo de migración en el repo.

## 2. Variables de entorno

Variables ya documentadas en `.env.example` (sin cambios): `DATABASE_URL`, `INTERNAL_EMAIL_DOMAIN`, `SENSITIVE_DATA_ENCRYPTION_KEY`.

Nuevas variables opcionales agregadas en Fase 15 (identidad de la cuenta Super Admin creada por `npm run db:seed`):

| Variable | Obligatoria | Si no se define |
|---|---|---|
| `SUPER_ADMIN_EMAIL` | No | Usa el valor por defecto ya existente en el código |
| `SUPER_ADMIN_FIRST_NAME` | No | Usa el valor por defecto ya existente en el código |
| `SUPER_ADMIN_LAST_NAME` | No | Usa el valor por defecto ya existente en el código |

No es necesario configurar nada nuevo en Railway para que todo siga funcionando igual — esto solo importa si en el futuro se reutiliza este código para otra instalación/agencia con un Super Admin distinto.

- [ ] Confirmar en el dashboard de Railway que `DATABASE_URL`, `INTERNAL_EMAIL_DOMAIN` y `SENSITIVE_DATA_ENCRYPTION_KEY` están configuradas (no solo en `.env.example` local).
- [ ] Confirmar que `SENSITIVE_DATA_ENCRYPTION_KEY` en producción es **distinta** a cualquier valor usado en desarrollo/pruebas, y que está respaldada de forma segura fuera del repo (ver sección 5, rotación de claves).

## 3. Build y arranque

- [ ] `package.json` ahora declara `"engines": { "node": ">=22.0.0" }` — verificar que el builder de Railway use Node 22+ (revisar en el dashboard de Railway, sección de configuración del servicio, o agregar un archivo `.nvmrc`/`nixpacks.toml` si Railway no lo detecta automáticamente).
- [ ] El script `build` ahora corre `prisma generate && next build` explícitamente (antes dependía solo de `postinstall`) — esto hace el build más robusto ante builders que cachean `node_modules` sin volver a ejecutar `postinstall`.
- [ ] Confirmar que el comando de **start** en Railway es el del `package.json` (`prisma migrate deploy && next start -p ${PORT:-3000}`) y no uno sobreescrito manualmente en la configuración de Railway que se haya quedado desactualizado.

## 4. Cabeceras de seguridad HTTP

Se agregaron en `next.config.ts` (aplican a todas las rutas):

- `X-Frame-Options: DENY` — evita que el CRM se cargue dentro de un `<iframe>` de otro sitio (protección contra clickjacking).
- `X-Content-Type-Options: nosniff` — evita que el navegador intente adivinar tipos de contenido.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — el CRM no usa cámara/micrófono/ubicación, así que se desactivan explícitamente.

**Deliberadamente NO se agregó `Content-Security-Policy` (CSP) en esta fase.** Una CSP mal calibrada puede romper silenciosamente scripts, estilos inline o el `EventSource` del Feed/Mensajería en producción sin que aparezca como error de build — requiere probarse cuidadosamente ruta por ruta. Queda como tarea recomendada para una fase de endurecimiento dedicada, no como parte de este cambio.

- [ ] Verificar en producción (herramientas de desarrollador del navegador → pestaña Network → headers de la respuesta) que las cuatro cabeceras anteriores llegan correctamente tras el deploy.

## 5. Datos sensibles y rotación de claves (runbook, no código)

No se implementó rotación automática de `SENSITIVE_DATA_ENCRYPTION_KEY` en esta fase — es un cambio de infraestructura de mayor riesgo que requiere una ventana de mantenimiento planificada. Runbook manual recomendado para cuando llegue el momento de rotar la clave:

1. Generar la nueva clave (mismo formato/longitud que exige `src/lib/sensitiveData.ts`).
2. Escribir un script one-off (no incluido en el repo) que: lea cada `SensitiveField.encryptedValue` con la clave actual, lo re-encripte con la clave nueva, y lo guarde — todo dentro de una transacción por lote.
3. Desplegar el script en una ventana de mantenimiento, con la app en modo solo-lectura o detenida, para evitar que se escriban valores nuevos con la clave vieja mientras el script corre.
4. Actualizar `SENSITIVE_DATA_ENCRYPTION_KEY` en Railway y reiniciar el servicio.
5. Verificar (con una cuenta de prueba con permiso `sensitive_data.view`) que los valores sensibles siguen leyéndose correctamente antes de dar por cerrada la rotación.
6. Conservar la clave vieja en un lugar seguro por un periodo prudente por si hay que revertir, y luego destruirla.

## 6. Manejo de errores

Se agregaron (nuevos, no modifican ningún módulo existente):

- `src/app/not-found.tsx` — página 404 con el estilo visual de KOSMO.
- `src/app/error.tsx` — error boundary para rutas normales, con botón "Reintentar".
- `src/app/global-error.tsx` — error boundary para fallos en el layout raíz (caso extremo, cubre lo que `error.tsx` no puede).

- [ ] Confirmar en producción que una URL inexistente y un error forzado muestran estas páginas y no la pantalla genérica de Next.js.

## 7. Endurecimiento de datos hardcodeados

`prisma/seed.ts` tenía el correo y nombre completo reales de la cuenta Super Admin escritos directamente en el código versionado. Se movieron a variables de entorno opcionales (`SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_FIRST_NAME`/`SUPER_ADMIN_LAST_NAME`, ver sección 2) manteniendo el mismo valor como default — ningún comportamiento cambia salvo que se decida sobreescribirlas explícitamente.

## 8. Riesgo aceptado, sin cambio de código

`recordTaskCompletedFeedEvent()` (Feed) puede, en un escenario muy poco probable de dos actualizaciones de estado casi simultáneas sobre la misma tarea, generar un post duplicado de "Tarea finalizada" en el Feed. Se evaluó agregar una restricción única a nivel de base de datos para prevenirlo, pero el cambio de esquema necesario introducía más complejidad y riesgo de romper el flujo de auditoría del que vale la pena para un evento cosmético (un post de Feed duplicado, no una pérdida de datos ni un problema de seguridad). Queda documentado como riesgo aceptado — revisar si en el futuro se reciben reportes reales de posts duplicados.
