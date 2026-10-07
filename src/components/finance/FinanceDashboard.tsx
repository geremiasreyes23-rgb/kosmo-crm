"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Loader2,
  Pencil,
  PiggyBank,
  Plus,
  Receipt,
  Repeat,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeStatus } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { PersonChip } from "@/components/ui/PersonAvatar";
import { useNotifyToast } from "@/components/notifications/ToastNotificationProvider";
import { cn, formatCurrency } from "@/lib/utils";
import {
  EXPENSE_CATEGORIES,
  FINANCE_STATUSES,
  FREQUENCIES,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  categoryColor,
  categoryLabel,
  labelOf,
} from "@/lib/finance/constants";
import {
  EMPTY_FILTERS,
  addDays,
  applyFilters,
  daysBetween,
  distribution,
  effectiveRange,
  evolution,
  executiveSummary,
  hasActiveFilters,
  monthlyEquivalent,
  payables,
  pctChange,
  projection,
  teamSummary,
  totalsFor,
  upcomingPayments,
  type FinanceFilters,
} from "@/lib/finance/calc";
import type { FinancePageData, FinanceRecurringVM, FinanceTxVM } from "@/lib/finance/types";
import { markFinanceTransactionPaidAction, payRecurringExpenseAction } from "@/app/(app)/dashboard/finance-actions";
import { EvolutionChart, ExpenseDonut } from "./FinanceCharts";
import { TransactionModal } from "./TransactionModal";
import { RecurringModal } from "./RecurringModal";

const QUICK_RANGES = [
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Último mes" },
  { value: "last_3", label: "Últimos 3 meses" },
  { value: "this_year", label: "Este año" },
];

const STATUS_BADGE: Record<string, { label: string; status: BadgeStatus }> = {
  PAID: { label: "Pagado", status: "good" },
  PENDING: { label: "Pendiente", status: "warning" },
  SCHEDULED: { label: "Programado", status: "info" },
};

const shortDate = (ymd: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));

/**
 * Control Financiero — segunda vista del Dashboard. Recibe los movimientos
 * del periodo (ver finance-data.ts) y calcula TODO en el navegador con
 * src/lib/finance/calc.ts, así filtros, KPIs, gráficos, distribución,
 * proyección y resumen reaccionan al instante. Registrar / editar / eliminar
 * refresca solo los datos del servidor (router.refresh), sin recargar la página.
 */
export function FinanceDashboard({ data }: { data: FinancePageData }) {
  const router = useRouter();
  const { notify } = useNotifyToast();
  const [refreshing, startRefresh] = useTransition();
  const { period, canManage } = data;
  const today = period.today;

  const [filters, setFilters] = useState<FinanceFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [txModal, setTxModal] = useState<{ open: boolean; editing: FinanceTxVM | null; preset?: string }>({ open: false, editing: null });
  const [recModal, setRecModal] = useState<{ open: boolean; editing: FinanceRecurringVM | null }>({ open: false, editing: null });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);

  // ── Cálculos (todos reaccionan a los filtros) ──
  const filtered = useMemo(() => applyFilters(data.transactions, filters), [data.transactions, filters]);
  const recurringFiltered = useMemo(
    () => data.recurring.filter((r) => (!filters.category || r.category === filters.category) && (!filters.method || r.paymentMethod === filters.method)),
    [data.recurring, filters.category, filters.method]
  );
  const range = effectiveRange(period, filters);
  const prevRange = useMemo(() => {
    if (!filters.from && !filters.to) return { start: period.prevStart, end: period.prevEnd };
    const len = Math.max(1, daysBetween(range.start, range.end));
    return { start: addDays(range.start, -len), end: range.start };
  }, [filters.from, filters.to, period.prevStart, period.prevEnd, range.start, range.end]);

  const totals = useMemo(() => totalsFor(filtered, range.start, range.end), [filtered, range.start, range.end]);
  const prevTotals = useMemo(() => totalsFor(filtered, prevRange.start, prevRange.end), [filtered, prevRange]);
  const pay = useMemo(() => payables(filtered, today), [filtered, today]);
  const dist = useMemo(() => distribution(filtered, range.start, range.end), [filtered, range.start, range.end]);
  const evo = useMemo(() => evolution(filtered, period.evolutionMonths), [filtered, period.evolutionMonths]);
  const proj = useMemo(
    () => projection(filtered, recurringFiltered, range.start, range.end, today),
    [filtered, recurringFiltered, range.start, range.end, today]
  );
  const summary = useMemo(() => executiveSummary(filtered, range, prevRange, pay), [filtered, range, prevRange, pay]);
  const team = useMemo(() => teamSummary(filtered, range.start, range.end, totals.expenses), [filtered, range.start, range.end, totals.expenses]);
  const upcoming = useMemo(() => upcomingPayments(filtered, recurringFiltered, today), [filtered, recurringFiltered, today]);
  const movements = useMemo(
    () =>
      filtered
        .filter((t) => t.date >= range.start && t.date < range.end)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [filtered, range.start, range.end]
  );
  const providers = useMemo(
    () => Array.from(new Set(data.transactions.map((t) => t.provider).filter(Boolean) as string[])).sort(),
    [data.transactions]
  );

  const noData = data.transactions.length === 0 && data.recurring.length === 0;
  const activeFilterCount = Object.values(filters).filter((v) => v !== "").length;

  // ── Acciones ──
  function refresh(message?: string) {
    if (message) notify({ type: "finance", title: "Control Financiero", message, duration: 3500 });
    startRefresh(() => router.refresh());
  }
  function changePeriod(value: string) {
    router.push(`/dashboard?vista=finanzas&periodo=${encodeURIComponent(value)}`, { scroll: false });
  }
  async function markPaid(id: string) {
    setBusyKey(id);
    const r = await markFinanceTransactionPaidAction(id);
    setBusyKey(null);
    if (!r.ok) return notify({ type: "system_alert", title: "No se pudo actualizar", message: r.error ?? "" });
    refresh("Pago marcado como pagado.");
  }
  async function payRecurring(id: string) {
    setBusyKey(`rec-${id}`);
    const r = await payRecurringExpenseAction(id);
    setBusyKey(null);
    if (!r.ok) return notify({ type: "system_alert", title: "No se pudo registrar", message: r.error ?? "" });
    refresh("Pago registrado. Se programó el siguiente vencimiento.");
  }
  const openNewExpense = (preset?: string) => setTxModal({ open: true, editing: null, preset });

  const inc = pctChange(totals.income, prevTotals.income);
  const exp = pctChange(totals.expenses, prevTotals.expenses);

  return (
    <div className="animate-kosmo-fade-in-up space-y-5">
      {/* ─────────── Header ─────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-[var(--ink-primary)]">
            Control Financiero
            {refreshing && <Loader2 className="h-4 w-4 animate-spin text-[var(--ink-muted)]" />}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
            Una visión completa de los ingresos, gastos y rentabilidad de tu empresa.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">Periodo</span>
            <Select value={period.value} onChange={(e) => changePeriod(e.target.value)} className="w-56">
              <optgroup label="Rápido">
                {QUICK_RANGES.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Por mes">
                {data.monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            </Select>
          </label>
          {canManage && (
            <Button onClick={() => openNewExpense()} className="h-9">
              <Plus className="h-4 w-4" /> Registrar gasto
            </Button>
          )}
        </div>
      </div>

      {/* ─────────── Filtros ─────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
            <Input
              placeholder="Buscar concepto o proveedor..."
              className="rounded-full pl-9"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowFilters((v) => !v)} className="rounded-full">
            <Filter className="h-4 w-4" /> Filtros
            {activeFilterCount > 0 && (
              <span className="ml-1 rounded-full bg-[var(--brand-500)] px-1.5 text-[11px] font-semibold text-white">{activeFilterCount}</span>
            )}
          </Button>
          {hasActiveFilters(filters) && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            >
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </button>
          )}
          <span className="ml-auto text-xs text-[var(--ink-muted)]">{period.label}</span>
        </div>
        {showFilters && (
          <Card className="animate-kosmo-fade-in grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label="Categoría">
              <Select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                <option value="">Todas</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Estado">
              <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">Todos</option>
                {FINANCE_STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Tipo de gasto">
              <Select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value as FinanceFilters["type"] })}>
                <option value="">Todos</option>
                <option value="recurring">Recurrentes</option>
                <option value="variable">Variables</option>
                <option value="team">Nómina y agentes</option>
                <option value="automatic">Automáticos (comisiones)</option>
              </Select>
            </FilterField>
            <FilterField label="Método de pago">
              <Select value={filters.method} onChange={(e) => setFilters({ ...filters, method: e.target.value })}>
                <option value="">Todos</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Proveedor">
              <Input
                list="finance-providers"
                value={filters.provider}
                onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
                placeholder="Cualquiera"
              />
              <datalist id="finance-providers">
                {providers.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </FilterField>
            <FilterField label="Desde">
              <Input type="date" value={filters.from} min={period.start} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            </FilterField>
            <FilterField label="Hasta">
              <Input type="date" value={filters.to} max={addDays(period.end, -1)} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            </FilterField>
            <p className="self-end text-[11px] text-[var(--ink-muted)]">
              Los filtros de gasto no afectan a los ingresos; el rango de fechas, sí.
            </p>
          </Card>
        )}
      </div>

      {/* ─────────── KPIs ─────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ingresos del periodo"
          value={totals.income}
          icon={Wallet}
          tone="good"
          footer={<DeltaText value={inc} goodWhenUp />}
        />
        <KpiCard
          label="Gastos del periodo"
          value={totals.expenses}
          icon={Receipt}
          tone="warning"
          footer={<DeltaText value={exp} goodWhenUp={false} />}
        />
        <KpiCard
          label="Ganancia neta"
          value={totals.net}
          icon={PiggyBank}
          tone={totals.net >= 0 ? "brand" : "critical"}
          highlight
          footer={
            <span className="text-xs text-[var(--ink-secondary)]">
              {totals.margin === null ? "Sin ingresos para calcular el margen" : (
                <>
                  Margen neto: <strong className="tabular-nums">{totals.margin.toFixed(1)}%</strong>
                </>
              )}
            </span>
          }
        />
        <KpiCard
          label="Por pagar"
          value={pay.amount}
          icon={Clock}
          tone={pay.overdue ? "critical" : "neutral"}
          footer={
            <span className="text-xs text-[var(--ink-secondary)]">
              {pay.count === 0 ? "Sin pagos pendientes" : `${pay.count} ${pay.count === 1 ? "pago pendiente" : "pagos pendientes"}`}
              {pay.overdue > 0 && <span className="ml-1 font-semibold text-[var(--status-critical)]">· {pay.overdue} vencido{pay.overdue === 1 ? "" : "s"}</span>}
            </span>
          }
        />
      </div>

      {noData && (
        <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-50)] text-[var(--brand-600)]">
            <Receipt className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-base font-semibold">Aún no hay movimientos registrados</h3>
            <p className="mt-1 max-w-md text-sm text-[var(--ink-muted)]">
              Registra tu primer gasto para comenzar a visualizar el comportamiento financiero de tu empresa.
            </p>
          </div>
          {canManage && (
            <Button onClick={() => openNewExpense()}>
              <Plus className="h-4 w-4" /> Registrar gasto
            </Button>
          )}
        </Card>
      )}

      {/* ─────────── Gráficos ─────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Section className="xl:col-span-3" title="Evolución financiera" icon={TrendingUp} subtitle="Ingresos, gastos y ganancia neta por mes">
          <EvolutionChart data={evo} />
        </Section>
        <Section className="xl:col-span-2" title="Distribución de gastos" icon={Receipt} subtitle="Cómo se reparte el gasto del periodo">
          <ExpenseDonut data={dist} total={totals.expenses} />
        </Section>
      </div>

      {/* ─────────── Análisis ─────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Proyección de cierre" icon={CalendarClock} subtitle={proj.basis}>
          {proj.mode === "empty" ? (
            <EmptyText text="La proyección aparece cuando hay movimientos o gastos recurrentes en el periodo." />
          ) : (
            <div className="space-y-4">
              {proj.mode === "running" && (
                <div>
                  <div className="mb-1 flex justify-between text-xs text-[var(--ink-muted)]">
                    <span>Avance del periodo</span>
                    <span className="tabular-nums">{proj.elapsedPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                    <div className="h-full rounded-full bg-[var(--brand-500)] transition-[width] duration-500" style={{ width: `${proj.elapsedPct}%` }} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <ProjCell label="Ingresos actuales" value={proj.incomeNow} />
                <ProjCell label="Ingresos proyectados" value={proj.incomeProjected} accent />
                <ProjCell label="Gastos actuales" value={proj.expensesNow} />
                <ProjCell label="Gastos proyectados" value={proj.expensesProjected} accent />
              </div>
              <div
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-3",
                  proj.netProjected >= 0 ? "bg-[var(--status-good-bg)]" : "bg-[var(--status-critical-bg)]"
                )}
              >
                <span className="text-sm font-medium text-[var(--ink-secondary)]">
                  {proj.mode === "closed" ? "Ganancia final" : "Ganancia proyectada"}
                </span>
                <span
                  className={cn(
                    "text-xl font-semibold tabular-nums",
                    proj.netProjected >= 0 ? "text-[var(--status-good)]" : "text-[var(--status-critical)]"
                  )}
                >
                  {formatCurrency(proj.netProjected)}
                </span>
              </div>
              {proj.recurringRemaining > 0 && (
                <p className="text-xs text-[var(--ink-muted)]">
                  Incluye {formatCurrency(proj.recurringRemaining)} de gastos recurrentes que faltan por vencer.
                </p>
              )}
            </div>
          )}
        </Section>
        <Section title="Resumen del negocio" icon={Sparkles} subtitle="Generado con los datos registrados del periodo">
          {summary ? (
            <ul className="space-y-2.5">
              {summary.map((line) => (
                <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-[var(--ink-secondary)]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-500)]" />
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyText text="Todavía no hay suficientes datos en este periodo para generar un resumen." />
          )}
        </Section>
      </div>

      {/* ─────────── Operación ─────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          title="Gastos recurrentes"
          icon={Repeat}
          subtitle={
            data.recurring.length
              ? `Equivalen a ${formatCurrency(
                  data.recurring.filter((r) => r.status === "ACTIVE").reduce((s, r) => s + monthlyEquivalent(r), 0)
                )} al mes`
              : "Nómina, internet, software, alquiler..."
          }
          action={
            canManage && (
              <Button size="sm" variant="secondary" onClick={() => setRecModal({ open: true, editing: null })}>
                <Plus className="h-4 w-4" /> Nuevo
              </Button>
            )
          }
        >
          {recurringFiltered.length === 0 ? (
            <EmptyText text="Registra los gastos que se repiten para verlos aquí y en la proyección." />
          ) : (
            <ul className="divide-y divide-[var(--border-hairline)]">
              {recurringFiltered.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor(r.category) }} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium", r.status === "PAUSED" && "text-[var(--ink-muted)] line-through")}>
                      {r.description}
                    </p>
                    <p className="truncate text-xs text-[var(--ink-muted)]">
                      {categoryLabel(r.category)} · {labelOf(FREQUENCIES, r.frequency)}
                      {r.frequency === "CUSTOM" && r.intervalDays ? ` (cada ${r.intervalDays} días)` : ""}
                      {r.status === "ACTIVE" ? ` · próximo ${shortDate(r.nextPaymentDate)}` : " · pausado"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(r.amount)}</span>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      {r.status === "ACTIVE" && (
                        <IconButton title="Registrar pago" onClick={() => payRecurring(r.id)} busy={busyKey === `rec-${r.id}`}>
                          <CheckCircle2 className="h-4 w-4" />
                        </IconButton>
                      )}
                      <IconButton title="Editar" onClick={() => setRecModal({ open: true, editing: r })}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Nómina y agentes"
          icon={Users}
          subtitle={
            team.total > 0
              ? `El equipo representa ${formatCurrency(team.total)}${team.pctOfExpenses !== null ? ` (${team.pctOfExpenses.toFixed(0)}% del gasto)` : ""}`
              : "Pagos a personal y comisiones a agentes del periodo"
          }
          action={
            canManage && (
              <Button size="sm" variant="secondary" onClick={() => openNewExpense("PAYROLL")}>
                <Plus className="h-4 w-4" /> Registrar pago
              </Button>
            )
          }
        >
          {team.rows.length === 0 ? (
            <EmptyText text="Aquí aparecen los pagos de nómina y las comisiones de agentes del periodo." />
          ) : (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2 text-center">
                <MiniStat label="Pagado" value={team.paid} tone="good" />
                <MiniStat label="Pendiente" value={team.pending} tone="warning" />
              </div>
              <ul className="max-h-80 divide-y divide-[var(--border-hairline)] overflow-y-auto">
                {team.rows.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <PersonChip
                        name={t.employeeName ?? t.provider ?? t.description}
                        person={{ userId: t.employeeUserId, agentId: t.employeeAgentId }}
                        size={26}
                        className="text-sm font-medium"
                      />
                      <p className="mt-0.5 truncate pl-8 text-xs text-[var(--ink-muted)]">
                        {t.employeeRole ?? categoryLabel(t.category)} · {labelOf(PAYMENT_TYPES, t.paymentType) || categoryLabel(t.category)} ·{" "}
                        {shortDate(t.date)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(t.amount)}</span>
                    <Badge status={STATUS_BADGE[t.status].status}>{STATUS_BADGE[t.status].label}</Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      </div>

      {/* ─────────── Movimientos ─────────── */}
      <Section title="Movimientos recientes" icon={FileText} subtitle={`${movements.length} movimientos en el periodo`}>
        {movements.length === 0 ? (
          <EmptyText text={hasActiveFilters(filters) ? "Ningún movimiento coincide con los filtros." : "Aún no hay movimientos en este periodo."} />
        ) : (
          <div className="-mx-5 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border-grid)] text-left text-xs uppercase tracking-wide text-[var(--ink-muted)]">
                  <th className="px-3 py-2.5 font-medium">Fecha</th>
                  <th className="px-3 py-2.5 font-medium">Concepto</th>
                  <th className="px-3 py-2.5 font-medium">Categoría</th>
                  <th className="px-3 py-2.5 font-medium">Proveedor</th>
                  <th className="px-3 py-2.5 text-right font-medium">Monto</th>
                  <th className="px-3 py-2.5 font-medium">Estado</th>
                  <th className="px-3 py-2.5 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(showAllRows ? movements : movements.slice(0, 15)).map((t) => (
                  <tr key={t.id} className="border-b border-[var(--border-grid)] last:border-0 hover:bg-[var(--surface-hover)]">
                    <td className="whitespace-nowrap px-3 py-2.5 text-[var(--ink-secondary)]">{shortDate(t.date)}</td>
                    <td className="max-w-[260px] px-3 py-2.5">
                      <p className="truncate font-medium">{t.description}</p>
                      {(t.recurringId || t.source !== "manual") && (
                        <p className="text-[11px] text-[var(--ink-muted)]">
                          {t.source === "commission" ? "Automático · Comisiones" : t.source === "carrier" ? "Automático · Aseguradora" : "Recurrente"}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[var(--ink-secondary)]">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.kind === "INCOME" ? "var(--status-good)" : categoryColor(t.category) }} />
                        {categoryLabel(t.category)}
                      </span>
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2.5 text-[var(--ink-secondary)]">{t.provider ?? "—"}</td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums",
                        t.kind === "INCOME" ? "text-[var(--status-good)]" : "text-[var(--ink-primary)]"
                      )}
                    >
                      {t.kind === "INCOME" ? "+" : "−"}
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge status={STATUS_BADGE[t.status].status}>
                        {t.kind === "INCOME" && t.status === "PAID" ? "Cobrado" : STATUS_BADGE[t.status].label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        {t.hasReceipt && (
                          <a
                            href={`/api/finance/receipt?id=${t.id}`}
                            target="_blank"
                            rel="noreferrer"
                            title={t.receiptFileName ?? "Comprobante"}
                            className="rounded-md p-1.5 text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink-primary)]"
                          >
                            <FileText className="h-4 w-4" />
                          </a>
                        )}
                        {canManage && t.source === "manual" && t.status !== "PAID" && (
                          <IconButton title="Marcar como pagado" onClick={() => markPaid(t.id)} busy={busyKey === t.id}>
                            <CheckCircle2 className="h-4 w-4" />
                          </IconButton>
                        )}
                        {canManage && t.source === "manual" && (
                          <IconButton title="Editar o eliminar" onClick={() => setTxModal({ open: true, editing: t })}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movements.length > 15 && (
              <div className="pt-3 text-center">
                <Button variant="secondary" size="sm" onClick={() => setShowAllRows((v) => !v)}>
                  {showAllRows ? "Ver menos" : `Ver los ${movements.length} movimientos`}
                </Button>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ─────────── Próximos pagos ─────────── */}
      <Section title="Próximos pagos" icon={CalendarClock} subtitle="Pendientes, programados y recurrentes de los próximos 45 días">
        {upcoming.length === 0 ? (
          <EmptyText text="No hay pagos pendientes ni vencimientos próximos." />
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {upcoming.slice(0, 18).map((u) => {
              const overdue = !u.aggregate && u.daysLeft < 0;
              const soon = !u.aggregate && !overdue && u.daysLeft <= 3;
              return (
                <li
                  key={u.key}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                    overdue
                      ? "border-[var(--status-critical)]/50 bg-[var(--status-critical-bg)]/50"
                      : soon
                        ? "border-[var(--status-warning)]/50 bg-[var(--status-warning-bg)]/50"
                        : "border-[var(--border-hairline)]"
                  )}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor(u.category) }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.description}</p>
                    <p
                      className={cn(
                        "flex items-center gap-1 text-xs",
                        overdue ? "font-semibold text-[var(--status-critical)]" : soon ? "font-semibold text-[var(--status-warning)]" : "text-[var(--ink-muted)]"
                      )}
                    >
                      {(overdue || soon) && <AlertTriangle className="h-3 w-3" />}
                      {u.aggregate
                        ? "Se pagan desde el módulo Comisiones"
                        : overdue
                        ? `Vencido hace ${Math.abs(u.daysLeft)} día${Math.abs(u.daysLeft) === 1 ? "" : "s"}`
                        : u.daysLeft === 0
                          ? "Vence hoy"
                          : `${shortDate(u.date)} · en ${u.daysLeft} día${u.daysLeft === 1 ? "" : "s"}`}
                      {!u.aggregate && (
                        <>
                          {" · "}
                          {u.status === "RECURRING" ? "Recurrente" : u.status === "SCHEDULED" ? "Programado" : "Pendiente"}
                        </>
                      )}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(u.amount)}</span>
                  {canManage && u.txId && (
                    <IconButton title="Marcar como pagado" onClick={() => markPaid(u.txId!)} busy={busyKey === u.txId}>
                      <CheckCircle2 className="h-4 w-4" />
                    </IconButton>
                  )}
                  {canManage && u.recurringId && (
                    <IconButton title="Registrar pago" onClick={() => payRecurring(u.recurringId!)} busy={busyKey === `rec-${u.recurringId}`}>
                      <CheckCircle2 className="h-4 w-4" />
                    </IconButton>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <TransactionModal
        open={txModal.open}
        editing={txModal.editing}
        presetCategory={txModal.preset}
        today={today}
        people={data.people}
        onClose={() => setTxModal({ open: false, editing: null })}
        onSaved={(msg) => {
          setTxModal({ open: false, editing: null });
          refresh(msg);
        }}
      />
      <RecurringModal
        open={recModal.open}
        editing={recModal.editing}
        today={today}
        onClose={() => setRecModal({ open: false, editing: null })}
        onSaved={(msg) => {
          setRecModal({ open: false, editing: null });
          refresh(msg);
        }}
      />
    </div>
  );
}

// ───────────────────────────── Piezas ─────────────────────────────

const KPI_TONES = {
  good: "bg-[var(--status-good-bg)] text-[var(--status-good)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  critical: "bg-[var(--status-critical-bg)] text-[var(--status-critical)]",
  neutral: "bg-[var(--surface-sunken)] text-[var(--ink-secondary)]",
  brand: "bg-[var(--brand-500)] text-white",
} as const;

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  footer,
  highlight,
}: {
  label: string;
  value: number;
  icon: typeof Wallet;
  tone: keyof typeof KPI_TONES;
  footer: ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md",
        highlight && "ring-2 ring-[var(--brand-500)]/30"
      )}
    >
      {highlight && (
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--brand-500)] opacity-[0.08] blur-2xl" />
      )}
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110",
            KPI_TONES[tone]
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <p
        className={cn(
          "mt-2 font-semibold tabular-nums tracking-tight text-[var(--ink-primary)]",
          highlight ? "text-[32px] leading-tight" : "text-[28px] leading-tight",
          value < 0 && "text-[var(--status-critical)]"
        )}
      >
        {formatCurrency(value)}
      </p>
      <div className="mt-1.5">{footer}</div>
    </Card>
  );
}

/** "↑ 12.4% vs. periodo anterior" — verde si el cambio es bueno para el negocio. */
function DeltaText({ value, goodWhenUp }: { value: number | null; goodWhenUp: boolean }) {
  if (value === null) return <span className="text-xs text-[var(--ink-muted)]">Sin datos del periodo anterior</span>;
  const up = value > 0;
  const good = value === 0 ? null : up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums",
          good === null ? "bg-[var(--surface-sunken)] text-[var(--ink-secondary)]" : good ? "bg-[var(--status-good-bg)] text-[var(--status-good)]" : "bg-[var(--status-critical-bg)] text-[var(--status-critical)]"
        )}
      >
        {value !== 0 && <Icon className="h-3 w-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
      <span className="text-[var(--ink-muted)]">vs. periodo anterior</span>
    </span>
  );
}

function Section({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon: typeof Wallet;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-50)] text-[var(--brand-600)]">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--ink-primary)]">{title}</h3>
            {subtitle && <p className="text-xs text-[var(--ink-muted)]">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function ProjCell({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl px-3 py-2.5", accent ? "bg-[var(--brand-50)]" : "bg-[var(--surface-sunken)]")}>
      <p className="text-[11px] text-[var(--ink-muted)]">{label}</p>
      <p className="text-base font-semibold tabular-nums">{formatCurrency(value)}</p>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "good" | "warning" }) {
  return (
    <div className={cn("rounded-xl px-3 py-2", tone === "good" ? "bg-[var(--status-good-bg)]" : "bg-[var(--status-warning-bg)]")}>
      <p className="text-[11px] text-[var(--ink-secondary)]">{label}</p>
      <p className={cn("text-sm font-semibold tabular-nums", tone === "good" ? "text-[var(--status-good)]" : "text-[var(--status-warning)]")}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-grid)] px-4 py-8 text-center text-sm text-[var(--ink-muted)]">{text}</div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">{label}</span>
      {children}
    </label>
  );
}

function IconButton({ title, onClick, busy, children }: { title: string; onClick: () => void; busy?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={busy}
      className="rounded-md p-1.5 text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--brand-600)] disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}
