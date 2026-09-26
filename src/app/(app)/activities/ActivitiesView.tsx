"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FieldWrapper, Select, Textarea } from "@/components/ui/Field";
import { createActivityAction } from "./actions";
import type { RelatedEntityOptions } from "@/lib/relatedRecords";
import type { ActivityItem } from "@/types";
import { formatDate } from "@/lib/utils";
import { Phone, Mail, MessageCircle, Users, StickyNote, Plus } from "lucide-react";

const iconMap = {
  CALL: Phone,
  EMAIL: Mail,
  SMS: MessageCircle,
  WHATSAPP: MessageCircle,
  MEETING: Users,
  NOTE: StickyNote,
  FOLLOW_UP: StickyNote,
} as const;

function emptyForm() {
  return {
    type: "CALL" as ActivityItem["type"],
    related: "",
    notes: "",
  };
}

export function ActivitiesView({
  initialActivities,
  relatedOptions,
}: {
  initialActivities: ActivityItem[];
  relatedOptions: RelatedEntityOptions;
}) {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  useEffect(() => setActivities(initialActivities), [initialActivities]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openDrawer() {
    setForm(emptyForm());
    setFormError(null);
    setDrawerOpen(true);
  }

  async function handleSubmit() {
    const [kind, id] = form.related.split(":");
    if (!kind || !id) {
      setFormError("Selecciona a qué lead o cliente está relacionada.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const result = await createActivityAction({
      type: form.type,
      notes: form.notes || undefined,
      relatedLeadId: kind === "lead" ? id : undefined,
      relatedClientId: kind === "client" ? id : undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error ?? "No se pudo registrar la actividad.");
      return;
    }
    setDrawerOpen(false);
    router.refresh();
  }

  return (
    <div>
      <PageHeader
        title="Actividades"
        description="Registro de llamadas, correos, reuniones y seguimientos"
        actions={
          <Button size="sm" onClick={openDrawer}>
            <Plus className="h-4 w-4" /> Registrar actividad
          </Button>
        }
      />
      <Card className="divide-y divide-[var(--border-grid)]">
        {activities.map((a) => {
          const Icon = iconMap[a.type];
          return (
            <div key={a.id} className="flex items-start gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-50)] text-[var(--brand-600)]">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{a.relatedTo}</p>
                  <Badge status="neutral">{formatDate(a.occurredAt)}</Badge>
                </div>
                <p className="text-xs text-[var(--ink-muted)]">Por {a.user} · {a.type}</p>
                {a.notes && <p className="mt-1 text-sm text-[var(--ink-secondary)]">{a.notes}</p>}
              </div>
            </div>
          );
        })}
        {activities.length === 0 && (
          <p className="p-4 text-sm text-[var(--ink-muted)]">Sin actividades registradas todavía.</p>
        )}
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Registrar actividad"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Registrando..." : "Registrar"}
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
          <FieldWrapper label="Tipo">
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ActivityItem["type"] })}
            >
              <option value="CALL">Llamada</option>
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="MEETING">Reunión</option>
              <option value="NOTE">Nota</option>
              <option value="FOLLOW_UP">Seguimiento</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Relacionado a">
            <Select value={form.related} onChange={(e) => setForm({ ...form, related: e.target.value })}>
              <option value="">Selecciona un lead o cliente...</option>
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
          <FieldWrapper label="Notas">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Resultado de la actividad..."
            />
          </FieldWrapper>
        </div>
      </Drawer>
    </div>
  );
}
