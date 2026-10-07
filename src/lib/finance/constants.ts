/**
 * Control Financiero — catálogos compartidos (servidor y navegador).
 * Las claves se guardan en la base de datos; las etiquetas son lo que ve
 * el usuario. Agregar una categoría = agregarla aquí.
 */

export type FinanceKindValue = "EXPENSE" | "INCOME";
export type FinanceStatusValue = "PAID" | "PENDING" | "SCHEDULED";
export type FinanceMethodValue = "CASH" | "TRANSFER" | "CARD" | "DEBIT" | "OTHER";
export type FinanceFrequencyValue = "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";

/**
 * Categorías de gasto. El color es la "identidad" de la categoría en los
 * gráficos (paleta categórica validada, en orden fijo; ver globals.css
 * --fin-cat-*). "Otros" usa un gris neutro: nunca se genera un color nuevo.
 */
export const EXPENSE_CATEGORIES = [
  { key: "PAYROLL", label: "Nómina", color: "var(--fin-cat-1)" },
  { key: "AGENTS", label: "Agentes", color: "var(--fin-cat-2)" },
  { key: "PLATFORMS", label: "Plataformas", color: "var(--fin-cat-3)" },
  { key: "SERVICES", label: "Servicios", color: "var(--fin-cat-4)" },
  { key: "OPERATIONS", label: "Operación", color: "var(--fin-cat-5)" },
  { key: "PURCHASES", label: "Compras", color: "var(--fin-cat-6)" },
  { key: "MARKETING", label: "Marketing", color: "var(--fin-cat-7)" },
  { key: "TECHNOLOGY", label: "Tecnología", color: "var(--fin-cat-8)" },
  { key: "OTHER", label: "Otros", color: "var(--fin-cat-other)" },
] as const;

export const INCOME_CATEGORIES = [
  { key: "COMMISSIONS", label: "Comisiones de aseguradoras" },
  { key: "SERVICES_INCOME", label: "Servicios" },
  { key: "OTHER_INCOME", label: "Otros ingresos" },
] as const;

export type ExpenseCategoryKey = (typeof EXPENSE_CATEGORIES)[number]["key"];
export type IncomeCategoryKey = (typeof INCOME_CATEGORIES)[number]["key"];

/** Categorías del equipo (sección "Nómina y agentes"). */
export const TEAM_CATEGORIES: string[] = ["PAYROLL", "AGENTS"];

export const PAYMENT_METHODS: { key: FinanceMethodValue; label: string }[] = [
  { key: "CASH", label: "Efectivo" },
  { key: "TRANSFER", label: "Transferencia" },
  { key: "CARD", label: "Tarjeta" },
  { key: "DEBIT", label: "Débito" },
  { key: "OTHER", label: "Otro" },
];

export const FINANCE_STATUSES: { key: FinanceStatusValue; label: string }[] = [
  { key: "PAID", label: "Pagado" },
  { key: "PENDING", label: "Pendiente" },
  { key: "SCHEDULED", label: "Programado" },
];

export const FREQUENCIES: { key: FinanceFrequencyValue; label: string }[] = [
  { key: "MONTHLY", label: "Mensual" },
  { key: "WEEKLY", label: "Semanal" },
  { key: "YEARLY", label: "Anual" },
  { key: "CUSTOM", label: "Personalizada" },
];

export const PAYMENT_TYPES: { key: string; label: string }[] = [
  { key: "SALARY", label: "Salario" },
  { key: "COMMISSION", label: "Comisión" },
  { key: "BONUS", label: "Bono" },
  { key: "OTHER", label: "Otro" },
];

/** Zona horaria del negocio para decidir qué es "hoy" y "este mes". */
export const BUSINESS_TIME_ZONE = "America/New_York";

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function categoryLabel(key: string): string {
  return (
    EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ??
    INCOME_CATEGORIES.find((c) => c.key === key)?.label ??
    key
  );
}

export function categoryColor(key: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.color ?? "var(--fin-cat-other)";
}

export const labelOf = <K extends string>(list: { key: K; label: string }[], key: K | null | undefined) =>
  list.find((x) => x.key === key)?.label ?? "";
