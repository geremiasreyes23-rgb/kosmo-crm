"use client";

import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, PieChart as PieIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { CategorySlice, MonthPoint } from "@/lib/finance/calc";

/** Colores de las series de "Evolución financiera" (primeros 3 slots de la
 * paleta categórica validada: se distinguen entre sí en todas las parejas). */
const SERIES = {
  ingresos: { label: "Ingresos", color: "var(--fin-cat-1)" },
  gastos: { label: "Gastos", color: "var(--fin-cat-2)" },
  ganancia: { label: "Ganancia neta", color: "var(--fin-cat-3)" },
} as const;

const compact = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);

function EmptyChart({ icon: Icon, text }: { icon: typeof BarChart3; text: string }) {
  return (
    <div className="flex h-[260px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-grid)] text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--ink-muted)]">
        <Icon className="h-5 w-5" />
      </span>
      <p className="max-w-[16rem] text-sm text-[var(--ink-muted)]">{text}</p>
    </div>
  );
}

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-[180px] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-[var(--ink-primary)]">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-[var(--ink-secondary)]">
            {r.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />}
            {r.label}
          </span>
          <span className="font-semibold tabular-nums text-[var(--ink-primary)]">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Ingresos y gastos (barras) + ganancia neta (línea), un solo eje en dólares. */
export function EvolutionChart({ data }: { data: MonthPoint[] }) {
  const empty = data.every((d) => d.ingresos === 0 && d.gastos === 0);
  if (empty) {
    return <EmptyChart icon={BarChart3} text="Cuando registres ingresos y gastos, aquí verás su evolución mes a mes." />;
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-[var(--ink-secondary)]">
        {Object.values(SERIES).map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid stroke="var(--border-grid)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "var(--ink-muted)", fontSize: 12 }} axisLine={{ stroke: "var(--border-grid)" }} tickLine={false} />
          <YAxis tick={{ fill: "var(--ink-muted)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={compact} width={56} />
          <Tooltip
            cursor={{ fill: "var(--surface-hover)", opacity: 0.6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as MonthPoint;
              return (
                <TooltipBox
                  title={p.label}
                  rows={[
                    { label: "Ingresos", value: formatCurrency(p.ingresos), color: SERIES.ingresos.color },
                    { label: "Gastos", value: formatCurrency(p.gastos), color: SERIES.gastos.color },
                    { label: "Ganancia", value: formatCurrency(p.ganancia), color: SERIES.ganancia.color },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="ingresos" name="Ingresos" fill={SERIES.ingresos.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="gastos" name="Gastos" fill={SERIES.gastos.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line
            type="monotone"
            dataKey="ganancia"
            name="Ganancia neta"
            stroke={SERIES.ganancia.color}
            strokeWidth={2}
            dot={{ r: 4, fill: SERIES.ganancia.color, stroke: "var(--surface-card)", strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Distribución de gastos por categoría: donut + leyenda con monto y %. */
export function ExpenseDonut({ data, total }: { data: CategorySlice[]; total: number }) {
  const [active, setActive] = useState<string | null>(null);
  if (!data.length) {
    return <EmptyChart icon={PieIcon} text="Aún no hay gastos en este periodo para repartir por categoría." />;
  }
  const focus = data.find((d) => d.key === active);
  return (
    <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[220px_1fr]">
      <div className="relative mx-auto h-[220px] w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="label"
              innerRadius={68}
              outerRadius={100}
              paddingAngle={data.length > 1 ? 1.5 : 0}
              stroke="var(--surface-card)"
              strokeWidth={2}
              onMouseEnter={(_, i) => setActive(data[i]?.key ?? null)}
              onMouseLeave={() => setActive(null)}
              isAnimationActive
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} opacity={active && active !== d.key ? 0.35 : 1} />
              ))}
            </Pie>
            <Tooltip
              content={({ active: a, payload }) => {
                if (!a || !payload?.length) return null;
                const d = payload[0].payload as CategorySlice;
                return (
                  <TooltipBox
                    title={d.label}
                    rows={[
                      { label: "Monto", value: formatCurrency(d.amount), color: d.color },
                      { label: "% del gasto total", value: `${d.pct.toFixed(1)}%` },
                    ]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
            {focus ? focus.label : "Total"}
          </span>
          <span className="text-lg font-semibold tabular-nums text-[var(--ink-primary)]">
            {formatCurrency(focus ? focus.amount : total)}
          </span>
          {focus && <span className="text-xs text-[var(--ink-muted)]">{focus.pct.toFixed(1)}%</span>}
        </div>
      </div>
      <ul className="space-y-1">
        {data.map((d) => (
          <li
            key={d.key}
            onMouseEnter={() => setActive(d.key)}
            onMouseLeave={() => setActive(null)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-[var(--surface-hover)]"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="min-w-0 flex-1 truncate text-[var(--ink-secondary)]">{d.label}</span>
            <span className="tabular-nums text-[var(--ink-muted)]">{d.pct.toFixed(0)}%</span>
            <span className="w-24 text-right font-medium tabular-nums text-[var(--ink-primary)]">{formatCurrency(d.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
