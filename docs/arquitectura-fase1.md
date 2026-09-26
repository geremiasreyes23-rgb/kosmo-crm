# Alliance Insurance CRM — Arquitectura Fase 1

**Estado:** propuesta para aprobación · **Fecha:** 2026-09-13
**Alcance de esta fase:** arquitectura completa + UI Shell navegable con datos de demostración. Sin backend real, sin autenticación real, sin base de datos conectada — eso es Fase 2 en adelante.

---

## 1. Arquitectura del sistema

### 1.1 Stack propuesto

| Capa | Tecnología | Rol |
|---|---|---|
| Frontend + capa API | **Next.js 16 (App Router) + TypeScript** | UI, enrutamiento, y en fases futuras los endpoints API (route handlers) |
| Estilos | **Tailwind CSS v4** | Sistema de diseño utilitario, tokens de color por CSS variables |
| Componentes de datos | **Recharts** | Gráficos del dashboard y reportes |
| ORM / modelo de datos | **Prisma** | Definición del esquema (`schema.prisma`), migraciones, cliente tipado |
| Base de datos | **PostgreSQL** | Motor relacional |
| Autenticación (Fase 2) | **NextAuth / Auth.js** con estrategia de credenciales + sesión en DB | Login, sesiones, RBAC |
| Hosting sugerido | **VPS/Docker propio o Vercel + Postgres administrado (Neon/RDS)** | Según preferencia de la agencia |

### 1.2 Por qué este stack

**Next.js full-stack (un solo framework) en vez de frontend y backend separados (ej. React + NestJS):**

- *Ventajas:* una sola base de código y un solo lenguaje (TypeScript) de UI a base de datos; menor complejidad operativa para un equipo pequeño; App Router permite Server Components (menos JS al cliente, mejor rendimiento en tablas grandes); los route handlers (`/api/*`) son suficientes como capa API real y pueden exponerse a integraciones externas más adelante; deploy simple (una sola app).
- *Desventajas:* si en el futuro se necesita escalar el backend independientemente del frontend (por ejemplo, un equipo de datos consumiendo la API sin tocar la UI), un monolito Next.js es menos flexible que un backend dedicado. Mitigación: la capa de **lógica de negocio se aísla en `src/services/`**, independiente de componentes visuales, de forma que se puede extraer a un servicio separado (NestJS, Fastify) sin reescribir la lógica, solo el transporte.
- *Alternativas consideradas:*
  - **React (Vite) + NestJS + PostgreSQL:** más "enterprise", separación estricta de responsabilidades, mejor para equipos grandes o múltiples clientes de la API (móvil, integraciones). Más apropiado si el objetivo a mediano plazo es venderlo como SaaS multi-tenant con una API pública. Se puede migrar a esto después, reutilizando el modelo de datos y gran parte de la lógica de negocio si se mantiene aislada desde ahora.
  - **Laravel (PHP) + Livewire/Inertia:** ecosistema maduro para CRMs, muy productivo, pero introduce un segundo lenguaje si el resto del ecosistema (o futuros desarrolladores) es JS/TS.
  - **Django + DRF + React:** similar a NestJS, buena opción si se prefiere Python.
- *Cómo escala:* Postgres soporta bien el volumen esperado (miles de leads/clientes, decenas de miles de pólizas) con índices adecuados. La capa de servicios desacoplada permite pasar a colas (para automatizaciones), caché (Redis) y, si es necesario, separar el backend en microservicios por dominio (comisiones, notificaciones) sin rehacer el modelo de datos.

**Recomendación:** iniciar con Next.js full-stack (menor fricción para llegar a un producto usable), pero diseñando desde ya las fronteras (services, API routes con contratos claros) para que separar el backend en el futuro sea un cambio de infraestructura, no de lógica.

### 1.3 Capas de la aplicación

```
┌─────────────────────────────────────────────┐
│  Presentación (src/app, src/components)      │  ← páginas, layouts, UI
├─────────────────────────────────────────────┤
│  API (src/app/api/*)                         │  ← route handlers, validación de entrada
├─────────────────────────────────────────────┤
│  Servicios / lógica de negocio (src/services)│  ← reglas: conversión lead→cliente,
│                                               │     cálculo de comisiones, RBAC, etc.
├─────────────────────────────────────────────┤
│  Acceso a datos (Prisma Client)              │  ← queries, transacciones
├─────────────────────────────────────────────┤
│  Base de datos (PostgreSQL)                  │
└─────────────────────────────────────────────┘
```

Regla de oro (pedida explícitamente): **los componentes de UI nunca contienen lógica de negocio ni queries directas.** Un componente llama a un servicio; el servicio decide qué hacer y llama a Prisma.

---

## 2. Estructura de carpetas

Implementada en el UI Shell entregado:

```
alliance-crm/
├── prisma/
│   └── schema.prisma          # modelo de datos completo (Fase 1, sin conectar)
├── src/
│   ├── app/
│   │   ├── login/page.tsx
│   │   ├── (app)/              # grupo de rutas con layout autenticado
│   │   │   ├── layout.tsx      # AppShell (Sidebar + Header)
│   │   │   ├── dashboard/
│   │   │   ├── leads/[id]/
│   │   │   ├── clients/[id]/
│   │   │   ├── sales/
│   │   │   ├── policies/
│   │   │   ├── activities/
│   │   │   ├── tasks/
│   │   │   ├── calendar/
│   │   │   ├── commissions/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   └── api/                 # (vacío por ahora — Fase 2+)
│   ├── components/
│   │   ├── ui/                  # Button, Card, Badge, Table, Tabs, Modal, Kanban, StatCard, Field
│   │   ├── layout/               # Sidebar, Header, AppShell, PageHeader
│   │   └── charts/                # SimpleBarChart, SimpleLineChart (Recharts)
│   ├── features/                 # (reservado) lógica/UI específica por módulo a medida que crece
│   ├── services/                  # (reservado, Fase 2+) lógica de negocio pura, sin UI
│   ├── data/                      # mock.ts — datos de demo, se reemplaza por fetch a API
│   ├── lib/                        # utils.ts — formateo, cálculo de edad, enmascarado de datos sensibles
│   └── types/                      # tipos TS reflejando el modelo de datos
└── docs/
    └── arquitectura-fase1.md      # este documento
```

`features/` y `services/` ya existen como carpetas reservadas para que, a partir de Fase 2, cada módulo (leads, comisiones, etc.) tenga su propio espacio sin reorganizar lo ya construido.

---

## 3 y 4. Entidades principales y relaciones

Principio pedido y respetado: **Lead → Cliente → Póliza → Comisión** son entidades separadas, nunca una tabla única.

```
LeadSource ─┐
Pipeline ───┼──< Lead >──convertedTo──> Client
Agent ──────┘                            │
                                          ├──< Policy >── InsuranceLine
                                          │        │           │
                                          │        └── Carrier ┘
                                          │        │
                                          │        └──1:1── Commission ──< CommissionRate
                                          │
                                          ├──< Sale >── Pipeline (ventas)
                                          │
                                          ├──1:1── MedicareProfile ──< MedicareCondition/Medication/Specialist
                                          ├──1:1── ObamacareProfile ──< Dependent
                                          ├──1:1── FamilyHeritageProfile ──< CoveredMember
                                          │
                                          ├──< Activity / Task / Appointment / Note / Document
                                          └──< SensitiveField ──< SensitiveDataAccessLog

CustomField ──< CustomFieldValue >── (Lead | Client | Policy | Sale | Dependent)
User ──< Role ──< RolePermission >── Permission
Todo cambio relevante ──> AuditLog
Cambios de etapa (Lead o Sale) ──> PipelineHistory
```

Puntos clave del diseño relacional:

- **Un cliente puede tener múltiples pólizas**, y cada póliza pertenece a una única línea de negocio y un único carrier.
- **Cada línea de negocio (Medicare, Obamacare, Family Heritage) tiene su propia tabla de perfil**, relacionada 1:1 con `Client`. Agregar una línea nueva (Vida, Dental, Vision...) significa crear una tabla de perfil nueva — **nunca** agregar columnas a `Client`.
- **`InsuranceLine` es una tabla de catálogo**, no un enum fijo en código — se puede agregar "Vida" desde Configuración sin tocar el schema (sección 35 del pedido).
- **Los datos sensibles (SSN, cuentas bancarias) no viven como columnas de texto plano** en los perfiles: se centralizan en `SensitiveField` (valor cifrado + máscara + log de acceso). Los perfiles solo guardan una referencia (`*Ref`) a ese registro. Ver sección 13.

---

## 5. Modelo de base de datos

El modelo completo y normalizado está en [`prisma/schema.prisma`](../prisma/schema.prisma) del proyecto entregado — es el artefacto autoritativo, no una versión resumida. Contiene 30+ modelos agrupados en:

1. Usuarios, roles y permisos (RBAC)
2. Agentes / vendedores / AOR
3. Catálogos configurables (orígenes, líneas de negocio, carriers)
4. Pipelines y etapas (+ historial)
5. Leads
6. Clientes
7. Datos sensibles + log de acceso
8. Perfiles por línea de negocio (Medicare, Obamacare, Family Heritage)
9. Pólizas
10. Ventas (Sales Pipeline)
11. Compensaciones y tarifas
12. Actividades, tareas, citas, notas, documentos
13. Campos personalizados (EAV)
14. Notificaciones y auditoría

No se crearon migraciones ni se conectó una base real todavía — el schema se valida como **contrato de datos** antes de escribir lógica de backend sobre él, tal como se pidió.

---

## 6. Flujos principales

**A. Ciclo de vida de un lead**

```
Nuevo → Contactar → Contactado → Calificado → Cita programada →
En proceso → Oferta presentada → Documentación pendiente → Venta cerrada
                                                    │
                                          (o en cualquier punto) → No interesado / No califica / Perdido
```

Cada transición crea un registro en `PipelineHistory` (etapa anterior, etapa nueva, fecha, usuario).

**B. Conversión Lead → Cliente** (botón "Convertir a cliente")

1. Se crea el registro `Client` con los datos del lead.
2. `Lead.convertedClientId` apunta al nuevo cliente (se conserva el lead original, no se borra).
3. Actividades, notas, documentos y el historial de pipeline permanecen ligados al `leadId` original — el detalle de Cliente los muestra vía el vínculo, sin duplicar filas.
4. El vendedor, AOR y origen se copian al cliente para no perder el contexto comercial.

**C. Venta → Póliza → Comisión**

1. Una `Sale` avanza por su propio pipeline (Cotización → Aplicación → Pendiente → Aprobada → Cerrada).
2. Al llegar a una etapa marcada `isWon`, el sistema crea automáticamente un registro `Policy` ligado a esa venta (regla de automatización, ver sección 30 del pedido original).
3. Al crearse la `Policy`, el sistema busca la `CommissionRate` vigente para esa línea de negocio (y ese agente, si tiene tarifa personalizada) y genera el registro `Commission` con los montos calculados.
4. Cambios posteriores (pago recibido, chargeback) actualizan `Commission.status` y quedan en `AuditLog`.

**D. Alertas automáticas**

- *Turning 65:* se calcula en tiempo de lectura a partir de `Client.dob` (no se almacena una fecha fija) — un cliente que cumple 65 en los próximos N días aparece en el dashboard y genera una `Notification`.
- *Tareas vencidas / citas próximas / documentación pendiente:* mismo patrón — un job programado (Fase 14, Automatizaciones) revisa condiciones y genera `Notification`.

---

## 7. Sistema de permisos (RBAC)

- **Modelo:** `User` → `Role` → `RolePermission` → `Permission`. Un permiso es un par (`resource`, `action`), por ejemplo `("clients", "view_sensitive")`, `("commissions", "edit")`, `("reports", "export")`.
- **Roles base** (marcados `isSystem`, no eliminables): Super Admin, Admin, Manager, Agent/Vendedor, Viewer. El modelo permite crear roles adicionales libremente — los permisos no están hardcodeados en el código, se resuelven consultando `RolePermission` en cada request.
- **Alcance de datos, no solo de pantallas:** un Agent solo debería ver sus propios leads/clientes/ventas. Esto se resuelve en la capa de servicios (no en la UI): cada query de listado filtra por `agentId` salvo que el rol tenga el permiso `("*", "view_all")`.
- **Permisos especiales para datos sensibles:** ver campo/acción `sensitive_data.view` — sin ese permiso, la UI solo recibe el valor enmascarado (el backend nunca envía el valor real al cliente si el usuario no tiene el permiso).

---

## 8. Sistema de pipelines

- `Pipeline` tiene un `entityType` (`LEAD` o `SALE`) — así Leads y Ventas tienen pipelines independientes y configurables, y en el futuro se pueden crear pipelines adicionales (por ejemplo, uno de "Retención" o "Renovación") sin cambiar código.
- `PipelineStage` pertenece a un pipeline, tiene `order` (posición) y flags `isWon` / `isLost` que la lógica de negocio usa para disparar automatizaciones (crear póliza, marcar lead como perdido, etc.) sin comparar nombres de etapa como texto.
- Todo cambio de etapa pasa por un único servicio (`changeStage()`) que: valida la transición, actualiza la entidad, y escribe en `PipelineHistory`. Esto garantiza que **ningún cambio de etapa ocurre sin quedar trazado**, sin importar desde qué pantalla se dispare (tabla, Kanban, API).
- La vista Kanban (implementada ya en el módulo Ventas del UI Shell) es una proyección de `items agrupados por stageId` — el mismo componente `KanbanBoard` sirve para Leads y para Ventas.

---

## 9. Sistema de campos personalizados

- Patrón **EAV (Entity-Attribute-Value)** controlado: `CustomField` define el campo (entidad a la que aplica, tipo, etiqueta, opciones, orden, sección, obligatoriedad, visibilidad); `CustomFieldValue` guarda el valor para una entidad específica (`leadId` / `clientId` / `policyId` / `saleId`, solo uno no nulo por fila).
- Tipos soportados desde el inicio: texto, número, decimal, fecha, fecha y hora, boolean, select, multi-select, email, teléfono, URL, textarea, archivo — igual que lo pedido.
- **Por qué EAV y no columnas dinámicas:** agregar una columna nueva por cada campo personalizado requeriría migraciones constantes y termina en la "tabla monstruosa" que se pidió evitar. Con EAV, el administrador crea campos desde Configuración sin que el equipo de desarrollo despliegue cambios de base de datos.
- *Trade-off aceptado:* las consultas y reportes sobre campos personalizados son algo más complejas que sobre columnas nativas (se resuelve con vistas materializadas o índices sobre `CustomFieldValue` si el volumen lo justifica más adelante).

---

## 10. Sistema de pólizas

- `Policy` es la entidad central de "lo que el cliente tiene contratado": referencia a `Client`, `InsuranceLine`, `Carrier`, `Agent`/`Aor`, y opcionalmente a la `Sale` que la originó.
- Estados (`PolicyStatus`): Cotización, Aplicación, Pendiente, Aprobada, Activa, Cancelada, Rechazada, Chargeback — como enum controlado, porque son estados del negocio que no cambian con frecuencia (a diferencia de las etapas de pipeline, que sí son configurables).
- Un cliente con varias pólizas de distintas líneas (ej. Medicare + Family Heritage) simplemente tiene varias filas en `Policy` — el tab "Pólizas" del detalle de cliente las lista todas.
- Documentos y notas se asocian a la póliza específica, no solo al cliente, para soportar auditorías por póliza.

---

## 11. Sistema de compensaciones

- `CommissionRate` es la tabla de tarifas **editable desde Configuración** (nunca hardcodeada): por línea de negocio, opcionalmente por agente específico (si no hay tarifa por agente, se usa la tarifa base de la línea), con vigencia (`effectiveFrom` / `effectiveTo`) para poder cambiar tarifas sin perder el historial de cálculos pasados.
- `Commission` es el resultado calculado para una póliza concreta: monto del vendedor, del encargado (manager), del AOR, comisión del carrier, costo de adquisición y margen. Se genera automáticamente cuando la póliza pasa a un estado facturable, usando la tarifa vigente en `saleDate`.
- Estados de pago (`PENDING`, `PAID`, `CHARGEBACK`) independientes del estado de la póliza — una póliza puede estar `ACTIVE` con su comisión `PENDING` de pago.

---

## 12. Sistema de auditoría

- `AuditLog` registra usuario, acción (`CREATE`, `UPDATE`, `DELETE`, `STAGE_CHANGE`, `AGENT_CHANGE`, `SENSITIVE_ACCESS`, `POLICY_CHANGE`, `COMMISSION_CHANGE`), entidad afectada, campo, valor anterior, valor nuevo y fecha.
- Se escribe **desde la capa de servicios**, no desde la UI ni con triggers de base de datos ocultos — así el log siempre incluye el `userId` autenticado y el motivo de negocio, no solo el diff de datos.
- El acceso a datos sensibles tiene su propio log dedicado (`SensitiveDataAccessLog`), más granular que el `AuditLog` general, porque regulatoriamente conviene poder responder "¿quién vio el SSN de este cliente y cuándo?" sin filtrar entre miles de cambios de otros campos.

---

## 13. Arquitectura de seguridad

- **Autenticación:** sesiones basadas en base de datos (no solo JWT stateless) para poder revocar sesiones activas desde Configuración → Usuarios. Contraseñas con hash `bcrypt`/`argon2`, nunca texto plano.
- **Autorización:** RBAC descrito en la sección 7, verificado en cada route handler del lado del servidor — nunca confiar en que la UI oculte un botón como única protección.
- **Protección de datos sensibles:**
  - Cifrado a nivel de aplicación (AES-256) para `SensitiveField.encryptedValue`; la base de datos nunca almacena SSN o números de cuenta en texto plano.
  - La API nunca devuelve el valor real a un cliente sin el permiso `sensitive_data.view` — devuelve `maskedPreview`.
  - Todo acceso al valor real genera un `SensitiveDataAccessLog`.
- **Validación:** en dos capas — Zod (o similar) en el cliente para UX inmediata, y la misma validación repetida en el servidor (nunca confiar solo en el frontend). Ejemplos ya identificados: email, teléfono, fecha de nacimiento, prima numérica ≥ 0, porcentajes entre 0-100, números de póliza únicos.
- **Prevención de vulnerabilidades comunes:** Prisma parametriza las queries (mitiga SQL injection); Next.js escapa la salida por defecto (mitiga XSS); CSRF mitigado por `SameSite` cookies + tokens en formularios sensibles; *rate limiting* en endpoints de login y de exportación de datos; subida de archivos validada por tipo/tamaño y almacenada fuera del webroot (S3 o equivalente) con URLs firmadas.
- **Multi-tenancy futura:** aunque hoy el sistema es de una sola agencia, todas las tablas de catálogo (líneas, tarifas, pipelines, campos personalizados) están diseñadas para poder llevar una columna `organizationId` el día que se decida ofrecer el CRM a otras agencias, sin rediseñar el modelo.

---

## Próximos pasos (no iniciar sin aprobación)

Orden ya acordado: Fase 2 (Auth + Usuarios + Roles) → Fase 3 (Leads + Pipeline real) → Fase 4 (Clientes) → ... según el orden completo de 15 fases definido en el brief original.

**Este documento y el UI Shell adjunto quedan a la espera de aprobación antes de continuar con Fase 2.**
