"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Power } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FieldWrapper, Input } from "@/components/ui/Field";
import { createInsuranceLineAction, setInsuranceLineActiveAction } from "@/app/(app)/settings/catalogs-actions";

export interface InsuranceLineRow {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export function InsuranceLinesPanel({
  initialLines,
  canManage,
}: {
  initialLines: InsuranceLineRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleToggle(line: InsuranceLineRow) {
    setBusyId(line.id);
    setError(null);
    const result = await setInsuranceLineActiveAction({ lineId: line.id, isActive: !line.isActive });
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "No se pudo actualizar.");
      return;
    }
    router.refresh();
  }

  async function handleCreate() {
    if (!name.trim() || !code.trim()) {
      setError("Completa nombre y código.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createInsuranceLineAction({ name, code });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "No se pudo crear la línea.");
      return;
    }
    setName("");
    setCode("");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-[var(--status-critical-bg)] bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        {initialLines.map((line) => (
          <div
            key={line.id}
            className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <Badge status={line.isActive ? "info" : "neutral"}>{line.name}</Badge>
              <span className="text-xs text-[var(--ink-muted)]">{line.code}</span>
            </div>
            {canManage && (
              <button
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
                  line.isActive ? "text-[var(--status-positive)]" : "text-[var(--ink-muted)]"
                } hover:bg-[var(--surface-hover)] disabled:opacity-50`}
                disabled={busyId === line.id}
                onClick={() => handleToggle(line)}
              >
                <Power className="h-3.5 w-3.5" />
                {line.isActive ? "Activa" : "Inactiva"}
              </button>
            )}
          </div>
        ))}
        {initialLines.length === 0 && (
          <p className="text-sm text-[var(--ink-muted)]">No hay líneas de negocio todavía.</p>
        )}
      </div>

      {canManage && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--border-hairline)] p-3">
          <FieldWrapper label="Nombre">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='Ej. "Vida"' className="w-44" />
          </FieldWrapper>
          <FieldWrapper label="Código">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej. VIDA" className="w-32" />
          </FieldWrapper>
          <Button size="sm" variant="secondary" disabled={saving} onClick={handleCreate}>
            <Plus className="h-4 w-4" /> Agregar línea
          </Button>
        </div>
      )}
    </div>
  );
}
