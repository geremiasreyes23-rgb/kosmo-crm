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
import { Input, Select, FieldWrapper } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Drawer";
import { createClientAction } from "./actions";
import type { ClientFormOptions } from "./data";
import type { Client } from "@/types";
import { formatDate, calculateAge } from "@/lib/utils";
import { Plus, Search } from "lucide-react";

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function emptyForm() {
  return {
    firstName: "",
    lastName: "",
    dob: "",
    phone: "",
    email: "",
    state: "",
    county: "",
    sourceId: "",
    agentId: "",
  };
}

export function ClientsView({
  initialClients,
  formOptions,
  canAssignOthers,
}: {
  initialClients: Client[];
  formOptions: ClientFormOptions;
  /** false para un vendedor sin alcance "ver todo" — el cliente siempre se
   * le asigna a sí mismo, así que el selector de Vendedor no tiene sentido
   * (mismo patrón que LeadsView). */
  canAssignOthers: boolean;
}) {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>(initialClients);
  useEffect(() => setClients(initialClients), [initialClients]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [lineFilter, setLineFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  const allLines = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) for (const l of c.linesOfBusiness) set.add(l);
    return Array.from(set).sort();
  }, [clients]);

  const visibleClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (lineFilter && !c.linesOfBusiness.includes(lineFilter)) return false;
      if (agentFilter && c.agentName !== agentFilter) return false;
      if (!q) return true;
      return (
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [clients, search, lineFilter, agentFilter]);

  function openDrawer() {
    setForm(emptyForm());
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
    const result = await createClientAction({
      firstName: form.firstName,
      lastName: form.lastName,
      dob: form.dob || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      state: form.state || undefined,
      county: form.county || undefined,
      sourceId: form.sourceId || undefined,
      agentId: canAssignOthers ? form.agentId || undefined : undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error ?? "No se pudo crear el cliente.");
      return;
    }
    setDrawerOpen(false);
    router.refresh();
  }

  return (
    <div>
      <CrmSubNav />
      <PageHeader
        title="Clientes"
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
          {allLines.map((l) => (
            <option key={l} value={l}>
              {l}
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

      <Card>
        <Table>
          <THead>
            <Tr>
              <Th>Cliente</Th>
              <Th>Edad</Th>
              <Th>Contacto</Th>
              <Th>Líneas</Th>
              <Th>Pólizas</Th>
              <Th>Vendedor</Th>
              <Th>Desde</Th>
            </Tr>
          </THead>
          <TBody>
            {visibleClients.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <Link href={`/clients/${c.id}`} className="flex items-center gap-2.5 font-medium text-[var(--ink-primary)] hover:text-[var(--brand-500)]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-100)] text-[10px] font-semibold text-[var(--brand-700)]">
                      {initials(c.firstName, c.lastName)}
                    </span>
                    {c.firstName} {c.lastName}
                  </Link>
                </Td>
                <Td>{c.dob ? calculateAge(c.dob) : "—"}</Td>
                <Td>{c.phone || c.email || "—"}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {c.linesOfBusiness.map((l) => (
                      <Badge key={l} status="neutral">{l}</Badge>
                    ))}
                    {c.linesOfBusiness.length === 0 && <span className="text-xs text-[var(--ink-muted)]">—</span>}
                  </div>
                </Td>
                <Td>{c.activePolicies}</Td>
                <Td>{c.agentName}</Td>
                <Td>{formatDate(c.createdAt)}</Td>
              </Tr>
            ))}
            {visibleClients.length === 0 && (
              <Tr>
                <Td colSpan={7} className="text-sm text-[var(--ink-muted)]">
                  Sin clientes que coincidan con la búsqueda.
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Nuevo cliente"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creando..." : "Crear cliente"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-[var(--status-critical)]">
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
          <FieldWrapper label="Fecha de nacimiento">
            <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          </FieldWrapper>
          <FieldWrapper label="Teléfono">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </FieldWrapper>
          <FieldWrapper label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FieldWrapper>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Condado">
              <Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} />
            </FieldWrapper>
            <FieldWrapper label="Estado">
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </FieldWrapper>
          </div>
          <FieldWrapper label="Origen">
            <Select value={form.sourceId} onChange={(e) => setForm({ ...form, sourceId: e.target.value })}>
              <option value="">Sin especificar</option>
              {formOptions.sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FieldWrapper>
          {canAssignOthers && (
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
          )}
        </div>
      </Drawer>
    </div>
  );
}
