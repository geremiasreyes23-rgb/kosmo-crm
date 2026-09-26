import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { requireUser } from "@/lib/auth";
import { getLeadForUser, getLeadPipelineStages } from "../data";
import { formatDate } from "@/lib/utils";
import { ConvertToClientButton } from "@/components/leads/ConvertToClientButton";
import { UserCheck } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [lead, stages] = await Promise.all([getLeadForUser(id, user), getLeadPipelineStages()]);
  if (!lead) return notFound();
  const stage = stages.find((s) => s.id === lead.stageId);

  return (
    <div>
      <PageHeader
        title={`${lead.firstName} ${lead.lastName}`}
        description={`Lead ${lead.id} · ${lead.source}`}
        actions={
          lead.convertedClientId ? (
            <Link href={`/clients/${lead.convertedClientId}`}>
              <Button size="sm" variant="secondary">
                <UserCheck className="h-4 w-4" /> Ver cliente
              </Button>
            </Link>
          ) : (
            <ConvertToClientButton leadId={lead.id} />
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge status="info">{stage?.name}</Badge>
        <Badge status="neutral">Vendedor: {lead.agentName}</Badge>
        <Badge status="neutral">Creado {formatDate(lead.createdAt)}</Badge>
        {lead.convertedAt && <Badge status="good">Convertido a cliente {formatDate(lead.convertedAt)}</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-5">
              <Tabs
                tabs={[
                  {
                    id: "overview",
                    label: "Overview",
                    content: (
                      <div className="space-y-5">
                        <dl className="grid grid-cols-2 gap-4 text-sm">
                          <Info label="Teléfono" value={lead.phone} />
                          <Info label="Email" value={lead.email} />
                          <Info label="Estado" value={lead.state} />
                          <Info label="Origen" value={lead.source} />
                          <Info label="Producto de interés" value={lead.productLine} />
                          <Info label="Último contacto" value={lead.lastContactAt ? formatDate(lead.lastContactAt) : "—"} />
                          <Info label="Próximo seguimiento" value={lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : "—"} />
                        </dl>
                        {lead.customFieldValues && Object.keys(lead.customFieldValues).length > 0 && (
                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase text-[var(--ink-muted)]">
                              Campos personalizados
                            </h4>
                            <dl className="grid grid-cols-2 gap-4 text-sm">
                              {Object.entries(lead.customFieldValues).map(([key, value]) => (
                                <Info key={key} label={key} value={value} />
                              ))}
                            </dl>
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    id: "activities",
                    label: "Actividades",
                    content: (
                      <p className="text-sm text-[var(--ink-muted)]">
                        El módulo de Actividades todavía no está conectado a base de datos real (fase posterior).
                      </p>
                    ),
                  },
                  {
                    id: "tasks",
                    label: "Tareas",
                    content: (
                      <p className="text-sm text-[var(--ink-muted)]">
                        El módulo de Tareas todavía no está conectado a base de datos real (fase posterior).
                      </p>
                    ),
                  },
                  { id: "notes", label: "Notas", content: <p className="text-sm text-[var(--ink-muted)]">Sin notas todavía.</p> },
                  { id: "documents", label: "Documentos", content: <p className="text-sm text-[var(--ink-muted)]">Sin documentos adjuntos.</p> },
                ]}
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Historial de etapa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <TimelineRow label="Nuevo" date={lead.createdAt} />
              <TimelineRow label={stage?.name ?? ""} date={lead.lastContactAt ?? lead.createdAt} current />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--ink-muted)]">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}

function TimelineRow({ label, date, current }: { label: string; date: string; current?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-2 w-2 shrink-0 rounded-full ${current ? "bg-[var(--brand-500)]" : "bg-[var(--border-grid)]"}`} />
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        <p className="text-xs text-[var(--ink-muted)]">{formatDate(date)}</p>
      </div>
    </div>
  );
}
