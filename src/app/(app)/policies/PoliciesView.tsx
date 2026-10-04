"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { CrmSubNav } from "@/components/layout/CrmSubNav";
import { Card } from "@/components/ui/Card";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FieldWrapper, Input, Select } from "@/components/ui/Field";
import type { Policy, PolicyStatus } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Search } from "lucide-react";
import { createPolicyAction, updatePolicyStatusAction } from "./actions";
import type { PolicyFormOptions } from "./data";
import { PersonSelect, agentOptions } from "@/components/ui/PersonSelect";
import { PersonChip } from "@/components/ui/PersonAvatar";

const STATUS_OPTIONS: PolicyStatus[] = [
  "QUOTE",
  "APPLICATION",
  "PENDING",
  "APPROVED",
  "ACTIVE",
  "CANCELLED",
  "REJECTED",
  "CHARGEBACK",
];

const STATUS_LABELS: Record<PolicyStatus, string> = {
  QUOTE: "Cotización",
  APPLICATION: "Solicitud",
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  ACTIVE: "Activa",
  CANCELLED: "Cancelada",
  REJECTED: "Rechazada",
  CHARGEBACK: "Chargeback",
};

function emptyForm() {
  return {
    clientId: "",
    insuranceLineId: "",
    carrierId: "",
    planName: "",
    premium: "",
    policyNumber: "",
    agentId: "",
  };
}

export function PoliciesView({
  initialPolicies,
  formOptions,
  canAssignOthers,
}: {
  initialPolicies: Policy[];
  formOptions: PolicyFormOptions;
  canAssignOthers: boolean;
}) {
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [lineFilter, setLineFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const visiblePolicies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return policies.filter((p) => {
      if (lineFilter && p.line !== lineFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (p.policyNumber ?? "").toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q)
      );
    });
  }, [policies, search, lineFilter, statusFilter]);

  const availableCarriers = useMemo(() => {
    if (!form.insuranceLineId) return formOptions.carriers;
    return formOptions.carriers.filter((c) => c.insuranceLineIds.includes(form.insuranceLineId));
  }, [formOptions.carriers, form.insuranceLineId]);

  function openDrawer() {
    setForm(emptyForm());
    setFormError(null);
    setDrawerOpen(true);
  }

  async function handleSubmit() {
    if (!form.clientId || !form.insuranceLineId || !form.carrierId) {
      setFormError("Cliente, línea de negocio y carrier son obligatorios.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const result = await createPolicyAction({
      clientId: form.clientId,
      insuranceLineId: form.insuranceLineId,
      carrierId: form.carrierId,
      planName: form.planName || undefined,
      premium: form.premium ? Number(form.premium) : undefined,
      policyNumber: form.policyNumber || undefined,
      agentId: canAssignOthers ? form.agentId || undefined : undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error ?? "No se pudo crear la póliza.");
      return;
    }
    setDrawerOpen(false);
    router.refresh();
  }

  function handleStatusChange(policyId: string, status: PolicyStatus) {
    const previous = policies;
    setPolicies((prev) => prev.map((p) => (p.id === policyId ? { ...p, status } : p)));
    updatePolicyStatusAction(policyId, status).then((result) => {
      if (!result.ok) {
        setPolicies(previous);
        window.alert(result.error ?? "No se pudo actualizar el estado de la póliza.");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div>
      <CrmSubNav />
      <PageHeader
        title="Pólizas"
        actions={
          <Button size="sm" className="rounded-full" onClick={openDrawer}>
            <Plus className="h-4 w-4" /> Crear
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
          <Input
            placeholder="Buscar..."
            className="w-56 rounded-full pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select className="w-40 rounded-full" value={lineFilter} onChange={(e) => setLineFilter(e.target.value)}>
          <option value="">Línea</option>
          {formOptions.insuranceLines.map((l) => (
            <option key={l.id} value={l.name}>
              {l.name}
            </option>
          ))}
        </Select>
        <Select className="w-40 rounded-full" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Estado</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <Table>
          <THead>
            <Tr>
              <Th>Póliza</Th>
              <Th>Cliente</Th>
              <Th>Línea</Th>
              <Th>Carrier</Th>
              <Th>Plan</Th>
              <Th>Prima</Th>
              <Th>Efectiva</Th>
              <Th>Estado</Th>
              <Th>Vendedor</Th>
            </Tr>
          </THead>
          <TBody>
            {visiblePolicies.map((p) => (
              <Tr key={p.id}>
                <Td className="font-medium">{p.policyNumber ?? "—"}</Td>
                <Td>{p.clientName}</Td>
                <Td>{p.line}</Td>
                <Td>{p.carrier}</Td>
                <Td>{p.planName ?? "—"}</Td>
                <Td>{p.premium != null ? formatCurrency(p.premium) : "—"}</Td>
                <Td>{p.effectiveDate ? formatDate(p.effectiveDate) : "—"}</Td>
                <Td>
                  <Select
                    className="h-7 w-[150px] rounded-full py-0 text-xs"
                    value={p.status}
                    onChange={(e) => handleStatusChange(p.id, e.target.value as PolicyStatus)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <PersonChip name={p.agentName} person={{ agentId: p.agentId }} />
                </Td>
              </Tr>
            ))}
            {visiblePolicies.length === 0 && (
              <Tr>
                <Td colSpan={9}>
                  <p className="py-6 text-center text-sm text-[var(--ink-muted)]">
                    Sin pólizas que coincidan con el filtro.
                  </p>
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Nueva póliza"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creando..." : "Crear póliza"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-[var(--status-critical)]">
              {formError}
            </p>
          )}
          <FieldWrapper label="Cliente">
            <Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">Selecciona un cliente</option>
              {formOptions.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FieldWrapper>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Línea de negocio">
              <Select
                value={form.insuranceLineId}
                onChange={(e) => setForm({ ...form, insuranceLineId: e.target.value, carrierId: "" })}
              >
                <option value="">Selecciona una línea</option>
                {formOptions.insuranceLines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Carrier">
              <Select value={form.carrierId} onChange={(e) => setForm({ ...form, carrierId: e.target.value })}>
                <option value="">Selecciona un carrier</option>
                {availableCarriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FieldWrapper>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Número de póliza (opcional)">
              <Input value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} />
            </FieldWrapper>
            <FieldWrapper label="Plan">
              <Input value={form.planName} onChange={(e) => setForm({ ...form, planName: e.target.value })} />
            </FieldWrapper>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Prima">
              <Input
                type="number"
                value={form.premium}
                onChange={(e) => setForm({ ...form, premium: e.target.value })}
              />
            </FieldWrapper>
            {canAssignOthers && (
              <FieldWrapper label="Vendedor">
                <PersonSelect
                  value={form.agentId}
                  onChange={(v) => setForm({ ...form, agentId: v })}
                  options={agentOptions(formOptions.agents)}
                  emptyLabel="Sin asignar"
                />
              </FieldWrapper>
            )}
          </div>
        </div>
      </Drawer>
    </div>
  );
}
