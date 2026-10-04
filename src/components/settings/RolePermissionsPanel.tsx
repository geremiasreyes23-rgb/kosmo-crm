"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { HScroll } from "@/components/ui/HScroll";
import { NAV_MODULES } from "@/lib/navModules";
import {
  setRolePermissionAction,
  setRoleModuleVisibilityAction,
} from "@/app/(app)/settings/roles-actions";

export interface RoleRow {
  id: string;
  name: string;
  isSystem: boolean;
  description: string | null;
}

export interface PermissionRow {
  id: string;
  resource: string;
  action: string;
}

const RESOURCE_LABEL: Record<string, string> = {
  leads: "Leads",
  clients: "Clientes",
  sales: "Ventas",
  policies: "Pólizas",
  commissions: "Comisiones",
  activities: "Actividades",
  tasks: "Tareas",
  calendar: "Calendario",
  reports: "Reportes",
  settings: "Configuración",
  mail: "Correo interno",
  feed: "Feed de actividades",
};

const ACTION_LABEL: Record<string, string> = {
  view: "Ver",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
};

const CRUD_ACTIONS = ["view", "create", "edit", "delete"];
const CRUD_RESOURCE_ORDER = [
  "leads",
  "clients",
  "sales",
  "policies",
  "commissions",
  "activities",
  "tasks",
  "calendar",
  "reports",
  "settings",
  "mail",
  "feed",
];

const EXTRA_LABEL: Record<string, string> = {
  "reports:export": "Exportar reportes",
  "sensitive_data:view": "Ver datos sensibles sin máscara (SSN, cuentas bancarias)",
  "users:manage": "Gestionar usuarios",
  "*:view_all": "Ver todo el negocio (no solo lo propio)",
  "mail:admin": "Administrar el módulo de correo interno",
  "commissions:admin": "Administrar la tabla de tarifas de comisión",
  "activities:review": "Revisar/aprobar reportes diarios de otros",
  "audit:view": "Ver el registro de auditoría",
  "feed:moderate": "Moderar el feed (fijar/editar/eliminar publicaciones ajenas)",
};

const ROLE_DESCRIPTION_FALLBACK: Record<string, string> = {
  "Super Admin": "Acceso total al sistema, incluida la gestión de usuarios y roles",
  Admin: "Administración del CRM: usuarios, configuración, todos los módulos",
  Manager: "Visualización y administración de su equipo",
  Agent: "Acceso a sus propios leads, clientes, ventas y actividades",
  Viewer: "Solo lectura",
};

export function RolePermissionsPanel({
  roles,
  permissions,
  grants,
  moduleVisibility,
  currentRoleName,
}: {
  roles: RoleRow[];
  permissions: PermissionRow[];
  grants: Record<string, string[]>;
  moduleVisibility: Record<string, string[]>;
  currentRoleName: string;
}) {
  const router = useRouter();
  const [selectedRoleId, setSelectedRoleId] = useState(roles.find((r) => r.name !== "Super Admin")?.id ?? roles[0]?.id);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  const permissionsByKey = useMemo(() => {
    const map = new Map<string, PermissionRow>();
    for (const p of permissions) map.set(`${p.resource}:${p.action}`, p);
    return map;
  }, [permissions]);

  const grantedSet = new Set(selectedRoleId ? grants[selectedRoleId] ?? [] : []);
  const visibleSet = new Set(selectedRoleId ? moduleVisibility[selectedRoleId] ?? [] : []);

  const isSuperAdmin = selectedRole?.name === "Super Admin";
  const canEditSelectedRole =
    !!selectedRole &&
    !isSuperAdmin &&
    (selectedRole.name !== "Admin" || currentRoleName === "Super Admin");

  async function togglePermission(permissionId: string, nextGranted: boolean) {
    if (!selectedRoleId) return;
    setBusyKey(permissionId);
    setError(null);
    const result = await setRolePermissionAction({ roleId: selectedRoleId, permissionId, granted: nextGranted });
    setBusyKey(null);
    if (!result.ok) {
      setError(result.error ?? "No se pudo actualizar el permiso.");
      return;
    }
    router.refresh();
  }

  async function toggleModule(moduleKey: string, nextVisible: boolean) {
    if (!selectedRoleId) return;
    setBusyKey(moduleKey);
    setError(null);
    const result = await setRoleModuleVisibilityAction({ roleId: selectedRoleId, moduleKey, visible: nextVisible });
    setBusyKey(null);
    if (!result.ok) {
      setError(result.error ?? "No se pudo actualizar la visibilidad.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-[var(--border-hairline)] p-1">
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedRoleId(r.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedRoleId === r.id
                ? "bg-[var(--brand-500)] text-white"
                : "text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>

      {selectedRole && (
        <p className="text-xs text-[var(--ink-muted)]">
          {selectedRole.description ?? ROLE_DESCRIPTION_FALLBACK[selectedRole.name] ?? "—"}
        </p>
      )}

      {isSuperAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-3 py-2.5 text-sm text-[var(--ink-secondary)]">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Super Admin tiene acceso total por diseño y siempre ve todos los módulos. No depende de esta tabla,
          así que no es editable.
        </div>
      )}

      {!isSuperAdmin && !canEditSelectedRole && (
        <div className="rounded-lg border border-[var(--status-warning-bg)] bg-[var(--status-warning-bg)] px-3 py-2.5 text-sm text-[var(--status-warning)]">
          Solo un Super Admin puede modificar los permisos del rol Admin.
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-[var(--status-critical-bg)] bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
          {error}
        </p>
      )}

      {selectedRoleId && (
        <>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Permisos por módulo</h3>
            <HScroll className="rounded-lg border border-[var(--border-hairline)]" innerClassName="rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] bg-[var(--surface-sunken)]">
                    <th className="px-3 py-2 text-left font-medium">Módulo</th>
                    {CRUD_ACTIONS.map((action) => (
                      <th key={action} className="px-3 py-2 text-center font-medium">
                        {ACTION_LABEL[action]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CRUD_RESOURCE_ORDER.map((resource) => (
                    <tr key={resource} className="border-b border-[var(--border-hairline)] last:border-0">
                      <td className="px-3 py-2 font-medium">{RESOURCE_LABEL[resource] ?? resource}</td>
                      {CRUD_ACTIONS.map((action) => {
                        const permission = permissionsByKey.get(`${resource}:${action}`);
                        if (!permission) return <td key={action} className="px-3 py-2 text-center">—</td>;
                        const granted = isSuperAdmin || grantedSet.has(permission.id);
                        return (
                          <td key={action} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={granted}
                              disabled={!canEditSelectedRole || busyKey === permission.id}
                              onChange={(e) => togglePermission(permission.id, e.target.checked)}
                              className="h-4 w-4 rounded border-[var(--border-hairline)] disabled:opacity-50"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </HScroll>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Permisos especiales</h3>
            <div className="space-y-1.5">
              {Object.entries(EXTRA_LABEL).map(([key, label]) => {
                const permission = permissionsByKey.get(key);
                if (!permission) return null;
                const granted = isSuperAdmin || grantedSet.has(permission.id);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-2.5 rounded-lg border border-[var(--border-hairline)] px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={granted}
                      disabled={!canEditSelectedRole || busyKey === permission.id}
                      onChange={(e) => togglePermission(permission.id, e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--border-hairline)] disabled:opacity-50"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Visibilidad de módulos (menú lateral)</h3>
            <p className="mb-2 text-xs text-[var(--ink-muted)]">
              Controla qué aparece en el menú de la izquierda para este rol, independiente de los permisos de
              arriba, que controlan qué puede hacer con los datos.
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {NAV_MODULES.map((mod) => {
                const visible = isSuperAdmin || visibleSet.has(mod.key);
                return (
                  <label
                    key={mod.key}
                    className="flex items-center gap-2.5 rounded-lg border border-[var(--border-hairline)] px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      disabled={!canEditSelectedRole || busyKey === mod.key}
                      onChange={(e) => toggleModule(mod.key, e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--border-hairline)] disabled:opacity-50"
                    />
                    {mod.label}
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {roles.map((r) => (
          <Badge key={r.id} status="neutral">
            {r.name}: {r.isSystem ? "rol base" : "personalizado"}
          </Badge>
        ))}
      </div>
    </div>
  );
}
