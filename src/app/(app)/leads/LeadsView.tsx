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
import { Input, Select } from "@/components/ui/Field";
import { KanbanBoard } from "@/components/ui/Kanban";
import { LeadFormDrawer } from "@/components/leads/form/LeadFormDrawer";
import { useHiddenKeys } from "@/components/visibility/VisibilityProvider";
import { PersonSelect, agentOptions } from "@/components/ui/PersonSelect";
import { PersonAvatar, PersonChip } from "@/components/ui/PersonAvatar";
import { turning65 } from "@/lib/leads/lineSchema";
import { moveLeadStageAction } from "./actions";
import type { LeadFormOptions } from "./data";
import type { Lead, PipelineStage } from "@/types";
import { formatDate } from "@/lib/utils";
import { Plus, KanbanSquare, List, Phone, Search, Cake } from "lucide-react";

function stageName(stages: PipelineStage[], id: string) {
  return stages.find((s) => s.id === id)?.name ?? id;
}

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export function LeadsView({
  initialLeads,
  stages,
  formOptions,
  canAssignOthers,
  currentUserName,
  currentAgentId,
}: {
  initialLeads: Lead[];
  stages: PipelineStage[];
  formOptions: LeadFormOptions;
  /** false para un vendedor sin alcance "ver todo" — el lead siempre se le
   * asigna a sí mismo, así que el selector de Vendedor no tiene sentido. */
  canAssignOthers: boolean;
  currentUserName: string;
  currentAgentId: string | null;
}) {
  const router = useRouter();
  // Visibilidad por persona: columnas/datos ocultos para este usuario.
  const hiddenKeys = useHiddenKeys();
  const see = (k: string) => !hiddenKeys.has(`lead.common.${k}`);

  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  useEffect(() => setLeads(initialLeads), [initialLeads]);

  const [view, setView] = useState<"table" | "kanban">("kanban");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [initialStage, setInitialStage] = useState(stages[0]?.id ?? "");
  const [lineFilter, setLineFilter] = useState("");

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  const visibleLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (sourceFilter && l.source !== sourceFilter) return false;
      if (agentFilter && l.agentName !== agentFilter) return false;
      if (lineFilter && l.productLine !== lineFilter) return false;
      if (!q) return true;
      return (
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.leadCode ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, search, sourceFilter, agentFilter, lineFilter]);

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
    setDrawerOpen(true);
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
              <Plus className="h-4 w-4" /> Crear lead
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
        <Select className="w-48 rounded-full" value={lineFilter} onChange={(e) => setLineFilter(e.target.value)}>
          <option value="">Línea de negocio</option>
          {formOptions.insuranceLines.map((l) => (
            <option key={l.id} value={l.name}>
              {l.name}
            </option>
          ))}
        </Select>
        {canAssignOthers && (
          <PersonSelect
            className="w-52"
            variant="pill"
            value={agentFilter}
            onChange={setAgentFilter}
            options={agentOptions(formOptions.agents, "name")}
            emptyLabel="Vendedor"
          />
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
                    {lead.leadCode ? `${lead.leadCode} · ` : ""}
                    {lead.productLine ?? lead.source}
                  </p>
                </div>
              </div>
              {see("phone") && lead.phone && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
                  <Phone className="h-3 w-3 shrink-0" /> {lead.phone}
                </p>
              )}
              {lead.lineCode === "MEDICARE" && turning65(lead.dob)?.status === "soon" && (
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--status-warning-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--status-warning)]">
                  <Cake className="h-3 w-3" /> {turning65(lead.dob)!.message}
                </p>
              )}
              <div className="mt-2.5 flex items-center justify-between border-t border-[var(--border-grid)] pt-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  {see("agentId") && (
                    <>
                      <PersonAvatar name={lead.agentName || "?"} person={{ agentId: lead.agentId }} size={20} />
                      <span className="truncate text-xs text-[var(--ink-muted)]">{lead.agentName}</span>
                    </>
                  )}
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
                {(see("phone") || see("email")) && <Th>Contacto</Th>}
                {see("sourceId") && <Th>Origen</Th>}
                <Th>Línea de negocio</Th>
                {see("agentId") && <Th>Vendedor</Th>}
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
                  {(see("phone") || see("email")) && (
                    <Td>
                      {see("phone") && <p>{lead.phone}</p>}
                      {see("email") && <p className="text-xs text-[var(--ink-muted)]">{lead.email}</p>}
                    </Td>
                  )}
                  {see("sourceId") && <Td>{lead.source}</Td>}
                  <Td>
                    {lead.productLine ? (
                      <Badge status="neutral">{lead.productLine}</Badge>
                    ) : (
                      <span className="text-xs text-[var(--ink-muted)]">—</span>
                    )}
                  </Td>
                  {see("agentId") && (
                    <Td>
                      <PersonChip name={lead.agentName} person={{ agentId: lead.agentId }} />
                    </Td>
                  )}
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

      <LeadFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode="create"
        formOptions={formOptions}
        stages={stages}
        initialStageId={initialStage}
        canAssignOthers={canAssignOthers}
        currentUserName={currentUserName}
        currentAgentId={currentAgentId}
      />
    </div>
  );
}
