"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, Receipt, Repeat, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { PersonSelect, userOptions } from "@/components/ui/PersonSelect";
import { cn, formatBytes } from "@/lib/utils";
import {
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
} from "@/lib/finance/constants";
import type { FinanceTxVM } from "@/lib/finance/types";
import {
  createFinanceTransactionAction,
  deleteFinanceTransactionAction,
  updateFinanceTransactionAction,
  type FinanceTxInput,
} from "@/app/(app)/dashboard/finance-actions";
import { FieldError, FieldLabel, FinanceDialog } from "./FinanceDialog";

type Form = Omit<FinanceTxInput, "receipt" | "recurring" | "amount"> & { amount: string };

function emptyForm(today: string, kind: FinanceKindValue): Form {
  return {
    kind,
    description: "",
    category: "",
    amount: "",
    date: today,
    paymentMethod: "",
    status: "PAID",
    provider: "",
    notes: "",
    employeeUserId: "",
    paymentType: "",
  };
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/**
 * "+ Registrar gasto" (y edición de un movimiento). Permite también
 * registrar un ingreso con el mismo formulario. Al guardar, el dashboard se
 * refresca solo (KPIs, gráficos, distribución, proyección y tabla).
 */
export function TransactionModal({
  open,
  onClose,
  onSaved,
  editing,
  initialKind = "EXPENSE",
  presetCategory = "",
  today,
  people,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  editing: FinanceTxVM | null;
  initialKind?: FinanceKindValue;
  /** Categoría preseleccionada al crear (ej. "PAYROLL" desde Nómina y agentes). */
  presetCategory?: string;
  today: string;
  people: { id: string; name: string; roleName: string }[];
}) {
  const [form, setForm] = useState<Form>(() => emptyForm(today, initialKind));
  const [file, setFile] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<FinanceFrequencyValue>("MONTHLY");
  const [intervalDays, setIntervalDays] = useState("30");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        kind: editing.kind,
        description: editing.description,
        category: editing.category,
        amount: String(editing.amount),
        date: editing.date,
        paymentMethod: editing.paymentMethod ?? "",
        status: editing.status,
        provider: editing.provider ?? "",
        notes: editing.notes ?? "",
        employeeUserId: editing.employeeUserId ?? "",
        paymentType: editing.paymentType ?? "",
      });
    } else {
      setForm({ ...emptyForm(today, initialKind), category: presetCategory });
    }
    setFile(null);
    setRemoveReceipt(false);
    setIsRecurring(false);
    setFrequency("MONTHLY");
    setIntervalDays("30");
    setErrors({});
    setFormError(null);
  }, [open, editing, initialKind, presetCategory, today]);

  const isIncome = form.kind === "INCOME";
  const categories: readonly { key: string; label: string }[] = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isTeam = !isIncome && TEAM_CATEGORIES.includes(form.category);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => {
      if (!(k in p)) return p;
      const n = { ...p };
      delete n[k as string];
      return n;
    });
  };

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!RECEIPT_TYPES.includes(f.type)) return setErrors((p) => ({ ...p, receipt: "Adjunta una imagen (JPG, PNG, WEBP) o un PDF." }));
    if (f.size > MAX_RECEIPT_BYTES) return setErrors((p) => ({ ...p, receipt: "El comprobante debe pesar menos de 5 MB." }));
    setFile(f);
    setRemoveReceipt(false);
    setErrors((p) => {
      const n = { ...p };
      delete n.receipt;
      return n;
    });
  }

  async function save() {
    setBusy("save");
    setFormError(null);
    const receipt = file
      ? { fileName: file.name, dataUrl: await readFile(file), sizeBytes: file.size }
      : removeReceipt
        ? null
        : undefined;
    const payload: FinanceTxInput = {
      ...form,
      receipt,
      recurring: !editing && isRecurring && !isIncome ? { frequency, intervalDays: frequency === "CUSTOM" ? Number(intervalDays) : null } : null,
    };
    const r = editing ? await updateFinanceTransactionAction(editing.id, payload) : await createFinanceTransactionAction(payload);
    setBusy(null);
    if (!r.ok) {
      setFormError(r.error ?? "No se pudo guardar.");
      setErrors(r.fieldErrors ?? {});
      return;
    }
    onSaved(editing ? "Movimiento actualizado." : isIncome ? "Ingreso registrado." : "Gasto registrado.");
  }

  async function remove() {
    if (!editing || !window.confirm(`¿Eliminar "${editing.description}"? Se recalcularán todos los totales.`)) return;
    setBusy("delete");
    const r = await deleteFinanceTransactionAction(editing.id);
    setBusy(null);
    if (!r.ok) return setFormError(r.error ?? "No se pudo eliminar.");
    onSaved("Movimiento eliminado.");
  }

  const title = editing ? (isIncome ? "Editar ingreso" : "Editar gasto") : isIncome ? "Registrar ingreso" : "Registrar gasto";

  return (
    <FinanceDialog
      open={open}
      onClose={() => !busy && onClose()}
      icon={isIncome ? <Wallet className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
      title={title}
      subtitle={isIncome ? "Dinero que entra a la empresa." : "Información del gasto"}
      footer={
        <>
          {editing && (
            <Button variant="secondary" size="sm" onClick={remove} disabled={!!busy} className="sm:mr-auto">
              <Trash2 className="h-4 w-4" /> {busy === "delete" ? "Eliminando..." : "Eliminar"}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose} disabled={!!busy}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={!!busy}>
            {busy === "save" ? "Guardando..." : editing ? "Guardar cambios" : title}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {formError && (
          <p className="rounded-lg border border-[var(--status-critical)] bg-[var(--status-critical-bg)] px-3 py-2 text-sm text-[var(--status-critical)]">
            {formError}
          </p>
        )}

        {!editing && (
          <div className="inline-flex rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-sunken)] p-1">
            {(["EXPENSE", "INCOME"] as FinanceKindValue[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setForm((p) => ({ ...p, kind: k, category: "", status: "PAID" }))}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                  form.kind === k ? "bg-[var(--surface-card)] text-[var(--ink-primary)] shadow-sm" : "text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                )}
              >
                {k === "EXPENSE" ? "Gasto" : "Ingreso"}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <FieldLabel required>Descripción</FieldLabel>
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={isIncome ? 'Ej. "Comisiones de Humana — septiembre"' : 'Ej. "Compra de 2 monitores"'}
              maxLength={300}
            />
            <FieldError text={errors.description} />
          </label>

          <label className="block">
            <FieldLabel required>Categoría</FieldLabel>
            <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Selecciona...</option>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
            <FieldError text={errors.category} />
          </label>

          <label className="block">
            <FieldLabel required>Monto</FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--ink-muted)]">$</span>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
                className="pl-6 tabular-nums"
              />
            </div>
            <FieldError text={errors.amount} />
          </label>

          <label className="block">
            <FieldLabel required>Fecha</FieldLabel>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            <FieldError text={errors.date} />
          </label>

          <label className="block">
            <FieldLabel>Método de pago</FieldLabel>
            <Select value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value as Form["paymentMethod"])}>
              <option value="">Sin especificar</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </label>

          <div className="block">
            <FieldLabel required>Estado</FieldLabel>
            <div className="flex gap-1.5">
              {FINANCE_STATUSES.filter((s) => !isIncome || s.key !== "SCHEDULED").map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => set("status", s.key)}
                  className={cn(
                    "h-9 flex-1 rounded-lg border text-sm font-medium transition-colors",
                    form.status === s.key
                      ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                      : "border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                  )}
                >
                  {isIncome && s.key === "PAID" ? "Cobrado" : s.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <FieldLabel>{isIncome ? "Pagador / origen" : "Proveedor / beneficiario"}</FieldLabel>
            <Input
              value={form.provider}
              onChange={(e) => set("provider", e.target.value)}
              placeholder={isIncome ? "Ej. Humana" : "Ej. Adobe, Best Buy..."}
              maxLength={300}
            />
          </label>

          {isTeam && (
            <>
              <div className="block">
                <FieldLabel>Persona del equipo</FieldLabel>
                <PersonSelect
                  value={form.employeeUserId}
                  onChange={(v) => set("employeeUserId", v)}
                  options={userOptions(people).map((o) => ({ ...o, hint: people.find((p) => p.id === o.value)?.roleName }))}
                  emptyLabel="Sin persona asociada"
                />
              </div>
              <label className="block">
                <FieldLabel>Tipo de pago</FieldLabel>
                <Select value={form.paymentType} onChange={(e) => set("paymentType", e.target.value)}>
                  <option value="">Sin especificar</option>
                  {PAYMENT_TYPES.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </label>
              {form.category === "AGENTS" && (
                <p className="text-xs text-[var(--ink-muted)] sm:col-span-2">
                  Las comisiones de pólizas a agentes se suman solas desde el módulo Comisiones; registra aquí solo pagos
                  adicionales (bonos, ajustes...).
                </p>
              )}
            </>
          )}

          <label className="block sm:col-span-2">
            <FieldLabel>Notas</FieldLabel>
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Detalles adicionales..." />
          </label>

          <div className="sm:col-span-2">
            <FieldLabel>Adjuntar comprobante</FieldLabel>
            <input
              ref={fileRef}
              type="file"
              accept={RECEIPT_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {file || (editing?.hasReceipt && !removeReceipt) ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                  {file ? (
                    <span className="truncate">{file.name}</span>
                  ) : (
                    <a href={`/api/finance/receipt?id=${editing!.id}`} target="_blank" rel="noreferrer" className="truncate text-[var(--brand-600)] hover:underline">
                      {editing!.receiptFileName ?? "Comprobante"}
                    </a>
                  )}
                  {file && <span className="shrink-0 text-xs text-[var(--ink-muted)]">{formatBytes(file.size)}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => (file ? setFile(null) : setRemoveReceipt(true))}
                  className="text-xs font-medium text-[var(--status-critical)] hover:underline"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-[var(--border-grid)] px-4 py-5 text-sm text-[var(--ink-muted)] transition-colors hover:border-[var(--brand-500)] hover:bg-[var(--brand-50)]/40"
              >
                <Paperclip className="h-5 w-5" />
                <span className="font-medium text-[var(--ink-secondary)]">Factura, recibo, imagen o PDF</span>
                <span className="text-xs">Hasta 5 MB</span>
              </button>
            )}
            <FieldError text={errors.receipt} />
          </div>

          {!editing && !isIncome && (
            <div className="rounded-xl border border-[var(--border-hairline)] p-4 sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="h-4 w-4 accent-[var(--brand-500)]"
                />
                <Repeat className="h-4 w-4 text-[var(--ink-muted)]" /> Es un gasto recurrente
              </label>
              {isRecurring && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <FieldLabel>Frecuencia</FieldLabel>
                    <Select value={frequency} onChange={(e) => setFrequency(e.target.value as FinanceFrequencyValue)}>
                      {FREQUENCIES.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  {frequency === "CUSTOM" && (
                    <label className="block">
                      <FieldLabel>Cada cuántos días</FieldLabel>
                      <Input type="number" min="1" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
                      <FieldError text={errors.intervalDays} />
                    </label>
                  )}
                  <p className="text-xs text-[var(--ink-muted)] sm:col-span-2">
                    Se registra este pago y el siguiente vencimiento aparecerá en Gastos recurrentes y Próximos pagos.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </FinanceDialog>
  );
}
