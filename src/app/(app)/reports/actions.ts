"use server";

import { prisma } from "@/lib/db";
import { requireUser, canViewAll, hasPermission } from "@/lib/auth";
import { buildCsv } from "@/lib/csv";
import { calculateAge } from "@/lib/utils";

export interface ExportReportResult {
  ok: boolean;
  error?: string;
  csv?: string;
  filename?: string;
}

export type ReportKey =
  | "ventas_mensuales"
  | "ventas_por_vendedor"
  | "ventas_por_linea"
  | "ventas_por_carrier"
  | "clientes_nuevos"
  | "leads_generados"
  | "conversion_leads"
  | "clientes_antiguedad"
  | "turning_65"
  | "polizas_activas"
  | "polizas_canceladas"
  | "comisiones"
  | "chargebacks"
  | "margen"
  | "productividad_vendedores"
  | "actividades";

function fullName(a: { firstName: string; lastName: string } | null | undefined): string {
  return a ? `${a.firstName} ${a.lastName}` : "Sin asignar";
}

/** Suma un valor numérico por clave y devuelve las filas ordenadas por
 * total descendente — usado por los reportes "por X" (vendedor, línea,
 * carrier). */
function groupSum(items: { key: string; amount: number }[]): { key: string; count: number; total: number }[] {
  const map = new Map<string, { count: number; total: number }>();
  for (const item of items) {
    const bucket = map.get(item.key) ?? { count: 0, total: 0 };
    bucket.count += 1;
    bucket.total += item.amount;
    map.set(item.key, bucket);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, count: v.count, total: v.total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Exporta un reporte a CSV — sección "Reportes" (Fase 11 del brief).
 * Todos los reportes respetan el mismo alcance por rol que el resto del
 * sistema: sin "*:view_all", un vendedor solo exporta sus propios datos.
 * El botón "Excel" del UI también llama a esta acción — CSV abre nativo en
 * Excel, así que no se agregó una librería de .xlsx solo para eso.
 */
export async function exportReportAction(reportKey: ReportKey): Promise<ExportReportResult> {
  const user = await requireUser();
  // Igual restricción que reports/page.tsx: Reportes expone datos
  // financieros de toda la agencia, reservado a Super Admin/Admin — nunca
  // confiar en que la UI ocultó el botón, se revalida acá.
  const isManager = user.roleName === "Super Admin" || user.roleName === "Admin";
  if (!isManager || !hasPermission(user, "reports", "export")) {
    return { ok: false, error: "No tienes permiso para exportar reportes." };
  }

  const scopeAgent = canViewAll(user) ? undefined : user.agentId ?? "__sin-agente__";
  const policyWhere = scopeAgent ? { agentId: scopeAgent } : undefined;
  const clientWhere = scopeAgent ? { agentId: scopeAgent } : undefined;
  const leadWhere = scopeAgent ? { agentId: scopeAgent } : undefined;
  // Mismo alcance que getActivitiesForUser (activities/data.ts): sin
  // "*:view_all", un vendedor ve lo que registró él mismo, o lo que está
  // ligado a un lead/cliente suyo aunque lo haya cargado otra persona.
  const activityWhere = canViewAll(user)
    ? undefined
    : {
        OR: [
          { userId: user.id },
          { lead: { agentId: user.agentId ?? "__sin-agente__" } },
          { client: { agentId: user.agentId ?? "__sin-agente__" } },
        ],
      };

  switch (reportKey) {
    case "ventas_mensuales": {
      const policies = await prisma.policy.findMany({ where: policyWhere, select: { saleDate: true, premium: true } });
      const grouped = groupSum(
        policies.filter((p) => p.saleDate).map((p) => ({ key: p.saleDate!.toISOString().slice(0, 7), amount: p.premium ?? 0 }))
      ).sort((a, b) => a.key.localeCompare(b.key));
      return {
        ok: true,
        filename: "ventas_mensuales.csv",
        csv: buildCsv(grouped, [
          { key: "key", label: "Mes" },
          { key: "count", label: "Pólizas" },
          { key: "total", label: "Prima total" },
        ]),
      };
    }

    case "ventas_por_vendedor": {
      const policies = await prisma.policy.findMany({ where: policyWhere, include: { agent: true } });
      const grouped = groupSum(policies.map((p) => ({ key: fullName(p.agent), amount: p.premium ?? 0 })));
      return {
        ok: true,
        filename: "ventas_por_vendedor.csv",
        csv: buildCsv(grouped, [
          { key: "key", label: "Vendedor" },
          { key: "count", label: "Pólizas" },
          { key: "total", label: "Prima total" },
        ]),
      };
    }

    case "ventas_por_linea": {
      const policies = await prisma.policy.findMany({ where: policyWhere, include: { insuranceLine: true } });
      const grouped = groupSum(policies.map((p) => ({ key: p.insuranceLine.name, amount: p.premium ?? 0 })));
      return {
        ok: true,
        filename: "ventas_por_linea.csv",
        csv: buildCsv(grouped, [
          { key: "key", label: "Línea de negocio" },
          { key: "count", label: "Pólizas" },
          { key: "total", label: "Prima total" },
        ]),
      };
    }

    case "ventas_por_carrier": {
      const policies = await prisma.policy.findMany({ where: policyWhere, include: { carrier: true } });
      const grouped = groupSum(policies.map((p) => ({ key: p.carrier.name, amount: p.premium ?? 0 })));
      return {
        ok: true,
        filename: "ventas_por_carrier.csv",
        csv: buildCsv(grouped, [
          { key: "key", label: "Carrier" },
          { key: "count", label: "Pólizas" },
          { key: "total", label: "Prima total" },
        ]),
      };
    }

    case "clientes_nuevos": {
      const clients = await prisma.client.findMany({
        where: clientWhere,
        include: { agent: true },
        orderBy: { createdAt: "desc" },
      });
      const rows = clients.map((c) => ({
        nombre: `${c.firstName} ${c.lastName}`,
        telefono: c.phone ?? "",
        email: c.email ?? "",
        vendedor: fullName(c.agent),
        clienteDesde: c.createdAt.toISOString().slice(0, 10),
      }));
      return {
        ok: true,
        filename: "clientes_nuevos.csv",
        csv: buildCsv(rows, [
          { key: "nombre", label: "Cliente" },
          { key: "telefono", label: "Teléfono" },
          { key: "email", label: "Email" },
          { key: "vendedor", label: "Vendedor" },
          { key: "clienteDesde", label: "Cliente desde" },
        ]),
      };
    }

    case "leads_generados": {
      const leads = await prisma.lead.findMany({
        where: leadWhere,
        include: { agent: true, source: true },
        orderBy: { createdAt: "desc" },
      });
      const rows = leads.map((l) => ({
        nombre: `${l.firstName} ${l.lastName}`,
        origen: l.source?.name ?? "Sin origen",
        vendedor: fullName(l.agent),
        creado: l.createdAt.toISOString().slice(0, 10),
        convertido: l.convertedClientId ? "Sí" : "No",
      }));
      return {
        ok: true,
        filename: "leads_generados.csv",
        csv: buildCsv(rows, [
          { key: "nombre", label: "Lead" },
          { key: "origen", label: "Origen" },
          { key: "vendedor", label: "Vendedor" },
          { key: "creado", label: "Creado" },
          { key: "convertido", label: "Convertido a cliente" },
        ]),
      };
    }

    case "conversion_leads": {
      const leads = await prisma.lead.findMany({ where: leadWhere, select: { convertedClientId: true } });
      const total = leads.length;
      const converted = leads.filter((l) => l.convertedClientId).length;
      const rate = total ? ((converted / total) * 100).toFixed(1) : "0.0";
      const rows = [{ total, convertidos: converted, tasa: `${rate}%` }];
      return {
        ok: true,
        filename: "conversion_leads.csv",
        csv: buildCsv(rows, [
          { key: "total", label: "Leads totales" },
          { key: "convertidos", label: "Convertidos a cliente" },
          { key: "tasa", label: "Tasa de conversión" },
        ]),
      };
    }

    case "clientes_antiguedad": {
      const clients = await prisma.client.findMany({ where: clientWhere, orderBy: { createdAt: "asc" } });
      const now = Date.now();
      const rows = clients.map((c) => ({
        nombre: `${c.firstName} ${c.lastName}`,
        clienteDesde: c.createdAt.toISOString().slice(0, 10),
        diasEnCartera: Math.floor((now - c.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      }));
      return {
        ok: true,
        filename: "clientes_por_antiguedad.csv",
        csv: buildCsv(rows, [
          { key: "nombre", label: "Cliente" },
          { key: "clienteDesde", label: "Cliente desde" },
          { key: "diasEnCartera", label: "Días en cartera" },
        ]),
      };
    }

    case "turning_65": {
      const clients = await prisma.client.findMany({ where: { ...clientWhere, dob: { not: null } } });
      const rows = clients
        .map((c) => {
          const dobIso = c.dob!.toISOString().slice(0, 10);
          const age = calculateAge(dobIso);
          const turns65 = new Date(c.dob!);
          turns65.setFullYear(c.dob!.getFullYear() + 65);
          return { nombre: `${c.firstName} ${c.lastName}`, edadActual: age, turns65On: turns65.toISOString().slice(0, 10) };
        })
        .filter((r) => r.edadActual < 66)
        .sort((a, b) => a.turns65On.localeCompare(b.turns65On));
      return {
        ok: true,
        filename: "turning_65.csv",
        csv: buildCsv(rows, [
          { key: "nombre", label: "Cliente" },
          { key: "edadActual", label: "Edad actual" },
          { key: "turns65On", label: "Cumple 65 el" },
        ]),
      };
    }

    case "polizas_activas":
    case "polizas_canceladas": {
      const status = reportKey === "polizas_activas" ? "ACTIVE" : "CANCELLED";
      const policies = await prisma.policy.findMany({
        where: { ...policyWhere, status },
        include: { client: true, insuranceLine: true, carrier: true, agent: true },
        orderBy: { createdAt: "desc" },
      });
      const rows = policies.map((p) => ({
        numero: p.policyNumber ?? "",
        cliente: `${p.client.firstName} ${p.client.lastName}`,
        linea: p.insuranceLine.name,
        carrier: p.carrier.name,
        prima: p.premium ?? 0,
        vendedor: fullName(p.agent),
      }));
      return {
        ok: true,
        filename: `${reportKey}.csv`,
        csv: buildCsv(rows, [
          { key: "numero", label: "Póliza" },
          { key: "cliente", label: "Cliente" },
          { key: "linea", label: "Línea" },
          { key: "carrier", label: "Carrier" },
          { key: "prima", label: "Prima" },
          { key: "vendedor", label: "Vendedor" },
        ]),
      };
    }

    case "comisiones":
    case "chargebacks": {
      const commissions = await prisma.commission.findMany({
        where: {
          ...(reportKey === "chargebacks" ? { status: "CHARGEBACK" } : {}),
          policy: policyWhere,
        },
        include: { policy: { include: { client: true, insuranceLine: true } } },
        orderBy: { createdAt: "desc" },
      });
      const rows = commissions.map((c) => ({
        poliza: c.policy.policyNumber ?? "",
        cliente: `${c.policy.client.firstName} ${c.policy.client.lastName}`,
        linea: c.policy.insuranceLine.name,
        vendedor: c.agentAmount ?? 0,
        margen: c.margin ?? 0,
        estado: c.status,
      }));
      return {
        ok: true,
        filename: `${reportKey}.csv`,
        csv: buildCsv(rows, [
          { key: "poliza", label: "Póliza" },
          { key: "cliente", label: "Cliente" },
          { key: "linea", label: "Línea" },
          { key: "vendedor", label: "Monto vendedor" },
          { key: "margen", label: "Margen" },
          { key: "estado", label: "Estado" },
        ]),
      };
    }

    case "margen": {
      const commissions = await prisma.commission.findMany({
        where: { policy: policyWhere },
        include: { policy: { include: { client: true, insuranceLine: true } } },
        orderBy: { createdAt: "desc" },
      });
      const rows = commissions.map((c) => ({
        poliza: c.policy.policyNumber ?? "",
        cliente: `${c.policy.client.firstName} ${c.policy.client.lastName}`,
        linea: c.policy.insuranceLine.name,
        carrierCommission: c.carrierCommission ?? 0,
        costoAdquisicion: c.totalAcquisitionCost ?? 0,
        margen: c.margin ?? 0,
      }));
      return {
        ok: true,
        filename: "margen.csv",
        csv: buildCsv(rows, [
          { key: "poliza", label: "Póliza" },
          { key: "cliente", label: "Cliente" },
          { key: "linea", label: "Línea" },
          { key: "carrierCommission", label: "Comisión del carrier" },
          { key: "costoAdquisicion", label: "Costo de adquisición" },
          { key: "margen", label: "Margen" },
        ]),
      };
    }

    case "actividades": {
      const activities = await prisma.activity.findMany({
        where: activityWhere,
        include: {
          user: true,
          lead: { select: { firstName: true, lastName: true } },
          client: { select: { firstName: true, lastName: true } },
        },
        orderBy: { occurredAt: "desc" },
      });
      const rows = activities.map((a) => ({
        fecha: a.occurredAt.toISOString().slice(0, 10),
        tipo: a.type,
        usuario: fullName(a.user),
        relacionadoCon: a.lead
          ? `${a.lead.firstName} ${a.lead.lastName}`
          : a.client
            ? `${a.client.firstName} ${a.client.lastName}`
            : "",
        resultado: a.result ?? "",
        notas: a.notes ?? "",
      }));
      return {
        ok: true,
        filename: "actividades.csv",
        csv: buildCsv(rows, [
          { key: "fecha", label: "Fecha" },
          { key: "tipo", label: "Tipo" },
          { key: "usuario", label: "Usuario" },
          { key: "relacionadoCon", label: "Relacionado con" },
          { key: "resultado", label: "Resultado" },
          { key: "notas", label: "Notas" },
        ]),
      };
    }

    case "productividad_vendedores": {
      const policies = await prisma.policy.findMany({ where: policyWhere, include: { agent: true } });
      const grouped = groupSum(policies.map((p) => ({ key: fullName(p.agent), amount: p.premium ?? 0 })));
      return {
        ok: true,
        filename: "productividad_vendedores.csv",
        csv: buildCsv(grouped, [
          { key: "key", label: "Vendedor" },
          { key: "count", label: "Pólizas vendidas" },
          { key: "total", label: "Prima total" },
        ]),
      };
    }

    default:
      return { ok: false, error: "Reporte desconocido." };
  }
}
