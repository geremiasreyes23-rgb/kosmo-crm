"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FieldWrapper, Input, Select } from "@/components/ui/Field";
import { createAppointmentAction, updateAppointmentStatusAction } from "./actions";
import type { RelatedEntityOptions } from "@/lib/relatedRecords";
import type { AppointmentItem } from "@/types";
import { formatDate } from "@/lib/utils";
import { Plus, Clock } from "lucide-react";

function emptyForm() {
  return {
    title: "",
    related: "",
    date: new Date().toISOString().slice(0, 10),
    time: "10:00",
    durationMinutes: 30,
  };
}

const STATUS_OPTIONS: AppointmentItem["status"][] = [
  "SCHEDULED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

const STATUS_LABELS: Record<AppointmentItem["status"], string> = {
  SCHEDULED: "Programada",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No se presentó",
};

export function CalendarView({
  initialAppointments,
  relatedOptions,
}: {
  initialAppointments: AppointmentItem[];
  relatedOptions: RelatedEntityOptions;
}) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentItem[]>(initialAppointments);
  useEffect(() => setAppointments(initialAppointments), [initialAppointments]);

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
    const result = await createAppointmentAction({
      title: form.title,
      relatedLeadId: kind === "lead" ? id : undefined,
      relatedClientId: kind === "client" ? id : undefined,
      startsAt: `${form.date}T${form.time}`,
      durationMinutes: Number(form.durationMinutes) || 30,
    });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error ?? "No se pudo crear la cita.");
      return;
    }
    setDrawerOpen(false);
    router.refresh();
  }

  async function handleStatusChange(id: string, status: AppointmentItem["status"]) {
    setBusyId(id);
    await updateAppointmentStatusAction(id, status);
    setBusyId(null);
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Calendario"
        description="Citas, seguimientos, llamadas y reuniones"
        actions={
          <Button size="sm" onClick={openDrawer}>
            <Plus className="h-4 w-4" /> Nueva cita
          </Button>
        }
      />

      <Card className="divide-y divide-[var(--border-grid)]">
        {appointments.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-50)] text-[var(--brand-600)]">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-xs text-[var(--ink-muted)]">
                {a.relatedTo} · {formatDate(a.startsAt)} · {a.durationMinutes} min
              </p>
            </div>
            <Badge status={statusToBadgeVariant(a.status)}>{a.status}</Badge>
            <Select
              className="w-40"
              value={a.status}
              disabled={busyId === a.id}
              onChange={(e) => handleStatusChange(a.id, e.target.value as AppointmentItem["status"])}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
        ))}
        {appointments.length === 0 && (
          <p className="p-4 text-sm text-[var(--ink-muted)]">Sin citas programadas.</p>
        )}
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Nueva cita"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creando..." : "Crear cita"}
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
            <FieldWrapper label="Fecha">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </FieldWrapper>
            <FieldWrapper label="Hora">
              <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </FieldWrapper>
          </div>
          <FieldWrapper label="Duración (minutos)">
            <Select
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
            >
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={45}>45</option>
              <option value={60}>60</option>
            </Select>
          </FieldWrapper>
        </div>
      </Drawer>
    </div>
  );
}
