"use client";

import { useEffect, useState } from "react";
import { Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { EXPENSE_CATEGORIES, FREQUENCIES, PAYMENT_METHODS, type FinanceFrequencyValue } from "@/lib/finance/constants";
import type { FinanceRecurringVM } from "@/lib/finance/types";
import {
  deleteRecurringExpenseAction,
  saveRecurringExpenseAction,
  type FinanceRecurringInput,
} from "@/app/(app)/dashboard/finance-actions";
import { FieldError, FieldLabel, FinanceDialog } from "./FinanceDialog";

type Form = Omit<FinanceRecurringInput, "amount" | "intervalDays"> & { amount: string; intervalDays: string };

/** Alta / edición de un gasto recurrente (nómina, internet, software...). */
export function RecurringModal({
  open,
  onClose,
  onSaved,
  editing,
  today,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  editing: FinanceRecurringVM | null;
  today: string;
}) {
  const blank: Form = {
    description: "",
    category: "",
    amount: "",
    frequency: "MONTHLY",
    intervalDays: "30",
    nextPaymentDate: today,
    paymentMethod: "",
    status: "ACTIVE",
    provider: "",
    notes: "",
  };
  const [form, setForm] = useState<Form>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            description: editing.description,
            category: editing.category,
            amount: String(editing.amount),
            frequency: editing.frequency,
            intervalDays: String(editing.intervalDays ?? 30),
            nextPaymentDate: editing.nextPaymentDate,
            paymentMethod: editing.paymentMethod ?? "",
            status: editing.status,
            provider: editing.provider ?? "",
            notes: editing.notes ?? "",
          }
        : blank
    );
    setErrors({});
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));

  async function save() {
    setBusy("save");
    setFormError(null);
    const r = await saveRecurringExpenseAction(editing?.id ?? null, {
      ...form,
      intervalDays: form.frequency === "CUSTOM" ? Number(form.intervalDays) : null,
    });
    setBusy(null);
    if (!r.ok) {
      setFormError(r.error ?? "No se pudo guardar.");
      setErrors(r.fieldErrors ?? {});
      return;
    }
    onSaved(editing ? "Gasto recurrente actualizado." : "Gasto recurrente creado.");
  }

  async function remove() {
    if (!editing || !window.confirm(`¿Eliminar el gasto recurrente "${editing.description}"? Los pagos ya registrados se conservan.`)) return;
    setBusy("delete");
    const r = await deleteRecurringExpenseAction(editing.id);
    setBusy(null);
    if (!r.ok) return setFormError(r.error ?? "No se pudo eliminar.");
    onSaved("Gasto recurrente eliminado.");
  }

  return (
    <FinanceDialog
      open={open}
      onClose={() => !busy && onClose()}
      icon={<Repeat className="h-5 w-5" />}
      title={editing ? "Editar gasto recurrente" : "Nuevo gasto recurrente"}
      subtitle="Gastos que se repiten: nómina, internet, software, alquiler..."
      footer={
        <>
          {editing && (
            <Button variant="secondary" size="sm" onClick={remove} disabled={!!busy} className="sm:mr-auto">
              <Trash2 className="h-4 w-4" /> Eliminar
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose} disabled={!!busy}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={!!busy}>
            {busy === "save" ? "Guardando..." : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError && (
          <p className="rounded-lg border border-[var(--status-critical)] bg-[var(--status-critical-bg)] px-3 py-2 text-sm text-[var(--status-critical)]">
            {formError}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <FieldLabel required>Nombre</FieldLabel>
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ej. Internet de la oficina" maxLength={300} />
            <FieldError text={errors.description} />
          </label>
          <label className="block">
            <FieldLabel required>Categoría</FieldLabel>
            <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Selecciona...</option>
              {EXPENSE_CATEGORIES.map((c) => (
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
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} className="pl-6 tabular-nums" />
            </div>
            <FieldError text={errors.amount} />
          </label>
          <label className="block">
            <FieldLabel required>Frecuencia</FieldLabel>
            <Select value={form.frequency} onChange={(e) => set("frequency", e.target.value as FinanceFrequencyValue)}>
              {FREQUENCIES.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </Select>
          </label>
          {form.frequency === "CUSTOM" ? (
            <label className="block">
              <FieldLabel required>Cada cuántos días</FieldLabel>
              <Input type="number" min="1" value={form.intervalDays} onChange={(e) => set("intervalDays", e.target.value)} />
              <FieldError text={errors.intervalDays} />
            </label>
          ) : (
            <span className="hidden sm:block" />
          )}
          <label className="block">
            <FieldLabel required>Próxima fecha de pago</FieldLabel>
            <Input type="date" value={form.nextPaymentDate} onChange={(e) => set("nextPaymentDate", e.target.value)} />
            <FieldError text={errors.nextPaymentDate} />
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
          <label className="block">
            <FieldLabel>Proveedor</FieldLabel>
            <Input value={form.provider} onChange={(e) => set("provider", e.target.value)} placeholder="Ej. Comcast" maxLength={300} />
          </label>
          <div className="block">
            <FieldLabel>Estado</FieldLabel>
            <div className="flex gap-1.5">
              {(["ACTIVE", "PAUSED"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("status", s)}
                  className={cn(
                    "h-9 flex-1 rounded-lg border text-sm font-medium transition-colors",
                    form.status === s
                      ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                      : "border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                  )}
                >
                  {s === "ACTIVE" ? "Activo" : "Pausado"}
                </button>
              ))}
            </div>
          </div>
          <label className="block sm:col-span-2">
            <FieldLabel>Notas</FieldLabel>
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </label>
        </div>
      </div>
    </FinanceDialog>
  );
}
