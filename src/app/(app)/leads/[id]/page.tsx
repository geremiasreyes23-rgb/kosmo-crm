import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { requireUser, hasPermission } from "@/lib/auth";
import { getLeadForUser, getLeadPipelineStages } from "../data";
import { getActivitiesForUser } from "../../activities/data";
import { getTasksForUser } from "../../tasks/data";
import { getNotesForUser } from "@/lib/notes/data";
import { getDocumentsForUser } from "@/lib/documents/data";
import { NotesTab } from "@/components/records/NotesTab";
import { DocumentsTab } from "@/components/records/DocumentsTab";
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
  const [lead, stages, leadActivities, leadTasks, leadNotes, leadDocuments] = await Promise.all([
    getLeadForUser(id, user),
    getLeadPipelineStages(),
    getActivitiesForUser(user, { leadId: id }),
    getTasksForUser(user, { leadId: id }),
    getNotesForUser(user, { leadId: id }),
    getDocumentsForUser(user, { leadId: id }),
  ]);
  if (!lead) return notFound();
  const stage = stages.find((s) => s.id === lead.stageId);
  const canEditLead = hasPermission(user, "leads", "edit");

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
                    content:
                      leadActivities.length === 0 ? (
                        <p className="text-sm text-[var(--ink-muted)]">Sin actividades registradas todavía.</p>
                      ) : (
                        <div className="space-y-2">
                          {leadActivities.map((a) => (
                            <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border-hairline)] p-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{a.type} · {a.user}</p>
                                {a.notes && <p className="mt-0.5 text-sm text-[var(--ink-secondary)]">{a.notes}</p>}
                              </div>
                              <span className="shrink-0 text-xs text-[var(--ink-muted)]">{formatDate(a.occurredAt)}</span>
                            </div>
                          ))}
                        </div>
                      ),
                  },
                  {
                    id: "tasks",
                    label: "Tareas",
                    content:
                      leadTasks.length === 0 ? (
                        <p className="text-sm text-[var(--ink-muted)]">Sin tareas asociadas todavía.</p>
                      ) : (
                        <div className="space-y-2">
                          {leadTasks.map((t) => (
                            <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-hairline)] p-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{t.title}</p>
                                <p className="text-xs text-[var(--ink-muted)]">Asignada a {t.assignedTo}{t.dueDate ? ` · vence ${formatDate(t.dueDate)}` : ""}</p>
                              </div>
                              <Badge status={statusToBadgeVariant(t.status)}>{t.status}</Badge>
                            </div>
                          ))}
                        </div>
                      ),
                  },
                  {
                    id: "notes",
                    label: "Notas",
                    content: <NotesTab leadId={lead.id} initialNotes={leadNotes} canEdit={canEditLead} />,
                  },
                  {
                    id: "documents",
                    label: "Documentos",
                    content: (
                      <DocumentsTab leadId={lead.id} initialDocuments={leadDocuments} canEdit={canEditLead} />
                    ),
                  },
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
