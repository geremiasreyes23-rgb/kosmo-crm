# Alliance Insurance CRM

CRM interno para Alliance Insurance (agencia de seguros — Medicare Advantage,
Obamacare, Family Heritage). Este repositorio contiene la **Fase 1**:
arquitectura + UI Shell.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Recharts (gráficos) · Lucide (iconos)
- Prisma (schema de base de datos, ver `prisma/schema.prisma`) — sin conectar todavía

## Cómo correr el proyecto

```bash
npm install
npm run dev
```

Abrir http://localhost:3000 — redirige a `/login` y de ahí al `/dashboard`.

## Estado de esta fase

- ✅ Estructura de carpetas y arquitectura por capas
- ✅ Design system básico (Button, Card, Badge, Table, Tabs, Modal, Kanban, Charts)
- ✅ Layout (Sidebar + Header) y navegación entre módulos
- ✅ Páginas de Dashboard, Leads, Clientes, Ventas, Pólizas, Actividades, Tareas,
  Calendario, Comisiones, Reportes y Configuración con datos de demostración
- ✅ Modelo de datos completo en `prisma/schema.prisma`
- ⏳ Sin backend real, autenticación ni base de datos conectada (Fase 2+)

Ver `docs/arquitectura-fase1.md` para el detalle de decisiones técnicas.

## Estructura

```
src/
  app/            rutas (App Router) — (app)/ agrupa el layout autenticado
  components/
    ui/           design system (Button, Card, Table, Badge, Tabs, Modal, Kanban...)
    layout/       Sidebar, Header, AppShell, PageHeader
    charts/       wrappers de Recharts
  data/           datos mock (se reemplaza por llamadas a API en fases futuras)
  lib/            utilidades (formateo, cálculo de edad, enmascarado de datos sensibles)
  types/          tipos TypeScript que reflejan el modelo de datos
prisma/
  schema.prisma   modelo de datos completo (no conectado aún)
docs/
  arquitectura-fase1.md   documento de arquitectura completo
```
