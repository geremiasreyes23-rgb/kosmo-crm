"use client";

import { useMemo, useState } from "react";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { Badge, type BadgeStatus } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Field";
import type { AuditLogRowVM } from "@/app/(app)/settings/audit-data";
import { formatDate, formatTime } from "@/lib/utils";
import { Search, ShieldCheck } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Creación",
  UPDATE: "Actualización",
  DELETE: "Eliminación",
  STAGE_CHANGE: "Cambio de etapa",
  AGENT_CHANGE: "Cambio de vendedor",
  SENSITIVE_ACCESS: "Dato sensible",
  POLICY_CHANGE: "Cambio de póliza",
  COMMISSION_CHANGE: "Cambio de comisión",
};

const ACTION_BADGE: Record<string, BadgeStatus> = {
  CREATE: "good",
  UPDATE: "info",
  DELETE: "critical",
  STAGE_CHANGE: "info",
  AGENT_CHANGE: "warning",
  SENSITIVE_ACCESS: "serious",
  POLICY_CHANGE: "warning",
  COMMISSION_CHANGE: "warning",
};

const ENTITY_LABELS: Record<string, string> = {
  Lead: "Lead",
  Client: "Cliente",
  Sale: "Venta",
  Policy: "Póliza",
  Commission: "Comisión",
  User: "Usuario",
  SensitiveField: "Dato sensible",
  Recognition: "Reconocimiento",
};

/** Describe el cambio en una sola línea legible, a partir de
 * fieldName/oldValue/newValue — nunca se muestra el valor real de un campo
 * sensible (SENSITIVE_ACCESS jamás llega con oldValue/newValue, ver
 * clients/actions.ts). */
function describeChange(row: AuditLogRowVM): string {
  if (row.action === "SENSITIVE_ACCESS") {
    return row.fieldName ? `Campo: ${row.fieldName}` : "—";
  }
  if (row.fieldName && row.oldValue != null && row.newValue != null) {
    return `${row.fieldName}: ${row.oldValue} → ${row.newValue}`;
  }
  if (row.fieldName && row.newValue != null) {
    return `${row.fieldName}: ${row.newValue}`;
  }
  if (row.fieldName) return row.fieldName;
  return "—";
}

export function AuditLogPanel({ entries }: { entries: AuditLogRowVM[] }) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const allEntityTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.entityType);
    return Array.from(set).sort();
  }, [entries]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (actionFilter && e.action !== actionFilter) return false;
      if (entityFilter && e.entityType !== entityFilter) return false;
      if (!q) return true;
      return (
        e.userName.toLowerCase().includes(q) ||
        e.entityId.toLowerCase().includes(q) ||
        (e.fieldName ?? "").toLowerCase().includes(q) ||
        (e.newValue ?? "").toLowerCase().includes(q)
      );
    });
  }, [entries, search, actionFilter, entityFilter]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
          <Input
            className="pl-9"
            placeholder="Buscar por usuario, registro o campo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select className="w-auto" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="">Todas las acciones</option>
          {Object.keys(ACTION_LABELS).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a]}
            </option>
          ))}
        </Select>
        <Select className="w-auto" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
          <option value="">Todos los registros</option>
          {allEntityTypes.map((t) => (
            <option key={t} value={t}>
              {ENTITY_LABELS[t] ?? t}
            </option>
          ))}
        </Select>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-sunken)]">
            <ShieldCheck className="h-5 w-5 text-[var(--ink-muted)]" />
          </div>
          <p className="text-sm text-[var(--ink-muted)]">
            {entries.length === 0 ? "Todavía no hay eventos de auditoría." : "Sin resultados para ese filtro."}
          </p>
        </div>
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Cuándo</Th>
              <Th>Usuario</Th>
              <Th>Acción</Th>
              <Th>Registro</Th>
              <Th>Detalle</Th>
            </Tr>
          </THead>
          <TBody>
            {visible.map((e) => (
              <Tr key={e.id}>
                <Td className="whitespace-nowrap text-xs text-[var(--ink-muted)]">
                  {formatDate(e.createdAt)} · {formatTime(e.createdAt)}
                </Td>
                <Td className="font-medium">{e.userName}</Td>
                <Td>
                  <Badge status={ACTION_BADGE[e.action] ?? "neutral"}>{ACTION_LABELS[e.action] ?? e.action}</Badge>
                </Td>
                <Td className="text-xs">
                  <span className="font-medium text-[var(--ink-primary)]">{ENTITY_LABELS[e.entityType] ?? e.entityType}</span>{" "}
                  <span className="font-mono text-[var(--ink-muted)]">{e.entityId.slice(0, 8)}</span>
                </Td>
                <Td className="text-xs text-[var(--ink-secondary)]">{describeChange(e)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      {entries.length >= 300 && (
        <p className="mt-3 text-xs text-[var(--ink-muted)]">
          Mostrando los últimos 300 eventos. El historial completo queda guardado en la base de datos.
        </p>
      )}
    </div>
  );
}
