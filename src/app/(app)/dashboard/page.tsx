import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import { SimpleLineChart } from "@/components/charts/SimpleLineChart";
import { Select } from "@/components/ui/Field";
import { requireUser } from "@/lib/auth";
import {
  getDashboardSummary,
  getSalesByLineChart,
  getSalesTrendChart,
  getAgentPerformance,
  getTurning65Alerts,
} from "./data";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  UserPlus,
  UserCheck,
  ShieldCheck,
  DollarSign,
  AlertTriangle,
  Cake,
  Handshake,
  ListTodo,
  CalendarClock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [s, salesByLineChart, salesTrendChart, agentPerformance, turning65Alerts] = await Promise.all([
    getDashboardSummary(user),
    getSalesByLineChart(user),
    getSalesTrendChart(user),
    getAgentPerformance(user),
    getTurning65Alerts(user),
  ]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Resumen general de la operación de Alliance Insurance"
        actions={
          <Select defaultValue="month" className="w-44">
            <option value="today">Hoy</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
            <option value="last_month">Mes anterior</option>
            <option value="year">Este año</option>
            <option value="custom">Rango personalizado</option>
          </Select>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Leads nuevos (mes)" value={s.newLeads} icon={UserPlus} />
        <StatCard label="Leads por contactar" value={s.pendingLeads} icon={UserPlus} tone="warning" />
        <StatCard label="Leads contactados" value={s.contactedLeads} icon={UserPlus} />
        <StatCard label="Leads convertidos" value={s.convertedLeads} icon={UserCheck} tone="good" />
        <StatCard label="Clientes nuevos (mes)" value={s.newClients} icon={UserCheck} />
        <StatCard label="Ventas del mes" value={s.salesThisMonth} icon={Handshake} />
        <StatCard label="Pólizas activas" value={s.activePolicies} icon={ShieldCheck} tone="good" />
        <StatCard label="Pólizas pendientes" value={s.pendingPolicies} icon={ShieldCheck} tone="warning" />
        <StatCard label="Pólizas canceladas" value={s.cancelledPolicies} icon={ShieldCheck} tone="critical" />
        <StatCard label="Comisiones pendientes" value={formatCurrency(s.commissionsPending)} icon={DollarSign} tone="warning" />
        <StatCard label="Comisiones pagadas" value={formatCurrency(s.commissionsPaid)} icon={DollarSign} tone="good" />
        <StatCard label="Chargebacks" value={s.chargebacks} icon={AlertTriangle} tone="critical" />
        <StatCard label="Margen generado" value={formatCurrency(s.margin)} icon={DollarSign} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por línea de negocio</CardTitle>
          </CardHeader>
          <CardContent>
            {salesByLineChart.length > 0 ? (
              <SimpleBarChart data={salesByLineChart} xKey="line" yKey="ventas" />
            ) : (
              <Empty text="Sin pólizas registradas todavía." />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tendencia de ventas (últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleLineChart data={salesTrendChart} xKey="mes" yKey="ventas" />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Ventas por vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            {agentPerformance.length > 0 ? (
              <SimpleBarChart data={agentPerformance} xKey="agente" yKey="ventas" color="#eb6834" />
            ) : (
              <Empty text="Sin pólizas registradas todavía." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" /> Tareas pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Empty text="El módulo de Tareas todavía no está conectado a base de datos real (fase posterior)." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> Próximas citas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Empty text="El módulo de Citas todavía no está conectado a base de datos real (fase posterior)." />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="h-4 w-4 text-[var(--brand-500)]" /> Alertas — Turning 65
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {turning65Alerts.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <p className="font-medium">{c.clientName}</p>
                <Badge status="info">Cumple 65 el {formatDate(c.turns65On)}</Badge>
              </div>
            ))}
            {turning65Alerts.length === 0 && <Empty text="Sin alertas próximas." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


function Empty({ text }: { text: string }) {
  return <p className="text-sm text-[var(--ink-muted)]">{text}</p>;
}
