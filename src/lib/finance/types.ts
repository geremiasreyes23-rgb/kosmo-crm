import type {
  FinanceFrequencyValue,
  FinanceKindValue,
  FinanceMethodValue,
  FinanceStatusValue,
} from "./constants";

/**
 * Un movimiento de dinero tal como lo ve el Control Financiero. Puede venir
 * de tres fuentes:
 *  - "manual": registrado en el Control Financiero (FinanceTransaction).
 *  - "commission": pago de comisión a agente(s), leído de Commission
 *    (agente + manager + AOR). Solo lectura aquí; se gestiona en Comisiones.
 *  - "carrier": comisión cobrada a la aseguradora (Commission.carrierCommission
 *    con carrierPaymentDate). Solo lectura.
 * Las fechas van como "YYYY-MM-DD" para no sufrir corrimientos de zona horaria.
 */
export interface FinanceTxVM {
  id: string;
  source: "manual" | "commission" | "carrier";
  kind: FinanceKindValue;
  description: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: FinanceMethodValue | null;
  status: FinanceStatusValue;
  provider: string | null;
  notes: string | null;
  hasReceipt: boolean;
  receiptFileName: string | null;
  recurringId: string | null;
  employeeUserId: string | null;
  employeeAgentId: string | null;
  employeeName: string | null;
  employeeRole: string | null;
  paymentType: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface FinanceRecurringVM {
  id: string;
  description: string;
  category: string;
  amount: number;
  frequency: FinanceFrequencyValue;
  intervalDays: number | null;
  nextPaymentDate: string;
  paymentMethod: FinanceMethodValue | null;
  status: "ACTIVE" | "PAUSED";
  provider: string | null;
  notes: string | null;
}

export type PeriodKey = "this_month" | "last_month" | "last_3" | "this_year";

/** Periodo resuelto: [start, end) en "YYYY-MM-DD". */
export interface ResolvedPeriod {
  /** Valor para la URL: "2026-10" o una PeriodKey. */
  value: string;
  label: string;
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  /** Meses (YYYY-MM) que muestra "Evolución financiera". */
  evolutionMonths: string[];
  /** ¿Incluye el día de hoy? (habilita la proyección). */
  containsToday: boolean;
  today: string;
}

export interface FinancePageData {
  period: ResolvedPeriod;
  transactions: FinanceTxVM[];
  recurring: FinanceRecurringVM[];
  /** Personas del equipo (para el selector de beneficiario). */
  people: { id: string; name: string; roleName: string }[];
  canManage: boolean;
  /** Meses disponibles en el selector de periodo. */
  monthOptions: { value: string; label: string }[];
}
