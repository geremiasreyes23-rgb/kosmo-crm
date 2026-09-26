import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import { requireUser, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UsersPanel } from "@/components/settings/UsersPanel";
import { CustomFieldsPanel, type CustomFieldRow } from "@/components/settings/CustomFieldsPanel";
import { CommissionRatesPanel } from "@/components/settings/CommissionRatesPanel";
import { MailSettingsPanel } from "@/components/settings/MailSettingsPanel";
import { getMailAdminOverview } from "./mail-settings-actions";
import type { CommissionRateVM } from "@/types";

export const dynamic = "force-dynamic";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  "Super Admin": "Acceso total al sistema, incluida la gestión de usuarios y roles",
  Admin: "Administración del CRM — usuarios, configuración, todos los módulos",
  Manager: "Visualización y administración de su equipo",
  Agent: "Acceso a sus propios leads, clientes, ventas y actividades",
  Viewer: "Solo lectura",
};

const lines = ["Medicare Advantage", "Obamacare", "Family Heritage"];

export default async function SettingsPage() {
  const currentUser = await requireUser();
  const isManager = currentUser.roleName === "Super Admin" || currentUser.roleName === "Admin";
  const canManageFields = hasPermission(currentUser, "settings", "create");
  const canManageMail = hasPermission(currentUser, "mail", "admin");
  const canManageRates = hasPermission(currentUser, "commissions", "admin");

  const [dbRoles, dbUsers, dbCustomFields, dbInsuranceLines, mailAdminOverview, dbCommissionRates, dbAgents] =
    await Promise.all([
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

  return (
    <div>
      <PageHeader title="Configuración" description="Administración del sistema — todo configurable, nada hardcodeado" />
      <Card>
        <CardContent className="pt-5">
          <Tabs
            tabs={[
              {
                id: "roles",
                label: "Roles y permisos",
                content: (
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
                  </div>
                ),
              },
              {
                id: "pipelines",
                label: "Pipelines y etapas",
                content: (
                  <p className="text-sm text-[var(--ink-muted)]">
                    Administra las etapas de los pipelines de Leads y Ventas (orden, ganada/perdida) — ver módulos Leads y Ventas para la vista Kanban en vivo.
                  </p>
                ),
              },
              {
                id: "lines",
                label: "Líneas de negocio",
                content: (
                  <div className="flex flex-wrap gap-2">
                    {lines.map((l) => (
                      <Badge key={l} status="info">{l}</Badge>
                    ))}
                    <Button size="sm" variant="secondary">
                      <Plus className="h-4 w-4" /> Agregar línea
                    </Button>
                  </div>
                ),
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
                    No tienes permiso para gestionar usuarios — solo Admin y Super Admin.
                  </p>
                ),
              },
              { id: "carriers", label: "Carriers", content: <p className="text-sm text-[var(--ink-muted)]">Catálogo de carriers por línea de negocio.</p> },
              { id: "sources", label: "Orígenes de leads", content: <p className="text-sm text-[var(--ink-muted)]">Base de datos, Referido, Evento, Llamada entrante, Otro.</p> },
              { id: "notifications", label: "Notificaciones", content: <p className="text-sm text-[var(--ink-muted)]">Configuración de alertas: tareas vencidas, Turning 65, chargebacks, etc.</p> },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
