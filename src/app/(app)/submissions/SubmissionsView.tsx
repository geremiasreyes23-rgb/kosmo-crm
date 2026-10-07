"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock, Search, Send, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { Badge, type BadgeStatus } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Input, Textarea } from "@/components/ui/Field";
import { PersonChip } from "@/components/ui/PersonAvatar";
import { LineFields } from "@/components/leads/form/LineFields";
import { cn, formatDate } from "@/lib/utils";
import { submissionFieldDefs, type FieldErrors, type LineCode, type LineValues } from "@/lib/leads/lineSchema";
import { saveSubmissionAction } from "./actions";

export type SubmissionStatusValue = "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface SubmissionRow {
  id: string;
  leadCode: string;
  name: string;
  phone: string;
  dob: string;
  state: string;
  lineCode: LineCode | null;
  lineName: string;
  agentId?: string;
  agentName: string;
  status: SubmissionStatusValue;
  requestedAt: string | null;
  submittedAt: string | null;
  submittedByName: string;
  submittedById?: string;
  notes: string;
  values: LineValues;
}

const STATUS_META: Record<SubmissionStatusValue, { label: string; badge: BadgeStatus; icon: typeof Clock }> = {
  PENDING: { label: "Pendiente", badge: "warning", icon: Clock },
  SUBMITTED: { label: "Sometido", badge: "info", icon: Send },
  APPROVED: { label: "Aprobado", badge: "good", icon: CheckCircle2 },
  REJECTED: { label: "Rechazado", badge: "critical", icon: XCircle },
};

const FILTERS: { key: SubmissionStatusValue | "ALL"; label: string }[] = [
  { key: "PENDING", label: "Pendientes" },
  { key: "SUBMITTED", label: "Sometidos" },
  { key: "APPROVED", label: "Aprobados" },
  { key: "REJECTED", label: "Rechazados" },
  { key: "ALL", label: "Todos" },
];

export function SubmissionsView({ initialRows }: { initialRows: SubmissionRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<SubmissionStatusValue | "ALL">("PENDING");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SubmissionRow | null>(null);
  const [values, setValues] = useState<LineValues>({});
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<SubmissionStatusValue | "save" | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: initialRows.length };
    for (const r of initialRows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [initialRows]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialRows.filter((r) => {
      if (filter !== "ALL" && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.leadCode.toLowerCase().includes(q) ||
        r.agentName.toLowerCase().includes(q) ||
        r.lineName.toLowerCase().includes(q)
      );
    });
  }, [initialRows, filter, search]);

  function open(row: SubmissionRow) {
    setSelected(row);
    setValues(row.values);
    setNotes(row.notes);
    setErrors({});
    setFormError(null);
  }

  async function save(status?: SubmissionStatusValue) {
    if (!selected) return;
    setBusy(status ?? "save");
    setFormError(null);
    const r = await saveSubmissionAction({ leadId: selected.id, values, notes, status });
    setBusy(null);
    if (!r.ok) {
      setFormError(r.error ?? "No se pudo guardar.");
      if (r.fieldErrors) setErrors(r.fieldErrors);
      return;
    }
    setSelected(null);
    router.refresh();
  }

  const fieldDefs = selected?.lineCode ? submissionFieldDefs(selected.lineCode) : [];

  return (
    <div>
      <PageHeader title="Envíos" description="Leads listos para someter a la aseguradora y su resultado." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--surface-card)] p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                filter === f.key
                  ? "bg-[var(--brand-500)] text-white"
                  : "text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
              )}
            >
              {f.label}
              <span className={cn("ml-1.5 text-xs", filter === f.key ? "text-white/80" : "text-[var(--ink-muted)]")}>
                {counts[f.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
          <Input
            placeholder="Buscar lead, vendedor o línea..."
            className="w-64 rounded-full pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <Table>
          <THead>
            <tr>
              <Th>Lead</Th>
              <Th>Línea de negocio</Th>
              <Th>Vendedor</Th>
              <Th>Enviado a cola</Th>
              <Th>Estado</Th>
              <Th>Sometido por</Th>
              <Th />
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => {
              const meta = STATUS_META[r.status];
              return (
                <Tr key={r.id}>
                  <Td>
                    <Link href={`/leads/${r.id}`} className="font-medium hover:text-[var(--brand-600)]">
                      {r.name}
                    </Link>
                    <p className="text-xs text-[var(--ink-muted)]">{r.leadCode}</p>
                  </Td>
                  <Td>
                    <Badge status="neutral">{r.lineName}</Badge>
                  </Td>
                  <Td>
                    <PersonChip name={r.agentName} person={{ agentId: r.agentId }} />
                  </Td>
                  <Td>{r.requestedAt ? formatDate(r.requestedAt) : "—"}</Td>
                  <Td>
                    <Badge status={meta.badge}>
                      <meta.icon className="mr-1 h-3 w-3" /> {meta.label}
                    </Badge>
                  </Td>
                  <Td>
                    {r.submittedByName ? (
                      <PersonChip name={r.submittedByName} person={{ userId: r.submittedById }} />
                    ) : (
                      <span className="text-[var(--ink-muted)]">—</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" variant={r.status === "PENDING" ? "primary" : "secondary"} onClick={() => open(r)}>
                      {r.status === "PENDING" ? "Someter" : "Ver / editar"}
                    </Button>
                  </Td>
                </Tr>
              );
            })}
            {rows.length === 0 && (
              <Tr>
                <Td colSpan={7} className="py-10 text-center text-sm text-[var(--ink-muted)]">
                  No hay envíos en esta vista.
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => !busy && setSelected(null)}
        width="max-w-2xl"
        title={selected ? `Envío · ${selected.name}` : "Envío"}
        subtitle={selected ? `${selected.leadCode} · ${selected.lineName}` : undefined}
        footer={
          selected && (
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => save()} disabled={!!busy}>
                {busy === "save" ? "Guardando..." : "Guardar"}
              </Button>
              {selected.status !== "REJECTED" && (
                <Button variant="secondary" size="sm" onClick={() => save("REJECTED")} disabled={!!busy}>
                  <XCircle className="h-4 w-4" /> Rechazado
                </Button>
              )}
              {selected.status === "PENDING" ? (
                <Button size="sm" onClick={() => save("SUBMITTED")} disabled={!!busy}>
                  <Send className="h-4 w-4" /> {busy === "SUBMITTED" ? "Guardando..." : "Marcar como sometido"}
                </Button>
              ) : selected.status !== "APPROVED" ? (
                <Button size="sm" onClick={() => save("APPROVED")} disabled={!!busy}>
                  <CheckCircle2 className="h-4 w-4" /> {busy === "APPROVED" ? "Guardando..." : "Aprobado"}
                </Button>
              ) : null}
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--status-critical)] bg-[var(--status-critical-bg)] px-3 py-2 text-sm text-[var(--status-critical)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-xl bg-[var(--surface-sunken)] px-4 py-3 text-sm sm:grid-cols-4">
              <Info label="Teléfono" value={selected.phone} />
              <Info label="Nacimiento" value={selected.dob ? formatDate(selected.dob) : ""} />
              <Info label="Estado (EE. UU.)" value={selected.state} />
              <Info label="Estado del envío" value={STATUS_META[selected.status].label} />
            </div>

            <section>
              <h3 className="mb-3 text-sm font-semibold">Datos del envío</h3>
              {selected.lineCode && fieldDefs.length > 0 ? (
                <LineFields
                  fields={fieldDefs.map((d) => d.field)}
                  ctx={{
                    code: selected.lineCode,
                    values,
                    setValue: (key, v) => setValues((p) => ({ ...p, [key]: v })),
                    errors,
                    clearError: (path) =>
                      setErrors((p) => {
                        const n = { ...p };
                        delete n[path];
                        return n;
                      }),
                    dob: selected.dob,
                    carriers: [],
                    sensitiveInputs: {},
                    setSensitive: () => {},
                    savedMasks: {},
                  }}
                />
              ) : (
                <p className="text-sm text-[var(--ink-muted)]">Esta línea no tiene campos de envío definidos.</p>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Notas del envío</h3>
              <Textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Pendiente firma del cliente, número de referencia de la aseguradora..."
              />
            </section>

            {selected.submittedAt && (
              <p className="text-xs text-[var(--ink-muted)]">
                Sometido el {formatDate(selected.submittedAt)}
                {selected.submittedByName ? ` por ${selected.submittedByName}` : ""}.
              </p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-[var(--ink-muted)]">{label}</p>
      <p className="truncate font-medium">{value || "—"}</p>
    </div>
  );
}
