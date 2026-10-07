import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { requireUser, hasPermission, canViewAll } from "@/lib/auth";
import { getLeadForUser, getLeadPipelineStages, getLeadEditData, getLeadFormOptions } from "../data";
import { EditLeadButton } from "@/components/leads/EditLeadButton";
import { SubmissionRequestButton } from "@/components/leads/SubmissionRequestButton";
import { getUserVisibility } from "@/lib/visibility-server";
import { PersonAvatar, PersonChip } from "@/components/ui/PersonAvatar";
import { LeadLineDetails } from "@/components/leads/LeadLineDetails";
import { LeadRestrictedPanel } from "@/components/leads/LeadRestrictedPanel";
import { COMMON_SENSITIVE, LINE_DEFS, ageFromDob, getLineDef, turning65, US_STATES } from "@/lib/leads/lineSchema";
import { getActivitiesForUser } from "../../activities/data";
import { getTasksForUser } from "../../tasks/data";
import { getNotesForUser } from "@/lib/notes/data";
import { getDocumentsForUser } from "@/lib/documents/data";
import { NotesTab } from "@/components/records/NotesTab";
import { DocumentsTab } from "@/components/records/DocumentsTab";
import { formatDate } from "@/lib/utils";
import { ConvertToClientButton } from "@/components/leads/ConvertToClientButton";
import { Cake, UserCheck } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  // Visibilidad por persona (src/lib/visibility.ts).
  const { hidden } = await getUserVisibility(user);
  const show = (k: string) => !hidden.has(`lead.common.${k}`);
  const [lead, stages, leadActivities, leadTasks, leadNotes, leadDocuments, editData, formOptions] = await Promise.all([
    getLeadForUser(id, user),
    getLeadPipelineStages(),
    getActivitiesForUser(user, { leadId: id }),
    getTasksForUser(user, { leadId: id }),
    getNotesForUser(user, { leadId: id }),
    getDocumentsForUser(user, { leadId: id }),
    getLeadEditData(id, user),
    getLeadFormOptions(),
  ]);
  if (!lead || !editData) return notFound();
  const stage = stages.find((s) => s.id === lead.stageId);
  const canEditLead = hasPermission(user, "leads", "edit");
  const canReveal = hasPermission(user, "sensitive_data", "view");
  const lineDef = getLineDef(lead.lineCode);
  const sensitiveByKey = Object.fromEntries(
    editData.sensitive.map((s) => [s.fieldKey, { id: s.id, label: s.label, maskedPreview: s.maskedPreview }])
  );
  const commonRestricted = COMMON_SENSITIVE.filter((c) => sensitiveByKey[c.key]).map((c) => ({
    ...sensitiveByKey[c.key],
    label: c.label,
  }));
  const t65 = lead.lineCode === "MEDICARE" ? turning65(lead.dob) : null;
  const age = ageFromDob(lead.dob);
  const dobLabel = lead.dob
    ? `${new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${lead.dob}T00:00:00Z`))}${age != null ? ` (${age} años)` : ""}`
    : undefined;

  return (
    <div>
      <PageHeader
        title={`${lead.firstName} ${lead.lastName}`}
        description={`${lead.leadCode ?? "Lead"} · ${lead.productLine ?? "Sin línea de negocio"} · ${lead.source}`}
        actions={
          <div className="flex items-center gap-2">
          {canEditLead && (
            <EditLeadButton
              initial={editData}
              formOptions={formOptions}
              canAssignOthers={canViewAll(user)}
              currentUserName={`${user.firstName} ${user.lastName}`}
              currentAgentId={user.agentId}
            />
          )}
          {canEditLead && lineDef && (!lead.submissionStatus || lead.submissionStatus === "REJECTED") && (
            <SubmissionRequestButton leadId={lead.id} resend={lead.submissionStatus === "REJECTED"} />
          )}
          {lead.convertedClientId ? (
            <Link href={`/clients/${lead.convertedClientId}`}>
              <Button size="sm" variant="secondary">
                <UserCheck className="h-4 w-4" /> Ver cliente
              </Button>
            </Link>
          ) : (
            <ConvertToClientButton leadId={lead.id} />
          )}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge status="info">{stage?.name}</Badge>
        {lead.productLine && <Badge status="good">{lead.productLine}</Badge>}
        {lead.submissionStatus && (
          <Badge
            status={
              lead.submissionStatus === "APPROVED"
                ? "good"
                : lead.submissionStatus === "REJECTED"
                  ? "critical"
                  : lead.submissionStatus === "SUBMITTED"
                    ? "info"
                    : "warning"
            }
          >
            Envío:{" "}
            {{ PENDING: "pendiente", SUBMITTED: "sometido", APPROVED: "aprobado", REJECTED: "rechazado" }[lead.submissionStatus]}
          </Badge>
        )}
        {t65 && t65.status === "soon" && (
          <Badge status="warning">
            <Cake className="mr-1 h-3 w-3" /> {t65.message}
          </Badge>
        )}
        <Badge status="neutral">
          <PersonAvatar name={lead.agentName || "?"} person={{ agentId: lead.agentId }} size={16} className="mr-1" />
          Vendedor: {lead.agentName}
        </Badge>
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
                      <div className="space-y-6">
                        <section>
                          <h3 className="mb-3 text-sm font-semibold">Información del cliente</h3>
                          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                            <Info label="ID de cliente" value={lead.leadCode} />
                            <Info label="Fecha de creación" value={formatDate(lead.createdAt)} />
                            <Info label="Nombre" value={lead.firstName} />
                            <Info label="Apellido" value={lead.lastName} />
                            {show("dob") && <Info label="Fecha de nacimiento" value={dobLabel} />}
                            {show("preferredLanguage") && <Info label="Idioma preferido" value={lead.preferredLanguage} />}
                            {show("phone") && <Info label="Teléfono" value={lead.phone} />}
                            {show("email") && <Info label="Correo electrónico" value={lead.email} />}
                            {show("address") && <Info label="Dirección" value={lead.address} />}
                            {show("zipCode") && <Info label="Código postal" value={lead.zipCode} />}
                            {show("county") && <Info label="Condado" value={lead.county} />}
                            {show("state") && <Info label="Estado" value={US_STATES.find((s) => s.value === lead.state)?.label ?? lead.state} />}
                            {show("sourceId") && <Info label="Origen del lead" value={lead.source} />}
                            {show("agentId") && <Info label="Vendedor" value={<PersonChip name={lead.agentName} person={{ agentId: lead.agentId }} />} />}
                            {show("aorId") && <Info label="AOR" value={lead.aorName ? <PersonChip name={lead.aorName} person={{ agentId: lead.aorId }} /> : undefined} />}
                            <Info label="Último contacto" value={lead.lastContactAt ? formatDate(lead.lastContactAt) : "—"} />
                          </dl>
                          <div className="mt-4">
                            {show("sensitive") && (
<LeadRestrictedPanel
                              title="Información restringida"
                              items={commonRestricted}
                              canReveal={canReveal}
                              emptyText="Social Security y clave de seguridad sin capturar."
                            />
)}
                          </div>
                        </section>

                        <section className="border-t border-[var(--border-hairline)] pt-5">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">
                              {lead.productLine ? `Información de ${lead.productLine}` : "Línea de negocio"}
                            </h3>
                            {lead.productLine && <Badge status="neutral">Línea: {lead.productLine}</Badge>}
                          </div>
                          {lineDef && editData.lineValues ? (
                            <LeadLineDetails
                              hidden={hidden}
                              code={lineDef.code}
                              values={editData.lineValues}
                              dob={lead.dob}
                              carriers={formOptions.carriersByLine[editData.lineId] ?? []}
                              sensitiveByKey={sensitiveByKey}
                              canReveal={canReveal}
                            />
                          ) : (
                            <p className="text-sm text-[var(--ink-muted)]">
                              {lead.productLine
                                ? lineDef
                                  ? `Aún no se capturaron los datos de ${LINE_DEFS[lineDef.code].label}. Usa "Editar lead" para completarlos.`
                                  : "Esta línea no tiene campos propios."
                                : 'Este lead todavía no tiene línea de negocio. Usa "Editar lead" para asignarla.'}
                            </p>
                          )}
                        </section>

                        {lead.customFieldValues && Object.keys(lead.customFieldValues).length > 0 && (
                          <section className="border-t border-[var(--border-hairline)] pt-5">
                            <h4 className="mb-2 text-xs font-semibold uppercase text-[var(--ink-muted)]">
                              Campos personalizados
                            </h4>
                            <dl className="grid grid-cols-2 gap-4 text-sm">
                              {Object.entries(lead.customFieldValues).map(([key, value]) => (
                                <Info key={key} label={key} value={value} />
                              ))}
                            </dl>
                          </section>
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

function Info({ label, value }: { label: string; value?: React.ReactNode }) {
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
