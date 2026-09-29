# KOSMO — CRM de Alliance Insurance

CRM interno construido a medida para **Alliance Insurance**, agencia de
seguros de salud (Medicare Advantage, Obamacare/ACA y Family Heritage).
Cubre todo el ciclo de negocio de la agencia: captación y seguimiento de
leads, conversión a clientes, pólizas, comisiones, tareas/calendario,
documentos, reportes, y comunicación interna del equipo (correo interno y
mensajería tipo chat) — todo bajo un sistema de roles y permisos
configurable, sin nada hardcodeado por rol en el código.

**Estado:** en producción. Se completaron las 15 fases del roadmap original
(arquitectura → auth/roles → leads → clientes → pólizas → comisiones →
tareas/calendario → documentos → reportes → configuración →
notificaciones/automatizaciones → auditoría → testing/optimización), más
módulos agregados fuera de ese roadmap (Feed de actividades estilo
Bitrix24, Correo interno, Mensajería en tiempo real). Desplegado en Railway
sobre una base de datos Postgres administrada (Neon).

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript, React 19 |
| Estilos | Tailwind CSS v4 (tokens de color por CSS variables, tema claro/oscuro) |
| Datos | Prisma 5 + PostgreSQL (Neon) — 60 modelos en `prisma/schema.prisma` |
| Autenticación | Sesiones propias en base de datos (tabla `Session`), sin NextAuth — revocables al instante desde Configuración → Usuarios |
| Tiempo real | Server-Sent Events (`/api/messenger/stream`, `/api/notifications/stream`) — sin WebSockets ni servicios externos |
| Gráficos | Recharts |
| Íconos | Lucide |
| Hosting | Railway (Node ≥22) |
| Base de datos | Neon (Postgres serverless) |

## Módulos

- **Dashboard** — métricas y alertas del día (tareas vencidas, citas próximas, clientes por cumplir 65 años).
- **Leads** — pipeline configurable (Kanban + tabla), conversión a Cliente sin perder historial.
- **Clientes** — datos de contacto, perfiles por línea de negocio (Medicare, Obamacare, Family Heritage), datos sensibles cifrados (SSN, cuentas bancarias) con log de acceso propio.
- **Ventas (Sales)** — pipeline independiente del de Leads; al cerrar una venta se genera automáticamente la Póliza y su Comisión.
- **Pólizas** — una o varias por cliente, con estado, carrier, línea de negocio y documentos asociados.
- **Comisiones** — tarifas configurables por línea/agente con vigencia histórica, cálculo automático, estados de pago (pendiente/pagada/chargeback).
- **Actividades / Tareas / Calendario** — seguimiento operativo del día a día de cada agente.
- **Documentos** — repositorio de archivos por cliente/póliza.
- **Reportes** — reportes diarios de actividad (con flujo de aprobación) y reportes agregados.
- **Feed** — muro de actividad estilo Bitrix24 (reconocimientos entre compañeros, hitos, eventos del sistema).
- **Correo interno** — mensajería asíncrona privada entre usuarios (`usuario@dominio-interno`), nunca sale a internet.
- **Mensajería** — chat interno en tiempo real: menciones, edición/eliminación, mensaje fijado, reacciones (una por persona, estilo WhatsApp/Messenger), selector de emojis con apariencia Apple/iOS consistente en todo el chat, stickers ilustrados propios, panel de contacto deslizable (estilo WhatsApp Web) con búsqueda dentro de la conversación, archivos compartidos y silenciado por conversación.
- **Configuración** — roles y permisos, visibilidad de módulos por rol, catálogos (orígenes, líneas de negocio, carriers), pipelines, campos personalizados, tarifas de comisión, usuarios, auditoría — todo editable desde la UI, sin tocar código.

## Arquitectura

```
Presentación (src/app, src/components)
        │
API / Server Actions (src/app/**/actions.ts)
        │
Acceso a datos (Prisma Client, src/lib/db.ts)
        │
Base de datos (PostgreSQL / Neon)
```

Regla de diseño: los componentes de UI nunca hacen queries directas ni
contienen lógica de negocio — llaman a una Server Action, que valida,
autoriza (RBAC) y habla con Prisma. Todo cambio relevante (creación,
edición, cambio de etapa, acceso a datos sensibles) queda en `AuditLog` o en
`SensitiveDataAccessLog`.

Ver [`docs/arquitectura-fase1.md`](docs/arquitectura-fase1.md) para el
detalle completo de las decisiones de arquitectura y el modelo relacional.

## Seguridad

- RBAC real: `User → Role → RolePermission → Permission`, verificado en el
  servidor en cada acción — nunca solo ocultando un botón en la UI.
- Datos sensibles (SSN, cuentas bancarias) cifrados en la base de datos
  (AES-256-GCM) — la API nunca devuelve el valor real sin el permiso
  correspondiente, y cada acceso queda registrado.
- Sesiones en base de datos, revocables desde Configuración → Usuarios.
- Cabeceras de seguridad HTTP configuradas en `next.config.ts`.

## Cómo correr el proyecto en local

```bash
npm install
```

Crear `.env.local` con las variables descritas en `.env.example`:

- `DATABASE_URL` — connection string pooled de Neon (o cualquier Postgres).
- `DIRECT_URL` — connection string **directa** (sin pooler) al mismo Postgres, necesaria solo para correr migraciones (`prisma migrate`); Neon/PgBouncer no soporta el advisory lock que usa Prisma para migrar sobre la conexión pooled.
- `SENSITIVE_DATA_ENCRYPTION_KEY` — clave AES-256 de 32 bytes en hex, generable con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `INTERNAL_EMAIL_DOMAIN` — dominio (inventado, nunca sale a internet) para las direcciones del Correo interno.
- `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_FIRST_NAME` / `SUPER_ADMIN_LAST_NAME` — opcional, identidad del Super Admin que crea el seed inicial.

```bash
npx prisma migrate dev   # aplica el schema a tu base y regenera el cliente
npm run db:seed          # datos iniciales (roles, Super Admin, catálogos base)
npm run dev
```

Abrir `http://localhost:3000` — redirige a `/login`.

## Despliegue

Desplegado en Railway. `npm run build` corre `prisma generate && next build`;
`npm start` corre `prisma migrate deploy && next start`, así que cualquier
migración nueva committeada en `prisma/migrations/` se aplica sola en cada
deploy — no hace falta correrla manualmente en producción.

## Documentación relacionada

- [`docs/arquitectura-fase1.md`](docs/arquitectura-fase1.md) — arquitectura completa y modelo de datos (documento original de diseño).
- [`docs/QA-CHECKLIST-FASE15.md`](docs/QA-CHECKLIST-FASE15.md) — checklist de regresión manual por módulo, para usar antes de cada release.
- [`docs/PRODUCCION-CHECKLIST-FASE15.md`](docs/PRODUCCION-CHECKLIST-FASE15.md) — checklist de despliegue, variables de entorno y runbook de rotación de claves.

## Notas para quien siga desarrollando

- Las migraciones de Prisma y el `git push` a `origin/main` se corren desde
  una terminal con acceso real a la base de datos y a GitHub — no desde un
  entorno de automatización sin esas credenciales.
- `prisma/schema.prisma` es el contrato de datos autoritativo: cualquier
  cambio de modelo pasa primero por ahí, después por una migración.
