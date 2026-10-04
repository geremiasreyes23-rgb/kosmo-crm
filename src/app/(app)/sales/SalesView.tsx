"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { CrmSubNav } from "@/components/layout/CrmSubNav";
import { Button } from "@/components/ui/Button";
import { KanbanBoard } from "@/components/ui/Kanban";
import { Drawer } from "@/components/ui/Drawer";
import { FieldWrapper, Input, Select } from "@/components/ui/Field";
import type { PipelineStage, Sale, SaleMethod } from "@/types";
import type { SaleFormOptions } from "./data";
import type { RelatedEntityOptions } from "@/lib/relatedRecords";
import { formatCurrency } from "@/lib/utils";
import { Plus, Handshake, Search } from "lucide-react";
import { createSaleAction, moveSaleStageAction } from "./actions";
import { PersonSelect, agentOptions } from "@/components/ui/PersonSelect";
import { PersonAvatar } from "@/components/ui/PersonAvatar";

const METHOD_LABELS: Record<SaleMethod, string> = {
  PHONE: "Teléfono",
  IN_PERSON: "En persona",
  VIRTUAL: "Virtual",
  ONLINE: "En línea",
};

function emptyForm() {
  return {
    related: "",
    insuranceLineId: "",
    carrierId: "",
    planName: "",
    premium: "",
    expectedCommission: "",
    method: "" as SaleMethod | "",
    agentId: "",
  };
}

export function SalesView({
  initialSales,
  stages,
  formOptions,
  relatedOptions,
  canAssignOthers,
}: {
  initialSales: Sale[];
  stages: PipelineStage[];
  formOptions: SaleFormOptions;
  relatedOptions: RelatedEntityOptions;
  canAssignOthers: boolean;
}) {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>(initialSales);
  useEffect(() => setSales(initialSales), [initialSales]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [initialStage, setInitialStage] = useState(stages[0]?.id ?? "");
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const availableCarriers = useMemo(() => {
    if (!form.insuranceLineId) return formOptions.carriers;
    return formOptions.carriers.filter((c) => c.insuranceLineIds.includes(form.insuranceLineId));
  }, [formOptions.carriers, form.insuranceLineId]);

  const visibleSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(
      (s) =>
        s.clientName.toLowerCase().includes(q) ||
        s.agentName.toLowerCase().includes(q) ||
        s.carrier.toLowerCase().includes(q)
    );
  }, [sales, search]);

  function handleMove(itemId: string, newStageId: string) {
    const previous = sales;
    setSales((prev) => prev.map((s) => (s.id === itemId ? { ...s, stageId: newStageId } : s)));
    moveSaleStageAction(itemId, newStageId).then((result) => {
      if (!result.ok) {
        setSales(previous);
        window.alert(result.error ?? "No se pudo mover la venta de etapa.");
      } else {
        router.refresh();
      }
    });
  }

  function openDrawer(stageId: string) {
    setInitialStage(stageId);
    setForm(emptyForm());
    setFormError(null);
    setDrawerOpen(true);
  }

  async function handleSubmit() {
    const [kind, id] = form.related.split(":");
    if (!kind || !id) {
      setFormError("Vincula la venta a un cliente o a un lead.");
      return;
    }
    if (!form.insuranceLineId || !form.carrierId) {
      setFormError("Línea de negocio y carrier son obligatorios.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const result = await createSaleAction({
      relatedLeadId: kind === "lead" ? id : undefined,
      relatedClientId: kind === "client" ? id : undefined,
      insuranceLineId: form.insuranceLineId,
      carrierId: form.carrierId,
      planName: form.planName || undefined,
      premium: form.premium ? Number(form.premium) : undefined,
      expectedCommission: form.expectedCommission ? Number(form.expectedCommission) : undefined,
      method: form.method || undefined,
      stageId: initialStage,
      agentId: canAssignOthers ? form.agentId || undefined : undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error ?? "No se pudo crear la venta.");
      return;
    }
    setDrawerOpen(false);
    router.refresh();
  }

  return (
    <div>
      <CrmSubNav />
      <PageHeader
        title="Ventas"
        actions={
          <Button size="sm" className="rounded-full" onClick={() => openDrawer(stages[0]?.id ?? "")}>
            <Plus className="h-4 w-4" /> Crear
          </Button>
        }
      />

      <div className="mb-4 relative w-56">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
        <Input
          placeholder="Buscar..."
          className="rounded-full pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <KanbanBoard
        stages={stages}
        items={visibleSales}
        getStageId={(s) => s.stageId}
        getAmount={(s) => s.premium}
        onMove={handleMove}
        onAddClick={openDrawer}
        renderCard={(sale) => (
          <div className="rounded-r-lg rounded-l-none bg-[var(--surface-card)] p-3 shadow-sm hover:shadow-md">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-100)] text-[var(--brand-700)]">
                <Handshake className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{sale.clientName}</p>
                <p className="truncate text-xs text-[var(--ink-muted)]">{sale.line} · {sale.carrier}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between border-t border-[var(--border-grid)] pt-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <PersonAvatar name={sale.agentName || "?"} person={{ agentId: sale.agentId }} size={20} />
                <span className="truncate text-xs text-[var(--ink-muted)]">{sale.agentName}</span>
              </div>
              <span className="shrink-0 text-xs font-semibold text-[var(--brand-600)]">
                {formatCurrency(sale.expectedCommission ?? 0)}
              </span>
            </div>
          </div>
        )}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Nueva venta"
        subtitle={`Se creará en la etapa "${stages.find((s) => s.id === initialStage)?.name ?? ""}"`}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creando..." : "Crear venta"}
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
          <FieldWrapper label="Cliente / Lead">
            <Select value={form.related} onChange={(e) => setForm({ ...form, related: e.target.value })}>
              <option value="">Selecciona uno</option>
              {relatedOptions.clients.length > 0 && (
                <optgroup label="Clientes">
                  {relatedOptions.clients.map((c) => (
                    <option key={c.id} value={`client:${c.id}`}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {relatedOptions.leads.length > 0 && (
                <optgroup label="Leads">
                  {relatedOptions.leads.map((l) => (
                    <option key={l.id} value={`lead:${l.id}`}>
                      {l.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </FieldWrapper>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Línea de negocio">
              <Select
                value={form.insuranceLineId}
                onChange={(e) => setForm({ ...form, insuranceLineId: e.target.value, carrierId: "" })}
              >
                <option value="">Selecciona</option>
                {formOptions.insuranceLines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Carrier">
              <Select value={form.carrierId} onChange={(e) => setForm({ ...form, carrierId: e.target.value })}>
                <option value="">Selecciona</option>
                {availableCarriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FieldWrapper>
          </div>
          <FieldWrapper label="Plan (opcional)">
            <Input value={form.planName} onChange={(e) => setForm({ ...form, planName: e.target.value })} />
          </FieldWrapper>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Prima mensual">
              <Input
                type="number"
                value={form.premium}
                onChange={(e) => setForm({ ...form, premium: e.target.value })}
              />
            </FieldWrapper>
            <FieldWrapper label="Comisión esperada">
              <Input
                type="number"
                value={form.expectedCommission}
                onChange={(e) => setForm({ ...form, expectedCommission: e.target.value })}
              />
            </FieldWrapper>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Método">
              <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as SaleMethod | "" })}>
                <option value="">Sin especificar</option>
                {(Object.keys(METHOD_LABELS) as SaleMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </FieldWrapper>
            {canAssignOthers && (
              <FieldWrapper label="Vendedor">
                <PersonSelect
                  value={form.agentId}
                  onChange={(v) => setForm({ ...form, agentId: v })}
                  options={agentOptions(formOptions.agents)}
                  emptyLabel="Yo mismo"
                />
              </FieldWrapper>
            )}
          </div>
          <FieldWrapper label="Etapa inicial">
            <Select value={initialStage} onChange={(e) => setInitialStage(e.target.value)}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FieldWrapper>
        </div>
      </Drawer>
    </div>
  );
}
