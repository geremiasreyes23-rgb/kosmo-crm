"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Power } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FieldWrapper, Input } from "@/components/ui/Field";
import {
  createCarrierAction,
  setCarrierStatusAction,
  setCarrierLinesAction,
} from "@/app/(app)/settings/catalogs-actions";

export interface CarrierRow {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  insuranceLineIds: string[];
}

export function CarriersPanel({
  initialCarriers,
  insuranceLines,
  canManage,
}: {
  initialCarriers: CarrierRow[];
  insuranceLines: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [newLineIds, setNewLineIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleToggleStatus(carrier: CarrierRow) {
    setBusyId(carrier.id);
    setError(null);
    const result = await setCarrierStatusAction({
      carrierId: carrier.id,
      status: carrier.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
    });
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "No se pudo actualizar.");
      return;
    }
    router.refresh();
  }

  async function handleToggleLine(carrier: CarrierRow, lineId: string) {
    const nextIds = carrier.insuranceLineIds.includes(lineId)
      ? carrier.insuranceLineIds.filter((id) => id !== lineId)
      : [...carrier.insuranceLineIds, lineId];
    setBusyId(carrier.id);
    setError(null);
    const result = await setCarrierLinesAction({ carrierId: carrier.id, insuranceLineIds: nextIds });
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "No se pudo actualizar.");
      return;
    }
    router.refresh();
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("El nombre del carrier no puede estar vacío.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createCarrierAction({ name, insuranceLineIds: newLineIds });
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "No se pudo crear el carrier.");
      return;
    }
    setName("");
    setNewLineIds([]);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-[var(--status-critical-bg)] bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
          {error}
        </p>
      )}

      <div className="space-y-2">
        {initialCarriers.map((carrier) => (
          <div key={carrier.id} className="rounded-lg border border-[var(--border-hairline)] p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{carrier.name}</p>
              {canManage && (
                <button
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
                    carrier.status === "ACTIVE" ? "text-[var(--status-positive)]" : "text-[var(--ink-muted)]"
                  } hover:bg-[var(--surface-hover)] disabled:opacity-50`}
                  disabled={busyId === carrier.id}
                  onClick={() => handleToggleStatus(carrier)}
                >
                  <Power className="h-3.5 w-3.5" />
                  {carrier.status === "ACTIVE" ? "Activo" : "Inactivo"}
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {insuranceLines.map((line) => {
                const checked = carrier.insuranceLineIds.includes(line.id);
                return canManage ? (
                  <button
                    key={line.id}
                    disabled={busyId === carrier.id}
                    onClick={() => handleToggleLine(carrier, line.id)}
                  >
                    <Badge status={checked ? "info" : "neutral"}>{line.name}</Badge>
                  </button>
                ) : checked ? (
                  <Badge key={line.id} status="info">
                    {line.name}
                  </Badge>
                ) : null;
              })}
              {carrier.insuranceLineIds.length === 0 && (
                <span className="text-xs text-[var(--ink-muted)]">Sin líneas asociadas todavía.</span>
              )}
            </div>
          </div>
        ))}
        {initialCarriers.length === 0 && <p className="text-sm text-[var(--ink-muted)]">No hay carriers todavía.</p>}
      </div>

      {canManage && (
        <div className="space-y-2 rounded-lg border border-[var(--border-hairline)] p-3">
          <FieldWrapper label="Nuevo carrier">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='Ej. "Aetna"' />
          </FieldWrapper>
          <div className="flex flex-wrap gap-1.5">
            {insuranceLines.map((line) => {
              const checked = newLineIds.includes(line.id);
              return (
                <button
                  key={line.id}
                  onClick={() =>
                    setNewLineIds((prev) => (checked ? prev.filter((id) => id !== line.id) : [...prev, line.id]))
                  }
                >
                  <Badge status={checked ? "info" : "neutral"}>{line.name}</Badge>
                </button>
              );
            })}
          </div>
          <Button size="sm" variant="secondary" disabled={saving} onClick={handleCreate}>
            <Plus className="h-4 w-4" /> Agregar carrier
          </Button>
        </div>
      )}
    </div>
  );
}
