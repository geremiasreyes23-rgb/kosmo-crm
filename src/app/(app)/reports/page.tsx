import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ReportsView } from "./ReportsView";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireUser();
  // Reportes expone datos financieros y operativos de toda la agencia
  // (comisiones, márgenes, productividad por vendedor) — a propósito
  // restringido a Super Admin/Admin, no solo a quien tenga "reports:view"
  // (que Manager/Agent/Viewer también tienen, para el resto del sistema).
  // Mismo criterio de "isManager" que ya usa Configuración → Usuarios.
  const isManager = user.roleName === "Super Admin" || user.roleName === "Admin";

  if (!isManager) {
    return (
      <div>
        <PageHeader title="Reportes" description="Genera y exporta reportes operativos y financieros" />
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-sm text-[var(--ink-muted)]">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            Esta sección está reservada a Super Admin y Admin.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Reportes" description="Genera y exporta reportes operativos y financieros" />
      <ReportsView />
    </div>
  );
}
