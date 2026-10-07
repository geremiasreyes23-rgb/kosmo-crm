import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { requireUser, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UsersPanel } from "@/components/settings/UsersPanel";
import { CustomFieldsPanel, type CustomFieldRow } from "@/components/settings/CustomFieldsPanel";
import { CommissionRatesPanel } from "@/components/settings/CommissionRatesPanel";
import { MailSettingsPanel } from "@/components/settings/MailSettingsPanel";
import { getMailAdminOverview } from "./mail-settings-actions";
import { getAuditLogEntries } from "./audit-data";
import { AuditLogPanel } from "@/components/settings/AuditLogPanel";
import { RolePermissionsPanel } from "@/components/settings/RolePermissionsPanel";
import { UserVisibilityPanel } from "@/components/settings/UserVisibilityPanel";
import { PipelinesPanel, type PipelineRow } from "@/components/settings/PipelinesPanel";
import { InsuranceLinesPanel, type InsuranceLineRow } from "@/components/settings/InsuranceLinesPanel";
import { CarriersPanel, type CarrierRow } from "@/components/settings/CarriersPanel";
import { LeadSourcesPanel } from "@/components/settings/LeadSourcesPanel";
import { NotificationSettingsPanel, type NotificationSettingRow } from "@/components/settings/NotificationSettingsPanel";
import { NOTIFICATION_SETTINGS } from "@/lib/notificationSettings";
import type { CommissionRateVM } from "@/types";

export const dynamic = "force-dynamic";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  "Super Admin": "Acceso total al sistema, incluida la gestión de usuarios y roles",
  Admin: "Administración del CRM: usuarios, configuración, todos los módulos",
  Manager: "Visualización y administración de su equipo",
  Agent: "Acceso a sus propios leads, clientes, ventas y actividades",
  Viewer: "Solo lectura",
};

export default async function SettingsPage() {
  const currentUser = await requireUser();
  const isManager = currentUser.roleName === "Super Admin" || currentUser.roleName === "Admin";
  const canManageFields = hasPermission(currentUser, "settings", "create");
  const canManageMail = hasPermission(currentUser, "mail", "admin");
  const canManageRates = hasPermission(currentUser, "commissions", "admin");
  const canViewAudit = hasPermission(currentUser, "audit", "view");

  const [
    dbRoles,
    dbUsers,
    dbCustomFields,
    dbInsuranceLines,
    mailAdminOverview,
    dbCommissionRates,
    dbAgents,
    auditEntries,
    dbPermissions,
    dbRolePermissions,
    dbModuleVisibility,
    dbPipelines,
    dbAllInsuranceLines,
    dbCarriers,
    dbLeadSources,
    dbNotificationSettings,
    dbVisibilityOverrides,
  ] = await Promise.all([
      prisma.role.findMany({ orderBy: { createdAt: "asc" } }),
      isManager
        ? prisma.user.findMany({
            include: { role: true },
            orderBy: [{ status: "asc" }, { firstName: "asc" }],
          })
        : Promise.resolve([]),
      prisma.customField.findMany({
        include: { insuranceLine: true },
        orderBy: [{ entityType: "asc" }, { order: "asc" }],
      }),
      prisma.insuranceLine.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      canManageMail ? getMailAdminOverview() : Promise.resolve(null),
      prisma.commissionRate.findMany({
        include: { insuranceLine: true, agent: true },
        orderBy: [{ effectiveFrom: "desc" }],
      }),
      prisma.agent.findMany({ where: { status: "ACTIVE" }, orderBy: { firstName: "asc" } }),
      canViewAudit ? getAuditLogEntries() : Promise.resolve([]),
      // Roles y permisos / Visibilidad de módulos — solo se traen si el
      // usuario puede editarlos (isManager), igual que dbUsers arriba, para
      // no armar la matriz completa de permisos en el servidor para
      // cuentas que de todas formas no van a poder tocarla.
      isManager ? prisma.permission.findMany({ orderBy: [{ resource: "asc" }, { action: "asc" }] }) : Promise.resolve([]),
      isManager ? prisma.rolePermission.findMany({ select: { roleId: true, permissionId: true } }) : Promise.resolve([]),
      isManager ? prisma.roleModuleVisibility.findMany({ where: { visible: true }, select: { roleId: true, moduleKey: true } }) : Promise.resolve([]),
      prisma.pipeline.findMany({
        orderBy: [{ entityType: "asc" }, { isDefault: "desc" }, { name: "asc" }],
        include: { stages: { orderBy: { order: "asc" } } },
      }),
      // A diferencia de insuranceLineOptions (arriba, solo activas — para
      // los formularios que crean pólizas/tarifas), acá se traen TODAS,
      // porque el panel de Configuración necesita poder reactivar una que
      // esté inactiva.
      prisma.insuranceLine.findMany({ orderBy: { name: "asc" } }),
      prisma.carrier.findMany({ include: { lines: true }, orderBy: { name: "asc" } }),
      prisma.leadSource.findMany({ orderBy: { name: "asc" } }),
      prisma.notificationSetting.findMany(),
      isManager ? prisma.userVisibilityOverride.findMany() : Promise.resolve([]),
    ]);

  const roleOptions = dbRoles.map((r) => ({ id: r.id, name: r.name }));
  const userRows = dbUsers.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    status: u.status,
    roleId: u.roleId,
    roleName: u.role.name,
    supervisorId: u.supervisorId ?? "",
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  }));
  const customFieldRows: CustomFieldRow[] = dbCustomFields.map((f) => ({
    id: f.id,
    entityType: f.entityType,
    name: f.name,
    label: f.label,
    fieldType: f.fieldType,
    isRequired: f.isRequired,
    isVisible: f.isVisible,
    options: Array.isArray(f.options) ? (f.options as string[]) : null,
    insuranceLineName: f.insuranceLine?.name ?? null,
  }));
  const insuranceLineOptions = dbInsuranceLines.map((l) => ({ id: l.id, name: l.name }));
  const now = new Date();
  const commissionRateRows: CommissionRateVM[] = dbCommissionRates.map((r) => ({
    id: r.id,
    insuranceLineId: r.insuranceLineId,
    lineName: r.insuranceLine.name,
    agentId: r.agentId ?? undefined,
    agentName: r.agent ? `${r.agent.firstName} ${r.agent.lastName}` : undefined,
    agentAmountOrPct: r.agentAmountOrPct,
    agentAmountType: r.agentAmountType,
    managerPct: r.managerPct ?? undefined,
    aorAmount: r.aorAmount ?? undefined,
    effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: r.effectiveTo ? r.effectiveTo.toISOString().slice(0, 10) : undefined,
    isActive: !r.effectiveTo || r.effectiveTo > now,
  }));
  const agentOptions = dbAgents.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` }));

  const permissionRows = dbPermissions.map((p) => ({ id: p.id, resource: p.resource, action: p.action }));
  const roleGrants: Record<string, string[]> = {};
  for (const rp of dbRolePermissions) {
    (roleGrants[rp.roleId] ??= []).push(rp.permissionId);
  }
  const roleModuleVisibilityMap: Record<string, string[]> = {};
  for (const mv of dbModuleVisibility) {
    (roleModuleVisibilityMap[mv.roleId] ??= []).push(mv.moduleKey);
  }
  const roleRows = dbRoles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem, description: r.description }));

  const pipelineRows: PipelineRow[] = dbPipelines.map((p) => ({
    id: p.id,
    name: p.name,
    entityType: p.entityType,
    isDefault: p.isDefault,
    stages: p.stages.map((s) => ({ id: s.id, name: s.name, order: s.order, isWon: s.isWon, isLost: s.isLost })),
  }));

  const insuranceLineRows: InsuranceLineRow[] = dbAllInsuranceLines.map((l) => ({
    id: l.id,
    name: l.name,
    code: l.code,
    isActive: l.isActive,
  }));

  const carrierRows: CarrierRow[] = dbCarriers.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    insuranceLineIds: c.lines.map((l) => l.insuranceLineId),
  }));

  const notificationSettingValues: Record<string, NotificationSettingRow> = {};
  for (const row of dbNotificationSettings) {
    notificationSettingValues[row.type] = { type: row.type, enabled: row.enabled, thresholdValue: row.thresholdValue };
  }

  return (
    <div>
      <PageHeader title="Configuración" />
      <Card>
        <CardContent className="pt-5">
          <Tabs
            tabs={[
              {
                id: "roles",
                label: "Roles y permisos",
                content: isManager ? (
                  <RolePermissionsPanel
                    roles={roleRows}
                    permissions={permissionRows}
                    grants={roleGrants}
                    moduleVisibility={roleModuleVisibilityMap}
                    currentRoleName={currentUser.roleName}
                  />
                ) : (
                  <div className="space-y-2">
                    {dbRoles.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] px-3 py-2.5 text-sm">
                        <div>
                          <p className="font-medium">{r.name}</p>
                          <p className="text-xs text-[var(--ink-muted)]">
                            {r.description ?? ROLE_DESCRIPTIONS[r.name] ?? "—"}
                          </p>
                        </div>
                        <Badge status="neutral">{r.isSystem ? "Rol base" : "Personalizado"}</Badge>
                      </div>
                    ))}
                    <p className="pt-1 text-xs text-[var(--ink-muted)]">
                      Solo Admin y Super Admin pueden editar permisos y visibilidad de módulos.
                    </p>
                  </div>
                ),
              },
              {
                id: "pipelines",
                label: "Pipelines y etapas",
                content: <PipelinesPanel initialPipelines={pipelineRows} canManage={isManager} />,
              },
              {
                id: "lines",
                label: "Líneas de negocio",
                content: <InsuranceLinesPanel initialLines={insuranceLineRows} canManage={isManager} />,
              },
              {
                id: "rates",
                label: "Tabla de tarifas",
                content: (
                  <CommissionRatesPanel
                    initialRates={commissionRateRows}
                    insuranceLines={insuranceLineOptions}
                    agents={agentOptions}
                    canManage={canManageRates}
                  />
                ),
              },
              {
                id: "custom_fields",
                label: "Campos personalizados",
                content: (
                  <CustomFieldsPanel
                    initialFields={customFieldRows}
                    insuranceLines={insuranceLineOptions}
                    canManage={canManageFields}
                  />
                ),
              },
              ...(canManageMail && mailAdminOverview
                ? [
                    {
                      id: "internal_mail",
                      label: "Correo interno",
                      content: (
                        <MailSettingsPanel
                          overview={mailAdminOverview}
                          userOptions={dbUsers.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }))}
                        />
                      ),
                    },
                  ]
                : []),
              {
                id: "users",
                label: "Usuarios",
                content: isManager ? (
                  <UsersPanel initialUsers={userRows} roles={roleOptions} currentUserId={currentUser.id} />
                ) : (
                  <p className="text-sm text-[var(--ink-muted)]">
                    No tienes permiso para gestionar usuarios. Solo Admin y Super Admin pueden hacerlo.
                  </p>
                ),
              },
              ...(isManager
                ? [
                    {
                      id: "user-visibility",
                      label: "Visibilidad por usuario",
                      content: (
                        <UserVisibilityPanel
                          users={dbUsers
                            .filter((u) => u.status === "ACTIVE")
                            .map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, roleId: u.roleId, roleName: u.role.name }))}
                          roleModuleVisibility={roleModuleVisibilityMap}
                          overrides={(dbVisibilityOverrides as { userId: string; key: string; visible: boolean }[]).reduce<Record<string, Record<string, boolean>>>((acc, o) => {
                            (acc[o.userId] ??= {})[o.key] = o.visible;
                            return acc;
                          }, {})}
                          currentRoleName={currentUser.roleName}
                        />
                      ),
                    },
                  ]
                : []),
              {
                id: "carriers",
                label: "Carriers",
                content: (
                  <CarriersPanel initialCarriers={carrierRows} insuranceLines={insuranceLineOptions} canManage={isManager} />
                ),
              },
              {
                id: "sources",
                label: "Orígenes de leads",
                content: <LeadSourcesPanel initialSources={dbLeadSources} canManage={isManager} />,
              },
              {
                id: "notifications",
                label: "Notificaciones",
                content: (
                  <NotificationSettingsPanel
                    defs={NOTIFICATION_SETTINGS}
                    initialValues={notificationSettingValues}
                    canManage={isManager}
                  />
                ),
              },
              ...(canViewAudit
                ? [
                    {
                      id: "audit",
                      label: "Auditoría",
                      content: <AuditLogPanel entries={auditEntries} />,
                    },
                  ]
                : []),
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
