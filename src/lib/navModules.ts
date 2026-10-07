/**
 * Catálogo único de los módulos del menú lateral (Sidebar.tsx) — fuente de
 * verdad compartida entre el Sidebar (qué href tiene cada ítem) y
 * Configuración → Roles y permisos → "Visibilidad de módulos" (qué rol ve
 * cada uno). `key` coincide 1:1 con el `href` de cada item en
 * Sidebar.tsx#navItems y con `RoleModuleVisibility.moduleKey` en la base de
 * datos — si se agrega un módulo nuevo al Sidebar, agregarlo acá también
 * (y en MODULE_KEYS de prisma/seed.ts) para que aparezca en el panel de
 * visibilidad.
 */
export interface NavModuleDef {
  key: string;
  label: string;
}

export const NAV_MODULES: NavModuleDef[] = [
  { key: "/feed", label: "Feed" },
  { key: "/dashboard", label: "Dashboard" },
  { key: "/messages", label: "Mensajes" },
  { key: "/mail", label: "Correo interno" },
  { key: "/leads", label: "CRM (Leads, Clientes, Ventas, Pólizas)" },
  { key: "/submissions", label: "Envíos (submisiones)" },
  { key: "/activities", label: "Actividades" },
  { key: "/tasks", label: "Tareas" },
  { key: "/calendar", label: "Calendario" },
  { key: "/commissions", label: "Comisiones" },
  { key: "/documents", label: "Documentos" },
  { key: "/reports", label: "Reportes" },
  { key: "/settings", label: "Configuración" },
];

export const NAV_MODULE_KEYS: string[] = NAV_MODULES.map((m) => m.key);

/** Módulos que se siembran OCULTOS para todos los roles: solo los ve quien
 * el administrador habilite (por rol o por persona). */
export const NAV_MODULES_HIDDEN_BY_DEFAULT: string[] = ["/submissions"];
