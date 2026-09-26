"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { CrmSubNav } from "@/components/layout/CrmSubNav";
import { Card } from "@/components/ui/Card";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, FieldWrapper, Textarea } from "@/components/ui/Field";
import { KanbanBoard } from "@/components/ui/Kanban";
import { Drawer } from "@/components/ui/Drawer";
import { DynamicField } from "@/components/ui/DynamicField";
import { AddFieldMenu } from "@/components/ui/AddFieldMenu";
import { createLeadAction, moveLeadStageAction } from "./actions";
import type { LeadFormOptions } from "./data";
import type { Lead, PipelineStage } from "@/types";
import { formatDate } from "@/lib/utils";
import { Plus, KanbanSquare, List, Phone, Search, Sparkles } from "lucide-react";

function stageName(stages: PipelineStage[], id: string) {
  return stages.find((s) => s.id === id)?.name ?? id;
}

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function emptyForm() {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    state: "",
    sourceId: "",
    agentId: "",
  };
}

export function LeadsView({
  initialLeads,
  stages,
  formOptions,
  canAssignOthers,
  currentUserName,
}: {
  initialLeads: Lead[];
  stages: PipelineStage[];
  formOptions: LeadFormOptions;
  /** false para un vendedor sin alcance "ver todo" — el lead siempre se le
   * asigna a sí mismo, así que el selector de Vendedor no tiene sentido. */
  canAssignOthers: boolean;
  currentUserName: string;
}) {
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  useEffect(() => setLeads(initialLeads), [initialLeads]);

  const [view, setView] = useState<"table" | "kanban">("kanban");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [initialStage, setInitialStage] = useState(stages[0]?.id ?? "");
  const [form, setForm] = useState(emptyForm());
  const [interestedLineId, setInterestedLineId] = useState("");
  const [extraFields, setExtraFields] = useState<typeof formOptions.extraFields>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  const productFields = interestedLineId ? formOptions.fieldsByLine[interestedLineId] ?? [] : [];
  const availableExtra = formOptions.extraFields.filter(
    (f) => !extraFields.some((added) => added.key === f.key)
  );

  const visibleLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (sourceFilter && l.source !== sourceFilter) return false;
      if (agentFilter && l.agentName !== agentFilter) return false;
      if (!q) return true;
      return (
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, search, sourceFilter, agentFilter]);

  function setCustomValue(key: string, value: string) {
    setCustomValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleMove(itemId: string, newStageId: string) {
    const previous = leads;
    setLeads((prev) => prev.map((l) => (l.id === itemId ? { ...l, stageId: newStageId } : l)));
    moveLeadStageAction(itemId, newStageId).then((result) => {
      if (!result.ok) {
        // Revierte el cambio optimista si el servidor lo rechazó (permiso,
        // lead borrado por otra persona, etc.) y avisa por qué.
        setLeads(previous);
        window.alert(result.error ?? "No se pudo mover el lead.");
      } else {
        router.refresh();
      }
    });
  }

  function openDrawer(stageId: string) {
    setInitialStage(stageId);
    setForm(emptyForm());
    setInterestedLineId("");
    setExtraFields([]);
    setCustomValues({});
    setFormError(null);
    setDrawerOpen(true);
  }

  async function handleSubmit() {
    if (!form.firstName || !form.lastName) {
      setFormError("Nombre y apellido son obligatorios.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const result = await createLeadAction({
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone || undefined,
      email: form.email || undefined,
      state: form.state || undefined,
      sourceId: form.sourceId || undefined,
      agentId: canAssignOthers ? form.agentId || undefined : undefined,
      stageId: initialStage,
      interestedLineId: interestedLineId || undefined,
      customFieldValues: Object.keys(customValues).length ? customValues : undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error ?? "No se pudo crear el lead.");
      return;
    }
    setDrawerOpen(false);
    router.refresh();
  }

  return (
    <div>
      <CrmSubNav />
      <PageHeader
        title="Leads"
        actions={
          <>
            <div className="flex rounded-full border border-[var(--border-hairline)] p-0.5">
              <button
                onClick={() => setView("table")}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium ${
                  view === "table"
                    ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                    : "text-[var(--ink-secondary)]"
                }`}
              >
                <List className="h-4 w-4" /> Lista
              </button>
              <button
                onClick={() => setView("kanban")}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium ${
                  view === "kanban"
                    ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                    : "text-[var(--ink-secondary)]"
                }`}
              >
                <KanbanSquare className="h-4 w-4" /> Kanban
              </button>
            </div>
            <Button size="sm" className="rounded-full" onClick={() => openDrawer(stages[0]?.id ?? "")}>
              <Plus className="h-4 w-4" /> Crear
            </Button>
          </>
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
        <Select className="w-40 rounded-full" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="">Origen</option>
          {formOptions.sources.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </Select>
        {canAssignOthers && (
          <Select className="w-40 rounded-full" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
            <option value="">Vendedor</option>
            {formOptions.agents.map((a) => (
              <option key={a.id} value={a.name}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {view === "kanban" ? (
        <KanbanBoard
          stages={stages}
          items={visibleLeads}
          getStageId={(l) => l.stageId}
          onMove={handleMove}
          onAddClick={openDrawer}
          renderCard={(lead) => (
            <Link
              href={`/leads/${lead.id}`}
              className="block rounded-r-lg rounded-l-none bg-[var(--surface-card)] p-3 shadow-sm hover:shadow-md"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-100)] text-xs font-semibold text-[var(--brand-700)]">
                  {initials(lead.firstName, lead.lastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--ink-primary)]">
                    {lead.firstName} {lead.lastName}
                  </p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">
                    {lead.source}
                    {lead.productLine ? ` · ${lead.productLine}` : ""}
                  </p>
                </div>
              </div>
              {lead.phone && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
                  <Phone className="h-3 w-3 shrink-0" /> {lead.phone}
                </p>
              )}
              <div className="mt-2.5 flex items-center justify-between border-t border-[var(--border-grid)] pt-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[9px] font-semibold text-[var(--ink-secondary)]">
                    {lead.agentName ? lead.agentName.charAt(0).toUpperCase() : "?"}
                  </div>
                  <span className="truncate text-xs text-[var(--ink-muted)]">{lead.agentName}</span>
                </div>
                <span className="shrink-0 text-xs text-[var(--ink-muted)]">{formatDate(lead.createdAt)}</span>
              </div>
            </Link>
          )}
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>Lead</Th>
                <Th>Contacto</Th>
                <Th>Origen</Th>
                <Th>Producto</Th>
                <Th>Vendedor</Th>
                <Th>Etapa</Th>
                <Th>Creado</Th>
                <Th>Próximo seguimiento</Th>
              </Tr>
            </THead>
            <TBody>
              {visibleLeads.map((lead) => (
                <Tr key={lead.id}>
                  <Td>
                    <Link href={`/leads/${lead.id}`} className="font-medium text-[var(--brand-500)] hover:underline">
                      {lead.firstName} {lead.lastName}
                    </Link>
                  </Td>
                  <Td>
                    <p>{lead.phone}</p>
                    <p className="text-xs text-[var(--ink-muted)]">{lead.email}</p>
                  </Td>
                  <Td>{lead.source}</Td>
                  <Td>
                    {lead.productLine ? (
                      <Badge status="neutral">{lead.productLine}</Badge>
                    ) : (
                      <span className="text-xs text-[var(--ink-muted)]">—</span>
                    )}
                  </Td>
                  <Td>{lead.agentName}</Td>
                  <Td>
                    <Badge status="info">{stageName(stages, lead.stageId)}</Badge>
                  </Td>
                  <Td>{formatDate(lead.createdAt)}</Td>
                  <Td>{lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : "—"}</Td>
                </Tr>
              ))}
              {visibleLeads.length === 0 && (
                <Tr>
                  <Td colSpan={8}>
                    <p className="py-6 text-center text-sm text-[var(--ink-muted)]">
                      Sin leads que coincidan con el filtro.
                    </p>
                  </Td>
                </Tr>
              )}
            </TBody>
          </Table>
        </Card>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Nuevo lead"
        subtitle={`Se creará en la etapa "${stageName(stages, initialStage)}"`}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creando..." : "Crear lead"}
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
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Nombre">
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </FieldWrapper>
            <FieldWrapper label="Apellido">
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </FieldWrapper>
          </div>
          <FieldWrapper label="Teléfono">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(305) 555-0100" />
          </FieldWrapper>
          <FieldWrapper label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FieldWrapper>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Origen">
              <Select value={form.sourceId} onChange={(e) => setForm({ ...form, sourceId: e.target.value })}>
                <option value="">Selecciona...</option>
                {formOptions.sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FieldWrapper>
            {canAssignOthers ? (
              <FieldWrapper label="Vendedor">
                <Select value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })}>
                  <option value="">Sin asignar</option>
                  {formOptions.agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </FieldWrapper>
            ) : (
              <FieldWrapper label="Vendedor">
                <Input value={currentUserName} disabled />
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

          <div className="rounded-lg border border-[var(--brand-100)] bg-[var(--brand-50)] p-3">
            <FieldWrapper label="Producto / línea de interés">
              <Select value={interestedLineId} onChange={(e) => setInterestedLineId(e.target.value)}>
                <option value="">Sin definir todavía</option>
                {formOptions.insuranceLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name}
                  </option>
                ))}
              </Select>
            </FieldWrapper>
            {interestedLineId && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--brand-700)]">
                <Sparkles className="h-3.5 w-3.5" /> Los campos de abajo se ajustaron para esta línea.
              </p>
            )}
          </div>

          {productFields.length > 0 && (
            <div className="space-y-4 border-l-2 border-[var(--brand-100)] pl-4">
              {productFields.map((f) => (
                <DynamicField
                  key={f.key}
                  field={f}
                  value={customValues[f.key] ?? ""}
                  onChange={(v) => setCustomValue(f.key, v)}
                />
              ))}
            </div>
          )}

          <FieldWrapper label="Notas">
            <Textarea placeholder="Detalles adicionales del lead..." />
          </FieldWrapper>

          {extraFields.length > 0 && (
            <div className="space-y-4">
              {extraFields.map((f) => (
                <DynamicField
                  key={f.key}
                  field={f}
                  value={customValues[f.key] ?? ""}
                  onChange={(v) => setCustomValue(f.key, v)}
                  onRemove={() => setExtraFields((prev) => prev.filter((x) => x.key !== f.key))}
                />
              ))}
            </div>
          )}

          <AddFieldMenu
            catalog={availableExtra}
            onAdd={(f) => setExtraFields((prev) => [...prev, f])}
          />
        </div>
      </Drawer>
    </div>
  );
}
