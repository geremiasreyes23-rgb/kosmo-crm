"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageFinance } from "@/lib/finance/access";
import {
  BUSINESS_TIME_ZONE,
  EXPENSE_CATEGORIES,
  FINANCE_STATUSES,
  FREQUENCIES,
  INCOME_CATEGORIES,
  MAX_RECEIPT_BYTES,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  RECEIPT_TYPES,
  TEAM_CATEGORIES,
  type FinanceFrequencyValue,
  type FinanceKindValue,
  type FinanceMethodValue,
  type FinanceStatusValue,
} from "@/lib/finance/constants";
import { nextOccurrence, todayIn } from "@/lib/finance/calc";

/**
 * Control Financiero — registrar / editar / eliminar movimientos y gastos
 * recurrentes. Todas exigen "finance:manage" (ver src/lib/finance/access.ts).
 * Cada cambio queda en la auditoría.
 */

export interface FinanceActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  id?: string;
}

export interface FinanceTxInput {
  kind: FinanceKindValue;
  description: string;
  category: string;
  amount: string | number;
  date: string; // YYYY-MM-DD
  paymentMethod: FinanceMethodValue | "";
  status: FinanceStatusValue;
  provider: string;
  notes: string;
  employeeUserId: string;
  paymentType: string;
  /** Comprobante nuevo (data URL). undefined = no tocar; null = quitar. */
  receipt?: { fileName: string; dataUrl: string; sizeBytes: number } | null;
  /** Solo al crear: además lo deja como gasto recurrente. */
  recurring?: { frequency: FinanceFrequencyValue; intervalDays?: number | null } | null;
}

export interface FinanceRecurringInput {
  description: string;
  category: string;
  amount: string | number;
  frequency: FinanceFrequencyValue;
  intervalDays: number | null;
  nextPaymentDate: string;
  paymentMethod: FinanceMethodValue | "";
  status: "ACTIVE" | "PAUSED";
  provider: string;
  notes: string;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const dbDate = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const clean = (s: string | undefined | null, max = 300) => (s ?? "").trim().slice(0, max) || null;

async function guard(): Promise<{ user: SessionUser } | { error: string }> {
  const user = await requireUser();
  if (!(await canManageFinance(user))) return { error: "No tienes permiso para administrar el Control Financiero." };
  return { user };
}

function parseAmount(v: string | number): number | null {
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? Math.round(n * 100) / 100 : null;
}

function validateTx(input: FinanceTxInput): { errors: Record<string, string>; amount: number } {
  const errors: Record<string, string> = {};
  if (!clean(input.description)) errors.description = "Escribe una descripción.";
  const cats: readonly { key: string }[] = input.kind === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  if (!cats.some((c) => c.key === input.category)) errors.category = "Elige una categoría.";
  const amount = parseAmount(input.amount);
  if (amount === null) errors.amount = "Monto inválido.";
  if (!DAY_RE.test(input.date)) errors.date = "Fecha inválida.";
  if (input.paymentMethod && !PAYMENT_METHODS.some((m) => m.key === input.paymentMethod)) errors.paymentMethod = "Método inválido.";
  if (!FINANCE_STATUSES.some((s) => s.key === input.status)) errors.status = "Estado inválido.";
  if (input.paymentType && !PAYMENT_TYPES.some((p) => p.key === input.paymentType)) errors.paymentType = "Tipo de pago inválido.";
  if (input.receipt) {
    const type = /^data:([^;,]+)/.exec(input.receipt.dataUrl)?.[1] ?? "";
    if (!RECEIPT_TYPES.includes(type)) errors.receipt = "Adjunta una imagen (JPG, PNG, WEBP) o un PDF.";
    else if (input.receipt.sizeBytes > MAX_RECEIPT_BYTES || input.receipt.dataUrl.length > MAX_RECEIPT_BYTES * 1.4) {
      errors.receipt = "El comprobante debe pesar menos de 5 MB.";
    }
  }
  if (input.recurring) {
    if (!FREQUENCIES.some((f) => f.key === input.recurring!.frequency)) errors.frequency = "Frecuencia inválida.";
    if (input.recurring.frequency === "CUSTOM" && !(Number(input.recurring.intervalDays) >= 1)) {
      errors.intervalDays = "Indica cada cuántos días.";
    }
  }
  return { errors, amount: amount ?? 0 };
}

async function employeeData(input: FinanceTxInput) {
  if (input.kind !== "EXPENSE" || !TEAM_CATEGORIES.includes(input.category) || !input.employeeUserId) {
    return { employeeUserId: null, employeeName: null };
  }
  const emp = await prisma.user.findUnique({ where: { id: input.employeeUserId }, select: { id: true, firstName: true, lastName: true } });
  return emp ? { employeeUserId: emp.id, employeeName: `${emp.firstName} ${emp.lastName}` } : { employeeUserId: null, employeeName: null };
}

function done() {
  revalidatePath("/dashboard");
}

export async function createFinanceTransactionAction(input: FinanceTxInput): Promise<FinanceActionResult> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error };
  const { errors, amount } = validateTx(input);
  if (Object.keys(errors).length) return { ok: false, error: "Revisa los campos marcados.", fieldErrors: errors };

  const emp = await employeeData(input);
  const created = await prisma.$transaction(async (tx) => {
    let recurringId: string | null = null;
    if (input.recurring && input.kind === "EXPENSE") {
      const rec = await tx.financeRecurringExpense.create({
        data: {
          description: clean(input.description)!,
          category: input.category,
          amount,
          frequency: input.recurring.frequency,
          intervalDays: input.recurring.frequency === "CUSTOM" ? Number(input.recurring.intervalDays) : null,
          nextPaymentDate: dbDate(nextOccurrence(input.date, input.recurring.frequency, input.recurring.intervalDays ?? null)),
          paymentMethod: input.paymentMethod || null,
          provider: clean(input.provider),
          notes: clean(input.notes, 2000),
          createdById: g.user.id,
        },
      });
      recurringId = rec.id;
    }
    return tx.financeTransaction.create({
      data: {
        kind: input.kind,
        description: clean(input.description)!,
        category: input.category,
        amount,
        date: dbDate(input.date),
        paymentMethod: input.paymentMethod || null,
        status: input.kind === "INCOME" && input.status === "SCHEDULED" ? "PENDING" : input.status,
        provider: clean(input.provider),
        notes: clean(input.notes, 2000),
        receiptFileName: input.receipt ? clean(input.receipt.fileName, 200) : null,
        receiptDataUrl: input.receipt ? input.receipt.dataUrl : null,
        paymentType: input.kind === "EXPENSE" && TEAM_CATEGORIES.includes(input.category) ? input.paymentType || null : null,
        recurringId,
        createdById: g.user.id,
        ...emp,
      },
    });
  });
  await logAudit({ userId: g.user.id, action: "CREATE", entityType: "FinanceTransaction", entityId: created.id, newValue: `${input.kind} ${amount}` });
  done();
  return { ok: true, id: created.id };
}

export async function updateFinanceTransactionAction(id: string, input: FinanceTxInput): Promise<FinanceActionResult> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error };
  const existing = await prisma.financeTransaction.findUnique({ where: { id }, select: { id: true, amount: true } });
  if (!existing) return { ok: false, error: "El movimiento ya no existe." };
  const { errors, amount } = validateTx({ ...input, recurring: null });
  if (Object.keys(errors).length) return { ok: false, error: "Revisa los campos marcados.", fieldErrors: errors };

  const emp = await employeeData(input);
  await prisma.financeTransaction.update({
    where: { id },
    data: {
      kind: input.kind,
      description: clean(input.description)!,
      category: input.category,
      amount,
      date: dbDate(input.date),
      paymentMethod: input.paymentMethod || null,
      status: input.status,
      provider: clean(input.provider),
      notes: clean(input.notes, 2000),
      paymentType: input.kind === "EXPENSE" && TEAM_CATEGORIES.includes(input.category) ? input.paymentType || null : null,
      ...(input.receipt === null
        ? { receiptFileName: null, receiptDataUrl: null }
        : input.receipt
          ? { receiptFileName: clean(input.receipt.fileName, 200), receiptDataUrl: input.receipt.dataUrl }
          : {}),
      ...emp,
    },
  });
  await logAudit({
    userId: g.user.id,
    action: "UPDATE",
    entityType: "FinanceTransaction",
    entityId: id,
    oldValue: String(existing.amount),
    newValue: String(amount),
  });
  done();
  return { ok: true, id };
}

export async function deleteFinanceTransactionAction(id: string): Promise<FinanceActionResult> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error };
  const existing = await prisma.financeTransaction.findUnique({ where: { id }, select: { description: true, amount: true } });
  if (!existing) return { ok: false, error: "El movimiento ya no existe." };
  await prisma.financeTransaction.delete({ where: { id } });
  await logAudit({
    userId: g.user.id,
    action: "DELETE",
    entityType: "FinanceTransaction",
    entityId: id,
    oldValue: `${existing.description} ${existing.amount}`.slice(0, 300),
  });
  done();
  return { ok: true };
}

/** Marca un movimiento pendiente/programado como pagado (hoy si no se indica). */
export async function markFinanceTransactionPaidAction(id: string): Promise<FinanceActionResult> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error };
  const updated = await prisma.financeTransaction.updateMany({ where: { id, status: { not: "PAID" } }, data: { status: "PAID" } });
  if (!updated.count) return { ok: false, error: "El movimiento ya estaba pagado o no existe." };
  await logAudit({ userId: g.user.id, action: "UPDATE", entityType: "FinanceTransaction", entityId: id, fieldName: "status", newValue: "PAID" });
  done();
  return { ok: true };
}

// ───────────────────────────── Gastos recurrentes ─────────────────────────────

function validateRecurring(input: FinanceRecurringInput): { errors: Record<string, string>; amount: number } {
  const errors: Record<string, string> = {};
  if (!clean(input.description)) errors.description = "Escribe un nombre.";
  if (!EXPENSE_CATEGORIES.some((c) => c.key === input.category)) errors.category = "Elige una categoría.";
  const amount = parseAmount(input.amount);
  if (amount === null) errors.amount = "Monto inválido.";
  if (!FREQUENCIES.some((f) => f.key === input.frequency)) errors.frequency = "Frecuencia inválida.";
  if (input.frequency === "CUSTOM" && !(Number(input.intervalDays) >= 1)) errors.intervalDays = "Indica cada cuántos días.";
  if (!DAY_RE.test(input.nextPaymentDate)) errors.nextPaymentDate = "Fecha inválida.";
  if (input.paymentMethod && !PAYMENT_METHODS.some((m) => m.key === input.paymentMethod)) errors.paymentMethod = "Método inválido.";
  return { errors, amount: amount ?? 0 };
}

export async function saveRecurringExpenseAction(id: string | null, input: FinanceRecurringInput): Promise<FinanceActionResult> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error };
  const { errors, amount } = validateRecurring(input);
  if (Object.keys(errors).length) return { ok: false, error: "Revisa los campos marcados.", fieldErrors: errors };
  const data = {
    description: clean(input.description)!,
    category: input.category,
    amount,
    frequency: input.frequency,
    intervalDays: input.frequency === "CUSTOM" ? Number(input.intervalDays) : null,
    nextPaymentDate: dbDate(input.nextPaymentDate),
    paymentMethod: input.paymentMethod || null,
    status: input.status === "PAUSED" ? ("PAUSED" as const) : ("ACTIVE" as const),
    provider: clean(input.provider),
    notes: clean(input.notes, 2000),
  };
  const row = id
    ? await prisma.financeRecurringExpense.update({ where: { id }, data })
    : await prisma.financeRecurringExpense.create({ data: { ...data, createdById: g.user.id } });
  await logAudit({ userId: g.user.id, action: id ? "UPDATE" : "CREATE", entityType: "FinanceRecurringExpense", entityId: row.id });
  done();
  return { ok: true, id: row.id };
}

export async function deleteRecurringExpenseAction(id: string): Promise<FinanceActionResult> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error };
  // Los movimientos ya registrados se conservan (recurringId pasa a null).
  await prisma.financeRecurringExpense.delete({ where: { id } });
  await logAudit({ userId: g.user.id, action: "DELETE", entityType: "FinanceRecurringExpense", entityId: id });
  done();
  return { ok: true };
}

/**
 * Registra el pago de la ocurrencia actual de un gasto recurrente: crea el
 * movimiento (Pagado, con la fecha de vencimiento) y mueve la próxima fecha
 * de pago según la frecuencia.
 */
export async function payRecurringExpenseAction(id: string): Promise<FinanceActionResult> {
  const g = await guard();
  if ("error" in g) return { ok: false, error: g.error };
  const rec = await prisma.financeRecurringExpense.findUnique({ where: { id } });
  if (!rec) return { ok: false, error: "El gasto recurrente ya no existe." };
  const due = rec.nextPaymentDate.toISOString().slice(0, 10);
  const today = todayIn(BUSINESS_TIME_ZONE);
  const created = await prisma.$transaction(async (tx) => {
    const moved = await tx.financeRecurringExpense.updateMany({
      where: { id, nextPaymentDate: rec.nextPaymentDate },
      data: { nextPaymentDate: dbDate(nextOccurrence(due, rec.frequency, rec.intervalDays)) },
    });
    if (!moved.count) throw new Error("ALREADY_PAID");
    return tx.financeTransaction.create({
      data: {
        kind: "EXPENSE",
        description: rec.description,
        category: rec.category,
        amount: rec.amount,
        // Si se paga por adelantado se registra con la fecha de vencimiento;
        // si se paga tarde, con la de hoy.
        date: dbDate(due < today ? today : due),
        paymentMethod: rec.paymentMethod,
        status: "PAID",
        provider: rec.provider,
        notes: rec.notes,
        recurringId: rec.id,
        createdById: g.user.id,
      },
    });
  }).catch((err: unknown) => {
    if (err instanceof Error && err.message === "ALREADY_PAID") return null;
    throw err;
  });
  if (!created) return { ok: false, error: "Ese pago ya se registró. Actualiza la página." };
  await logAudit({ userId: g.user.id, action: "CREATE", entityType: "FinanceTransaction", entityId: created.id, fieldName: "recurring", newValue: id });
  done();
  return { ok: true, id: created.id };
}
