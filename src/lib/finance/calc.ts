/**
 * Control Financiero — TODOS los cálculos, en funciones puras (sin base de
 * datos ni React), para que el servidor y el navegador den exactamente los
 * mismos números y se puedan probar aisladamente.
 *
 *   Ganancia neta = Ingresos − Gastos
 *   Margen neto   = Ganancia neta / Ingresos × 100
 *
 * Definiciones:
 *  - Ingresos del periodo: ingresos COBRADOS (estado Pagado) con fecha en el periodo.
 *  - Gastos del periodo: todos los gastos con fecha en el periodo (pagados,
 *    pendientes y programados) — es lo que el periodo cuesta, se haya pagado o no.
 *  - Por pagar: todos los gastos Pendientes/Programados, de cualquier fecha.
 */

import { EXPENSE_CATEGORIES, TEAM_CATEGORIES, categoryLabel, type FinanceFrequencyValue } from "./constants";
import type { FinanceRecurringVM, FinanceTxVM, PeriodKey, ResolvedPeriod } from "./types";

// ───────────────────────────── Fechas (YYYY-MM-DD) ─────────────────────────────

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n: number) => String(n).padStart(2, "0");

export function ymd(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
export function parse(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return { y, m, d: d || 1 };
}
export function addDays(s: string, days: number): string {
  const { y, m, d } = parse(s);
  return ymd(y, m, d + days);
}
export function addMonths(s: string, months: number): string {
  const { y, m, d } = parse(s);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return ymd(y, m + months, Math.min(d, lastDay));
}
export function daysBetween(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}
export const monthStart = (s: string) => `${s.slice(0, 7)}-01`;
export const monthLabel = (ym: string) => `${cap(MONTHS[Number(ym.slice(5, 7)) - 1])} ${ym.slice(0, 4)}`;
export const monthShort = (ym: string) => MONTHS_SHORT[Number(ym.slice(5, 7)) - 1];
const inRange = (date: string, start: string, end: string) => date >= start && date < end;

/** "Hoy" en la zona horaria del negocio. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// ───────────────────────────── Periodos ─────────────────────────────

/**
 * Convierte el valor de la URL ("2026-10", "this_month", "last_3"...) en un
 * rango [start, end), el periodo anterior de la misma duración y los meses
 * de la gráfica de evolución.
 */
export function resolvePeriod(value: string | undefined, today: string): ResolvedPeriod {
  const thisMonth = monthStart(today);
  let start = thisMonth;
  let end = addMonths(thisMonth, 1);
  let label = monthLabel(today.slice(0, 7));
  let v: string = "this_month";
  let prevStart = addMonths(start, -1);

  const key = (value ?? "this_month") as PeriodKey | string;
  if (/^\d{4}-\d{2}$/.test(key)) {
    start = `${key}-01`;
    end = addMonths(start, 1);
    prevStart = addMonths(start, -1);
    label = monthLabel(key);
    v = key;
  } else if (key === "last_month") {
    start = addMonths(thisMonth, -1);
    end = thisMonth;
    prevStart = addMonths(start, -1);
    label = `Último mes · ${monthLabel(start.slice(0, 7))}`;
    v = key;
  } else if (key === "last_3") {
    start = addMonths(thisMonth, -2);
    end = addMonths(thisMonth, 1);
    prevStart = addMonths(start, -3);
    label = "Últimos 3 meses";
    v = key;
  } else if (key === "this_year") {
    start = `${today.slice(0, 4)}-01-01`;
    end = `${Number(today.slice(0, 4)) + 1}-01-01`;
    prevStart = `${Number(today.slice(0, 4)) - 1}-01-01`;
    label = `Este año · ${today.slice(0, 4)}`;
    v = key;
  } else {
    label = `Este mes · ${label}`;
  }

  // Evolución: los últimos 6 meses que terminan en el mes final del periodo
  // (o todos los meses del año si el periodo es "Este año").
  const lastMonth = addMonths(end, -1).slice(0, 7);
  const count = key === "this_year" ? 12 : 6;
  const evolutionMonths: string[] = [];
  for (let i = count - 1; i >= 0; i--) evolutionMonths.push(addMonths(`${lastMonth}-01`, -i).slice(0, 7));

  return {
    value: v,
    label,
    start,
    end,
    prevStart,
    prevEnd: start,
    evolutionMonths,
    containsToday: inRange(today, start, end),
    today,
  };
}

// ───────────────────────────── Filtros ─────────────────────────────

export interface FinanceFilters {
  category: string; // "" = todas
  status: string;
  method: string;
  type: "" | "recurring" | "variable" | "team" | "automatic";
  provider: string; // búsqueda parcial
  search: string; // concepto/proveedor
  from: string; // "" = inicio del periodo
  to: string; // "" = fin del periodo (inclusive)
}

export const EMPTY_FILTERS: FinanceFilters = {
  category: "",
  status: "",
  method: "",
  type: "",
  provider: "",
  search: "",
  from: "",
  to: "",
};

export function hasActiveFilters(f: FinanceFilters): boolean {
  return Object.values(f).some((v) => v !== "");
}

/** Aplica los filtros a los GASTOS. Los ingresos solo se ven afectados por
 * el rango de fechas (una categoría de gasto no aplica a un ingreso). */
export function applyFilters(txs: FinanceTxVM[], f: FinanceFilters): FinanceTxVM[] {
  const q = f.search.trim().toLowerCase();
  const prov = f.provider.trim().toLowerCase();
  return txs.filter((t) => {
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (t.kind === "INCOME") return !f.category && !f.status && !f.method && !f.type && !prov && !q;
    if (f.category && t.category !== f.category) return false;
    if (f.status && t.status !== f.status) return false;
    if (f.method && t.paymentMethod !== f.method) return false;
    if (f.type === "recurring" && !t.recurringId) return false;
    if (f.type === "variable" && (t.recurringId || t.source !== "manual")) return false;
    if (f.type === "team" && !TEAM_CATEGORIES.includes(t.category)) return false;
    if (f.type === "automatic" && t.source === "manual") return false;
    if (prov && !(t.provider ?? t.employeeName ?? "").toLowerCase().includes(prov)) return false;
    if (q && !`${t.description} ${t.provider ?? ""} ${t.employeeName ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Rango efectivo: el periodo, recortado por "desde/hasta" si se usan. */
export function effectiveRange(p: ResolvedPeriod, f: FinanceFilters): { start: string; end: string } {
  const start = f.from && f.from > p.start ? f.from : p.start;
  const end = f.to && addDays(f.to, 1) < p.end ? addDays(f.to, 1) : p.end;
  return { start, end };
}

// ───────────────────────────── KPIs ─────────────────────────────

export interface Totals {
  income: number;
  expenses: number;
  net: number;
  /** null si no hubo ingresos (no se puede calcular). */
  margin: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function totalsFor(txs: FinanceTxVM[], start: string, end: string): Totals {
  let income = 0;
  let expenses = 0;
  for (const t of txs) {
    if (!inRange(t.date, start, end)) continue;
    if (t.kind === "INCOME") {
      if (t.status === "PAID") income += t.amount;
    } else {
      expenses += t.amount;
    }
  }
  const net = income - expenses;
  return { income: round2(income), expenses: round2(expenses), net: round2(net), margin: income > 0 ? (net / income) * 100 : null };
}

/** % de cambio; null si no hay base para comparar. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export interface Payables {
  amount: number;
  count: number;
  overdue: number;
}

export function payables(txs: FinanceTxVM[], today: string): Payables {
  let amount = 0;
  let count = 0;
  let overdue = 0;
  for (const t of txs) {
    if (t.kind !== "EXPENSE" || t.status === "PAID") continue;
    amount += t.amount;
    count++;
    // Las comisiones a agentes no tienen fecha límite: no cuentan como vencidas.
    if (t.date < today && t.source === "manual") overdue++;
  }
  return { amount: round2(amount), count, overdue };
}

// ───────────────────────────── Distribución ─────────────────────────────

export interface CategorySlice {
  key: string;
  label: string;
  color: string;
  amount: number;
  pct: number;
}

/** Gasto por categoría en el rango, en el orden fijo de las categorías. */
export function distribution(txs: FinanceTxVM[], start: string, end: string): CategorySlice[] {
  const by = new Map<string, number>();
  let total = 0;
  for (const t of txs) {
    if (t.kind !== "EXPENSE" || !inRange(t.date, start, end)) continue;
    by.set(t.category, (by.get(t.category) ?? 0) + t.amount);
    total += t.amount;
  }
  if (total <= 0) return [];
  return EXPENSE_CATEGORIES.filter((c) => (by.get(c.key) ?? 0) > 0).map((c) => ({
    key: c.key,
    label: c.label,
    color: c.color,
    amount: round2(by.get(c.key) ?? 0),
    pct: ((by.get(c.key) ?? 0) / total) * 100,
  }));
}

// ───────────────────────────── Evolución ─────────────────────────────

export interface MonthPoint {
  month: string;
  label: string;
  ingresos: number;
  gastos: number;
  ganancia: number;
}

export function evolution(txs: FinanceTxVM[], months: string[]): MonthPoint[] {
  return months.map((ym) => {
    const start = `${ym}-01`;
    const t = totalsFor(txs, start, addMonths(start, 1));
    return { month: ym, label: monthShort(ym), ingresos: t.income, gastos: t.expenses, ganancia: t.net };
  });
}

// ───────────────────────────── Recurrentes ─────────────────────────────

export function nextOccurrence(date: string, frequency: FinanceFrequencyValue, intervalDays: number | null): string {
  switch (frequency) {
    case "WEEKLY":
      return addDays(date, 7);
    case "YEARLY":
      return addMonths(date, 12);
    case "CUSTOM":
      return addDays(date, Math.max(1, intervalDays ?? 30));
    default:
      return addMonths(date, 1);
  }
}

/** Equivalente mensual de un gasto recurrente. */
export function monthlyEquivalent(r: Pick<FinanceRecurringVM, "amount" | "frequency" | "intervalDays">): number {
  switch (r.frequency) {
    case "WEEKLY":
      return (r.amount * 52) / 12;
    case "YEARLY":
      return r.amount / 12;
    case "CUSTOM":
      return (r.amount * 30.4) / Math.max(1, r.intervalDays ?? 30);
    default:
      return r.amount;
  }
}

/** Ocurrencias aún no registradas de los recurrentes activos en [from, to). */
export function recurringOccurrences(
  recurring: FinanceRecurringVM[],
  from: string,
  to: string
): { recurring: FinanceRecurringVM; date: string }[] {
  const out: { recurring: FinanceRecurringVM; date: string }[] = [];
  for (const r of recurring) {
    if (r.status !== "ACTIVE") continue;
    let d = r.nextPaymentDate;
    let guard = 0;
    while (d < to && guard++ < 400) {
      if (d >= from) out.push({ recurring: r, date: d });
      d = nextOccurrence(d, r.frequency, r.intervalDays);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ───────────────────────────── Proyección ─────────────────────────────

export interface Projection {
  available: boolean;
  /** "closed" = periodo terminado (proyección = real); "future" = aún no empieza. */
  mode: "running" | "closed" | "future" | "empty";
  incomeNow: number;
  expensesNow: number;
  incomeProjected: number;
  expensesProjected: number;
  netProjected: number;
  elapsedPct: number;
  recurringRemaining: number;
  basis: string;
}

/**
 * Proyección de cierre del periodo, basada en lo registrado:
 *  - Ingresos: ritmo diario de lo cobrado hasta hoy, extendido al resto del
 *    periodo (solo si ya pasaron al menos 3 días; antes no es confiable).
 *  - Gastos: lo ya registrado + los gastos recurrentes que vencen en lo que
 *    queda del periodo + el ritmo de los gastos variables hasta hoy.
 */
export function projection(txs: FinanceTxVM[], recurring: FinanceRecurringVM[], start: string, end: string, today: string): Projection {
  const now = totalsFor(txs, start, end);
  const base = {
    incomeNow: now.income,
    expensesNow: now.expenses,
    recurringRemaining: 0,
  };
  const hasData = now.income > 0 || now.expenses > 0;
  const totalDays = Math.max(1, daysBetween(start, end));

  if (today >= end) {
    return { ...base, available: hasData, mode: hasData ? "closed" : "empty", incomeProjected: now.income, expensesProjected: now.expenses, netProjected: now.net, elapsedPct: 100, basis: "El periodo ya cerró: estos son los valores finales." };
  }

  const remainingRecurring = recurringOccurrences(recurring, today > start ? addDays(today, 1) : start, end).reduce(
    (s, o) => s + o.recurring.amount,
    0
  );

  if (today < start) {
    return { ...base, available: remainingRecurring > 0 || hasData, mode: remainingRecurring > 0 || hasData ? "future" : "empty", incomeProjected: now.income, expensesProjected: round2(now.expenses + remainingRecurring), netProjected: round2(now.income - now.expenses - remainingRecurring), elapsedPct: 0, recurringRemaining: round2(remainingRecurring), basis: "El periodo aún no empieza: se muestran los gastos recurrentes programados." };
  }

  const elapsedDays = daysBetween(start, today) + 1;
  const elapsed = Math.min(1, elapsedDays / totalDays);
  const reliable = elapsedDays >= 3;

  let incomeSoFar = 0;
  let variableSoFar = 0;
  for (const t of txs) {
    if (!inRange(t.date, start, end) || t.date > today) continue;
    if (t.kind === "INCOME" && t.status === "PAID") incomeSoFar += t.amount;
    if (t.kind === "EXPENSE" && !t.recurringId) variableSoFar += t.amount;
  }
  const scale = reliable ? 1 / elapsed - 1 : 0;
  const incomeProjected = now.income + incomeSoFar * scale;
  const expensesProjected = now.expenses + remainingRecurring + variableSoFar * scale;

  return {
    ...base,
    available: hasData || remainingRecurring > 0,
    mode: hasData || remainingRecurring > 0 ? "running" : "empty",
    incomeProjected: round2(incomeProjected),
    expensesProjected: round2(expensesProjected),
    netProjected: round2(incomeProjected - expensesProjected),
    elapsedPct: elapsed * 100,
    recurringRemaining: round2(remainingRecurring),
    basis: reliable
      ? `Según el ritmo de los primeros ${elapsedDays} días del periodo y los gastos recurrentes que faltan por vencer.`
      : "Aún es muy pronto para proyectar el ritmo: se suman solo los gastos recurrentes que faltan por vencer.",
  };
}

// ───────────────────────────── Equipo ─────────────────────────────

export interface TeamSummary {
  rows: FinanceTxVM[];
  total: number;
  paid: number;
  pending: number;
  pctOfExpenses: number | null;
}

export function teamSummary(txs: FinanceTxVM[], start: string, end: string, totalExpenses: number): TeamSummary {
  const rows = txs
    .filter((t) => t.kind === "EXPENSE" && TEAM_CATEGORIES.includes(t.category) && inRange(t.date, start, end))
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((s, t) => s + t.amount, 0);
  const paid = rows.filter((t) => t.status === "PAID").reduce((s, t) => s + t.amount, 0);
  return {
    rows,
    total: round2(total),
    paid: round2(paid),
    pending: round2(total - paid),
    pctOfExpenses: totalExpenses > 0 ? (total / totalExpenses) * 100 : null,
  };
}

// ───────────────────────────── Próximos pagos ─────────────────────────────

export interface UpcomingPayment {
  key: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  status: "PENDING" | "SCHEDULED" | "RECURRING";
  daysLeft: number;
  txId?: string;
  recurringId?: string;
  source: FinanceTxVM["source"] | "recurring";
  /** Fila que agrupa varias comisiones pendientes (sin fecha límite). */
  aggregate?: boolean;
}

/** Pagos pendientes/programados + próximos vencimientos de recurrentes
 * (45 días), ordenados por fecha. */
export function upcomingPayments(txs: FinanceTxVM[], recurring: FinanceRecurringVM[], today: string): UpcomingPayment[] {
  const out: UpcomingPayment[] = [];
  let commissionTotal = 0;
  let commissionCount = 0;
  for (const t of txs) {
    if (t.kind !== "EXPENSE" || t.status === "PAID") continue;
    if (t.source === "commission") {
      commissionTotal += t.amount;
      commissionCount++;
      continue;
    }
    out.push({
      key: `tx-${t.id}`,
      description: t.description,
      category: t.category,
      amount: t.amount,
      date: t.date,
      status: t.status,
      daysLeft: daysBetween(today, t.date),
      txId: t.source === "manual" ? t.id : undefined,
      source: t.source,
    });
  }
  for (const o of recurringOccurrences(recurring, "0000-01-01", addDays(today, 45))) {
    out.push({
      key: `rec-${o.recurring.id}-${o.date}`,
      description: o.recurring.description,
      category: o.recurring.category,
      amount: o.recurring.amount,
      date: o.date,
      status: "RECURRING",
      daysLeft: daysBetween(today, o.date),
      recurringId: o.recurring.id,
      source: "recurring",
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  if (commissionCount > 0) {
    out.unshift({
      key: "commissions-pending",
      description: `Comisiones por pagar a agentes (${commissionCount})`,
      category: "AGENTS",
      amount: round2(commissionTotal),
      date: today,
      status: "PENDING",
      daysLeft: 0,
      source: "commission",
      aggregate: true,
    });
  }
  return out;
}

// ───────────────────────────── Resumen ejecutivo ─────────────────────────────

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const pctText = (n: number) => `${Math.abs(n).toFixed(1)}%`;

/**
 * Resumen en lenguaje natural, armado SOLO con los datos registrados. Si no
 * hay movimientos en el periodo devuelve null (no se inventa nada).
 */
export function executiveSummary(
  txs: FinanceTxVM[],
  cur: { start: string; end: string },
  prev: { start: string; end: string },
  pay: Payables
): string[] | null {
  const now = totalsFor(txs, cur.start, cur.end);
  const before = totalsFor(txs, prev.start, prev.end);
  if (now.income === 0 && now.expenses === 0) return null;

  const lines: string[] = [];
  const inc = pctChange(now.income, before.income);
  if (inc !== null) {
    lines.push(
      inc === 0
        ? `Los ingresos se mantuvieron igual que en el periodo anterior (${money(now.income)}).`
        : `Los ingresos ${inc > 0 ? "aumentaron" : "disminuyeron"} ${pctText(inc)} respecto al periodo anterior, hasta ${money(now.income)}.`
    );
  } else if (now.income > 0) {
    lines.push(`Se registraron ingresos por ${money(now.income)} en el periodo.`);
  } else {
    lines.push("Todavía no hay ingresos cobrados registrados en este periodo.");
  }

  const exp = pctChange(now.expenses, before.expenses);
  // Categorías que más explican el cambio en gastos.
  const curDist = distribution(txs, cur.start, cur.end);
  const prevDist = new Map(distribution(txs, prev.start, prev.end).map((d) => [d.key, d.amount]));
  const drivers = curDist
    .map((d) => ({ label: d.label.toLowerCase(), delta: d.amount - (prevDist.get(d.key) ?? 0) }))
    .filter((d) => (exp ?? 0) >= 0 ? d.delta > 0 : d.delta < 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 2)
    .map((d) => d.label);
  if (exp !== null && now.expenses > 0) {
    lines.push(
      exp === 0
        ? `Los gastos se mantuvieron en ${money(now.expenses)}.`
        : `Los gastos ${exp > 0 ? "aumentaron" : "bajaron"} ${pctText(exp)}${drivers.length ? `, principalmente por ${drivers.join(" y ")}` : ""}.`
    );
  } else if (now.expenses > 0) {
    const top = curDist.slice().sort((a, b) => b.amount - a.amount)[0];
    lines.push(
      `Los gastos suman ${money(now.expenses)}${top ? `; la categoría principal es ${top.label.toLowerCase()} (${top.pct.toFixed(0)}%)` : ""}.`
    );
  }

  if (now.margin !== null) {
    lines.push(
      now.net >= 0
        ? `La empresa mantiene un margen neto del ${now.margin.toFixed(1)}% (${money(now.net)} de ganancia).`
        : `Los gastos superan a los ingresos: la pérdida del periodo es de ${money(Math.abs(now.net))}.`
    );
  }
  if (pay.count > 0) {
    lines.push(
      `Quedan ${money(pay.amount)} por pagar en ${pay.count} ${pay.count === 1 ? "pago" : "pagos"}${pay.overdue ? ` (${pay.overdue} vencido${pay.overdue === 1 ? "" : "s"})` : ""}.`
    );
  }
  return lines;
}

export { categoryLabel };
