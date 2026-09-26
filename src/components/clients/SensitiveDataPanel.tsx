"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select, FieldWrapper } from "@/components/ui/Field";
import { setSensitiveFieldAction, revealSensitiveFieldAction } from "@/app/(app)/clients/actions";
import type { SensitiveFieldVM } from "@/types";

// Catálogo de claves conocidas — copia deliberada (no importada) de
// SENSITIVE_FIELD_LABELS en src/lib/sensitiveData.ts: ese archivo es
// "server-only" y no puede entrar al bundle del cliente. "Otro" permite
// cualquier fieldKey libre, igual que el schema lo permite.
const KNOWN_FIELDS = [
  { key: "ssn", label: "SSN" },
  { key: "bank_account_number", label: "Número de cuenta bancaria" },
  { key: "routing_number", label: "Routing number" },
];

export function SensitiveDataPanel({
  clientId,
  initialFields,
  canEdit,
  canReveal,
}: {
  clientId: string;
  initialFields: SensitiveFieldVM[];
  /** Puede agregar/reemplazar un valor sensible — permiso "clients:edit". */
  canEdit: boolean;
  /** Puede descifrar y ver el valor real — permiso "sensitive_data:view",
   * por defecto solo Super Admin/Admin (ver prisma/seed.ts). */
  canReveal: boolean;
}) {
  const router = useRouter();
  const [fields, setFields] = useState(initialFields);
  useEffect(() => setFields(initialFields), [initialFields]);

  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [fieldKey, setFieldKey] = useState(KNOWN_FIELDS[0].key);
  const [customKey, setCustomKey] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function handleReveal(field: SensitiveFieldVM) {
    if (revealed[field.id]) {
      // Ya lo teníamos descifrado en esta sesión de la página — solo
      // reocultarlo no necesita volver a llamar al servidor (no vuelve a
      // quedar auditado un segundo "ver" por algo que ya seguía en pantalla).
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[field.id];
        return next;
      });
      return;
    }
    setRevealingId(field.id);
    setRevealError(null);
    const result = await revealSensitiveFieldAction(field.id);
    setRevealingId(null);
    if (!result.ok || result.value === undefined) {
      setRevealError(result.error ?? "No se pudo revelar el valor.");
      return;
    }
    setRevealed((prev) => ({ ...prev, [field.id]: result.value! }));
  }

  async function handleAdd() {
    const key = fieldKey === "other" ? customKey.trim() : fieldKey;
    if (!key || !value.trim()) {
      setAddError("Selecciona el campo y escribe un valor.");
      return;
    }
    setSaving(true);
    setAddError(null);
    const result = await setSensitiveFieldAction(clientId, key, value);
    setSaving(false);
    if (!result.ok) {
      setAddError(result.error ?? "No se pudo guardar.");
      return;
    }
    setAddOpen(false);
    setValue("");
    setCustomKey("");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--ink-muted)]">
          <Lock className="h-3.5 w-3.5" /> Datos sensibles
        </h4>
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={() => setAddOpen((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        )}
      </div>

      {fields.length === 0 && !addOpen && (
        <p className="text-sm text-[var(--ink-muted)]">Sin datos sensibles guardados.</p>
      )}

      <div className="space-y-1.5">
        {fields.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-grid)] px-3 py-2 text-sm"
          >
            <span className="text-[var(--ink-muted)]">{f.label}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium">{revealed[f.id] ?? f.maskedPreview}</span>
              {canReveal && (
                <button
                  type="button"
                  onClick={() => handleReveal(f)}
                  disabled={revealingId === f.id}
                  className="text-[var(--ink-muted)] hover:text-[var(--ink-primary)] disabled:opacity-50"
                  title={revealed[f.id] ? "Ocultar" : "Ver valor real"}
                >
                  {revealed[f.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {revealError && <p className="text-xs text-[var(--status-critical)]">{revealError}</p>}

      {addOpen && (
        <div className="space-y-3 rounded-lg border border-[var(--border-hairline)] p-3">
          <FieldWrapper label="Campo">
            <Select value={fieldKey} onChange={(e) => setFieldKey(e.target.value)}>
              {KNOWN_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
              <option value="other">Otro...</option>
            </Select>
          </FieldWrapper>
          {fieldKey === "other" && (
            <FieldWrapper label="Clave del campo">
              <Input
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="ej. numero_poliza_anterior"
              />
            </FieldWrapper>
          )}
          <FieldWrapper label="Valor">
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Se cifra al guardar" />
          </FieldWrapper>
          {addError && <p className="text-xs text-[var(--status-critical)]">{addError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
