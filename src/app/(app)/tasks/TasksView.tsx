"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/Field";
import { createTaskAction, updateTaskStatusAction } from "./actions";
import type { AssignableUser } from "./data";
import type { RelatedEntityOptions } from "@/lib/relatedRecords";
import type { CrmTask } from "@/types";
import { formatDate } from "@/lib/utils";
import { Check, Plus } from "lucide-react";

function emptyForm() {
  return {
    title: "",
    description: "",
    related: "",
    assignedToId: "",
    dueDate: new Date().toISOString().slice(0, 10),
    priority: "MEDIUM" as CrmTask["priority"],
  };
}

export function TasksView({
  initialTasks,
  relatedOptions,
  assignableUsers,
  canAssignOthers,
}: {
  initialTasks: CrmTask[];
  relatedOptions: RelatedEntityOptions;
  assignableUsers: AssignableUser[];
  canAssignOthers: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<CrmTask[]>(initialTasks);
  useEffect(() => setTasks(initialTasks), [initialTasks]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function openDrawer() {
    setForm(emptyForm());
    setFormError(null);
    setDrawerOpen(true);
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      setFormError("El título es obligatorio.");
      return;
    }
    const [kind, id] = form.related.split(":");
    setSubmitting(true);
    setFormError(null);
    const result = await createTaskAction({
      title: form.title,
      description: form.description || undefined,
      relatedLeadId: kind === "lead" ? id : undefined,
      relatedClientId: kind === "client" ? id : undefined,
      assignedToId: canAssignOthers ? form.assignedToId || undefined : undefined,
      dueDate: form.dueDate || undefined,
      priority: form.priority,
    });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error ?? "No se pudo crear la tarea.");
      return;
    }
    setDrawerOpen(false);
    router.refresh();
  }

  async function handleComplete(taskId: string) {
    setBusyId(taskId);
    await updateTaskStatusAction(taskId, "COMPLETED");
    setBusyId(null);
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Tareas"
        description={`${tasks.filter((t) => t.status !== "COMPLETED").length} tareas activas`}
        actions={
          <Button size="sm" onClick={openDrawer}>
            <Plus className="h-4 w-4" /> Nueva tarea
          </Button>
        }
      />
      <Card>
        <Table>
          <THead>
            <Tr>
              <Th>Tarea</Th>
              <Th>Relacionado a</Th>
              <Th>Asignado a</Th>
              <Th>Vence</Th>
              <Th>Prioridad</Th>
              <Th>Estado</Th>
              <Th></Th>
            </Tr>
          </THead>
          <TBody>
            {tasks.map((t) => (
              <Tr key={t.id}>
                <Td className="font-medium">{t.title}</Td>
                <Td>{t.relatedTo}</Td>
                <Td>{t.assignedTo}</Td>
                <Td>{t.dueDate ? formatDate(t.dueDate) : "—"}</Td>
                <Td><Badge status={statusToBadgeVariant(t.priority)}>{t.priority}</Badge></Td>
                <Td><Badge status={statusToBadgeVariant(t.status)}>{t.status}</Badge></Td>
                <Td>
                  {t.status !== "COMPLETED" && t.status !== "CANCELLED" && (
                    <button
                      type="button"
                      onClick={() => handleComplete(t.id)}
                      disabled={busyId === t.id}
                      className="flex items-center gap-1 text-xs font-medium text-[var(--brand-500)] hover:underline disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Completar
                    </button>
                  )}
                </Td>
              </Tr>
            ))}
            {tasks.length === 0 && (
              <Tr>
                <Td colSpan={7} className="text-sm text-[var(--ink-muted)]">
                  Sin tareas todavía.
                </Td>
              </Tr>
            )}
          </TBody>
        </Table>
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Nueva tarea"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creando..." : "Crear tarea"}
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
          <FieldWrapper label="Título">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </FieldWrapper>
          <FieldWrapper label="Relacionado a (opcional)">
            <Select value={form.related} onChange={(e) => setForm({ ...form, related: e.target.value })}>
              <option value="">Sin relacionar</option>
              {relatedOptions.leads.length > 0 && (
                <optgroup label="Leads">
                  {relatedOptions.leads.map((l) => (
                    <option key={l.id} value={`lead:${l.id}`}>
                      {l.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {relatedOptions.clients.length > 0 && (
                <optgroup label="Clientes">
                  {relatedOptions.clients.map((c) => (
                    <option key={c.id} value={`client:${c.id}`}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </FieldWrapper>
          <div className="grid grid-cols-2 gap-3">
            {canAssignOthers && (
              <FieldWrapper label="Asignado a">
                <Select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
                  <option value="">Yo mismo</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </FieldWrapper>
            )}
            <FieldWrapper label="Fecha límite">
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </FieldWrapper>
          </div>
          <FieldWrapper label="Prioridad">
            <Select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as CrmTask["priority"] })}
            >
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Descripción">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detalles de la tarea..."
            />
          </FieldWrapper>
        </div>
      </Drawer>
    </div>
  );
}
