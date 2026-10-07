import "server-only";

import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { canManageFinance } from "@/lib/finance/access";
import { BUSINESS_TIME_ZONE } from "@/lib/finance/constants";
import { addMonths, monthLabel, resolvePeriod, todayIn } from "@/lib/finance/calc";
import type { FinancePageData, FinanceRecurringVM, FinanceTxVM } from "@/lib/finance/types";

const toYmd = (d: Date) => d.toISOString().slice(0, 10);
const dbDate = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;

/**
 * Datos del Control Financiero para un periodo. Se trae una ventana que
 * cubre el periodo, el periodo anterior (comparación) y los meses de la
 * gráfica de evolución, más todo lo pendiente de pago (de cualquier fecha).
 * Los cálculos se hacen después con src/lib/finance/calc.ts, en el
 * navegador, para que filtros y gráficos reaccionen al instante.
 */
export async function getFinancePageData(user: SessionUser, periodValue: string | undefined): Promise<FinancePageData> {
  const today = todayIn(BUSINESS_TIME_ZONE);
  const period = resolvePeriod(periodValue, today);
  const windowStart = [period.prevStart, `${period.evolutionMonths[0]}-01`].sort()[0];
  const windowEnd = period.end;

  const [manual, recurring, commissions, people] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: {
        OR: [
          { date: { gte: dbDate(windowStart), lt: dbDate(windowEnd) } },
          { kind: "EXPENSE", status: { in: ["PENDING", "SCHEDULED"] } },
        ],
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      // Nunca se manda el comprobante (data URL) al navegador: solo si existe.
      select: {
        id: true,
        kind: true,
        description: true,
        category: true,
        amount: true,
        date: true,
        paymentMethod: true,
        status: true,
        provider: true,
        notes: true,
        receiptFileName: true,
        recurringId: true,
        employeeUserId: true,
        employeeName: true,
        paymentType: true,
        createdAt: true,
        employee: { select: { role: { select: { name: true } } } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.financeRecurringExpense.findMany({ orderBy: [{ status: "asc" }, { nextPaymentDate: "asc" }] }),
    // Comisiones (módulo Comisiones): pagos a agentes y cobros a aseguradoras.
    prisma.commission.findMany({
      where: {
        status: { not: "CHARGEBACK" },
        OR: [
          { agentPaymentDate: { gte: dbDate(windowStart), lt: dbDate(windowEnd) } },
          { carrierPaymentDate: { gte: dbDate(windowStart), lt: dbDate(windowEnd) } },
          { status: "PENDING" },
        ],
      },
      select: {
        id: true,
        agentAmount: true,
        managerAmount: true,
        aorAmount: true,
        carrierCommission: true,
        agentPaymentDate: true,
        carrierPaymentDate: true,
        status: true,
        createdAt: true,
        policy: {
          select: {
            policyNumber: true,
            saleDate: true,
            agentId: true,
            agent: { select: { firstName: true, lastName: true, user: { select: { id: true } } } },
            insuranceLine: { select: { name: true } },
            carrier: { select: { name: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const transactions: FinanceTxVM[] = manual.map((t) => ({
    id: t.id,
    source: "manual",
    kind: t.kind,
    description: t.description,
    category: t.category,
    amount: t.amount,
    date: toYmd(t.date),
    paymentMethod: t.paymentMethod,
    status: t.status,
    provider: t.provider,
    notes: t.notes,
    hasReceipt: !!t.receiptFileName,
    receiptFileName: t.receiptFileName,
    recurringId: t.recurringId,
    employeeUserId: t.employeeUserId,
    employeeAgentId: null,
    employeeName: t.employeeName,
    employeeRole: t.employee?.role.name ?? null,
    paymentType: t.paymentType,
    createdByName: fullName(t.createdBy),
    createdAt: t.createdAt.toISOString(),
  }));

  for (const c of commissions) {
    const agentName = c.policy.agent ? fullName(c.policy.agent) : "Sin agente";
    const policyRef = c.policy.policyNumber ? `póliza ${c.policy.policyNumber}` : c.policy.insuranceLine?.name ?? "póliza";
    const payout = (c.agentAmount ?? 0) + (c.managerAmount ?? 0) + (c.aorAmount ?? 0);
    if (payout > 0) {
      const paid = c.status === "PAID";
      const date = paid && c.agentPaymentDate ? c.agentPaymentDate : c.policy.saleDate ?? c.createdAt;
      transactions.push({
        id: `com-${c.id}`,
        source: "commission",
        kind: "EXPENSE",
        description: `Comisión · ${policyRef}`,
        category: "AGENTS",
        amount: payout,
        date: toYmd(date),
        paymentMethod: null,
        status: paid ? "PAID" : "PENDING",
        provider: agentName,
        notes: null,
        hasReceipt: false,
        receiptFileName: null,
        recurringId: null,
        employeeUserId: c.policy.agent?.user?.id ?? null,
        employeeAgentId: c.policy.agentId,
        employeeName: agentName,
        employeeRole: "Agente",
        paymentType: "COMMISSION",
        createdByName: null,
        createdAt: c.createdAt.toISOString(),
      });
    }
    if ((c.carrierCommission ?? 0) > 0 && c.carrierPaymentDate) {
      transactions.push({
        id: `car-${c.id}`,
        source: "carrier",
        kind: "INCOME",
        description: `Comisión de aseguradora · ${policyRef}`,
        category: "COMMISSIONS",
        amount: c.carrierCommission ?? 0,
        date: toYmd(c.carrierPaymentDate),
        paymentMethod: null,
        status: "PAID",
        provider: c.policy.carrier?.name ?? null,
        notes: null,
        hasReceipt: false,
        receiptFileName: null,
        recurringId: null,
        employeeUserId: null,
        employeeAgentId: null,
        employeeName: null,
        employeeRole: null,
        paymentType: null,
        createdByName: null,
        createdAt: c.createdAt.toISOString(),
      });
    }
  }

  const recurringVM: FinanceRecurringVM[] = recurring.map((r) => ({
    id: r.id,
    description: r.description,
    category: r.category,
    amount: r.amount,
    frequency: r.frequency,
    intervalDays: r.intervalDays,
    nextPaymentDate: toYmd(r.nextPaymentDate),
    paymentMethod: r.paymentMethod,
    status: r.status,
    provider: r.provider,
    notes: r.notes,
  }));

  // Selector de periodo: los últimos 24 meses y los próximos 2.
  const monthOptions: { value: string; label: string }[] = [];
  for (let i = 2; i >= -23; i--) {
    const ym = addMonths(`${today.slice(0, 7)}-01`, i).slice(0, 7);
    monthOptions.push({ value: ym, label: monthLabel(ym) });
  }

  return {
    period,
    transactions,
    recurring: recurringVM,
    people: people.map((p) => ({ id: p.id, name: fullName(p), roleName: p.role.name })),
    canManage: await canManageFinance(user),
    monthOptions,
  };
}
