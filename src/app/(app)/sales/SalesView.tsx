"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CrmSubNav } from "@/components/layout/CrmSubNav";
import { Button } from "@/components/ui/Button";
import { KanbanBoard } from "@/components/ui/Kanban";
import { Drawer } from "@/components/ui/Drawer";
import { FieldWrapper, Input, Select } from "@/components/ui/Field";
import type { PipelineStage, Sale } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { Plus, Handshake, Search } from "lucide-react";

const emptyForm = {
  clientName: "",
  agentName: "Carlos Gómez",
  line: "Medicare Advantage",
  carrier: "Humana",
  premium: 0,
  expectedCommission: 0,
};

export function SalesView({
  initialSales,
  stages,
}: {
  initialSales: Sale[];
  stages: PipelineStage[];
}) {
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [initialStage, setInitialStage] = useState(stages[0]?.id ?? "s_quote");
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");

  const nextId = useMemo(() => `S-${505 + sales.length}`, [sales.length]);

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
    setSales((prev) => prev.map((s) => (s.id === itemId ? { ...s, stageId: newStageId } : s)));
  }

  function openDrawer(stageId: string) {
    setInitialStage(stageId);
    setForm(emptyForm);
    setDrawerOpen(true);
  }

  function handleSubmit() {
    if (!form.clientName) return;
    const newSale: Sale = {
      id: nextId,
      clientName: form.clientName,
      agentName: form.agentName,
      line: form.line,
      carrier: form.carrier,
      premium: Number(form.premium) || 0,
      stageId: initialStage,
      saleDate: new Date().toISOString().slice(0, 10),
      expectedCommission: Number(form.expectedCommission) || 0,
    };
    setSales((prev) => [newSale, ...prev]);
    setDrawerOpen(false);
  }

  return (
    <div>
      <CrmSubNav />
      <PageHeader
        title="Ventas"
        actions={
          <Button size="sm" className="rounded-full" onClick={() => openDrawer(stages[0]?.id ?? "s_quote")}>
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
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[9px] font-semibold text-[var(--ink-secondary)]">
                  {sale.agentName ? sale.agentName.charAt(0).toUpperCase() : "?"}
                </div>
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
        subtitle={`Se creará en la etapa "${stages.find((s) => s.id === initialStage)?.name}"`}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              Crear venta
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FieldWrapper label="Cliente / Lead">
            <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          </FieldWrapper>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Línea de negocio">
              <Select value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })}>
                <option>Medicare Advantage</option>
                <option>Obamacare</option>
                <option>Family Heritage</option>
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Carrier">
              <Input value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} />
            </FieldWrapper>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Prima mensual">
              <Input
                type="number"
                value={form.premium}
                onChange={(e) => setForm({ ...form, premium: Number(e.target.value) })}
              />
            </FieldWrapper>
            <FieldWrapper label="Comisión esperada">
              <Input
                type="number"
                value={form.expectedCommission}
                onChange={(e) => setForm({ ...form, expectedCommission: Number(e.target.value) })}
              />
            </FieldWrapper>
          </div>
          <FieldWrapper label="Vendedor">
            <Select value={form.agentName} onChange={(e) => setForm({ ...form, agentName: e.target.value })}>
              <option>Carlos Gómez</option>
              <option>Ana Ibarra</option>
            </Select>
          </FieldWrapper>
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
