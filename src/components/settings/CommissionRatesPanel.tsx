"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Power } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input, Select } from "@/components/ui/Field";
import {
  createCommissionRateAction,
  deactivateCommissionRateAction,
  type CreateCommissionRateInput,
} from "@/app/(app)/settings/commission-rates-actions";
import type { CommissionRateVM } from "@/types";
import { formatDate } from "@/lib/utils";
import { PersonSelect, agentOptions } from "@/components/ui/PersonSelect";
import { PersonChip } from "@/components/ui/PersonAvatar";

const emptyForm = {
  insuranceLineId: "",
  agentId: "",
  agentAmountOrPct: "",
  agentAmountType: "FIXED" as "FIXED" | "PERCENTAGE",
  managerPct: "",
  aorAmount: "",
};

export function CommissionRatesPanel({
  initialRates,
  insuranceLines,
  agents,
  canManage,
}: {
  initialRates: CommissionRateVM[];
  insuranceLines: { id: string; name: string }[];
  agents: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm);
    setFormError(null);
    setCreateOpen(true);
  }

  async function handleSubmit() {
    const amount = Number(form.agentAmountOrPct);
    if (!form.insuranceLineId) {
      setFormError("Selecciona una línea de negocio.");
      return;
    }
    if (!amount || amount <= 0) {
      setFormError("El monto o porcentaje del vendedor debe ser mayor a cero.");
      return;
    }

    const payload: CreateCommissionRateInput = {
      insuranceLineId: form.insuranceLineId,
      agentId: form.agentId || undefined,
      agentAmountOrPct: amount,
      agentAmountType: form.agentAmountType,
      managerPct: form.managerPct ? Number(form.managerPct) : undefined,
      aorAmount: form.aorAmount ? Number(form.aorAmount) : undefined,
    };

    setSaving(true);
    setFormError(null);
    const result = await createCommissionRateAction(payload);
    setSaving(false);
    if (!result.ok) {
      setFormError(result.error ?? "No se pudo crear la tarifa.");
      return;
    }
    setCreateOpen(false);
    router.refresh();
  }

  async function handleDeactivate(rate: CommissionRateVM) {
    if (!window.confirm(`¿Cerrar la vigencia de esta tarifa de ${rate.lineName}?`)) return;
    setBusyId(rate.id);
    setListError(null);
    const result = await deactivateCommissionRateAction(rate.id);
    setBusyId(null);
    if (!result.ok) {
      setListError(result.error ?? "No se pudo desactivar la tarifa.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--ink-muted)]">
          La comisión de cada póliza se calcula con la tarifa vigente al momento de la venta. Sin tarifa por
          agente, se usa la tarifa base de la línea.
        </p>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nueva tarifa
          </Button>
        )}
      </div>

      {listError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
          {listError}
        </p>
      )}

      <Table>
        <THead>
          <Tr>
            <Th>Línea</Th>
            <Th>Agente</Th>
            <Th>Vendedor</Th>
            <Th>Encargado %</Th>
            <Th>AOR</Th>
            <Th>Vigente desde</Th>
            <Th>Estado</Th>
            {canManage && <Th></Th>}
          </Tr>
        </THead>
        <TBody>
          {initialRates.map((r) => (
            <Tr key={r.id}>
              <Td>{r.lineName}</Td>
              <Td>{r.agentName ? <PersonChip name={r.agentName} person={{ agentId: r.agentId }} /> : <span className="text-[var(--ink-muted)]">Base (toda la línea)</span>}</Td>
              <Td>
                {r.agentAmountType === "PERCENTAGE" ? `${r.agentAmountOrPct}%` : `$${r.agentAmountOrPct}`}
              </Td>
              <Td>{r.managerPct != null ? `${r.managerPct}%` : "—"}</Td>
              <Td>{r.aorAmount != null ? `$${r.aorAmount}` : "—"}</Td>
              <Td>{formatDate(r.effectiveFrom)}</Td>
              <Td>
                <Badge status={r.isActive ? "good" : "neutral"}>{r.isActive ? "Vigente" : "Cerrada"}</Badge>
              </Td>
              {canManage && (
                <Td>
                  {r.isActive && (
                    <button
                      type="button"
                      title="Cerrar vigencia"
                      disabled={busyId === r.id}
                      onClick={() => handleDeactivate(r)}
                      className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  )}
                </Td>
              )}
            </Tr>
          ))}
          {initialRates.length === 0 && (
            <Tr>
              <Td colSpan={canManage ? 8 : 7}>
                <p className="py-6 text-center text-sm text-[var(--ink-muted)]">
                  Todavía no hay tarifas configuradas. Crea la primera con &quot;Nueva tarifa&quot;.
                </p>
              </Td>
            </Tr>
          )}
        </TBody>
      </Table>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nueva tarifa de comisión"
        description="Queda vigente de inmediato y cierra automáticamente cualquier tarifa anterior para la misma línea/agente."
      >
        <div className="space-y-4">
          {formError && (
            <p className="rounded-lg border border-red-200 bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
              {formError}
            </p>
          )}

          <FieldWrapper label="Línea de negocio">
            <Select value={form.insuranceLineId} onChange={(e) => setForm({ ...form, insuranceLineId: e.target.value })}>
              <option value="">Selecciona...</option>
              {insuranceLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </FieldWrapper>

          <FieldWrapper label="Agente (opcional, vacío = tarifa base de la línea)">
            <PersonSelect
              value={form.agentId}
              onChange={(v) => setForm({ ...form, agentId: v })}
              options={agentOptions(agents)}
              emptyLabel="Tarifa base (todos los agentes)"
            />
          </FieldWrapper>

          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Monto/% del vendedor">
              <Input
                type="number"
                value={form.agentAmountOrPct}
                onChange={(e) => setForm({ ...form, agentAmountOrPct: e.target.value })}
              />
            </FieldWrapper>
            <FieldWrapper label="Tipo">
              <Select
                value={form.agentAmountType}
                onChange={(e) => setForm({ ...form, agentAmountType: e.target.value as "FIXED" | "PERCENTAGE" })}
              >
                <option value="FIXED">Monto fijo</option>
                <option value="PERCENTAGE">Porcentaje</option>
              </Select>
            </FieldWrapper>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="% del encargado (opcional)">
              <Input type="number" value={form.managerPct} onChange={(e) => setForm({ ...form, managerPct: e.target.value })} />
            </FieldWrapper>
            <FieldWrapper label="Monto AOR (opcional)">
              <Input type="number" value={form.aorAmount} onChange={(e) => setForm({ ...form, aorAmount: e.target.value })} />
            </FieldWrapper>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              {saving ? "Creando..." : "Crear tarifa"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
