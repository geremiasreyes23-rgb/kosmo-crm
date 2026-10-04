import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { SensitiveDataPanel } from "@/components/clients/SensitiveDataPanel";
import { MedicareProfileTab } from "@/components/clients/MedicareProfileTab";
import { ObamacareProfileTab } from "@/components/clients/ObamacareProfileTab";
import { FamilyHeritageProfileTab } from "@/components/clients/FamilyHeritageProfileTab";
import { Info } from "@/components/clients/Info";
import { requireUser, hasPermission } from "@/lib/auth";
import { getClientForUser } from "../data";
import { getMedicareProfileForClient, getMedicareFormOptions } from "./medicare/data";
import { getObamacareProfileForClient, getObamacareFormOptions } from "./obamacare/data";
import { getFamilyHeritageProfileForClient } from "./family-heritage/data";
import { getActivitiesForUser } from "../../activities/data";
import { getTasksForUser } from "../../tasks/data";
import { getAppointmentsForUser } from "../../calendar/data";
import { getSalesForUser } from "../../sales/data";
import { getNotesForUser } from "@/lib/notes/data";
import { getDocumentsForUser } from "@/lib/documents/data";
import { NotesTab } from "@/components/records/NotesTab";
import { DocumentsTab } from "@/components/records/DocumentsTab";
import { formatCurrency, formatDate, formatTime, timeSince, calculateAge, formatClientCode } from "@/lib/utils";
import { notFound } from "next/navigation";
import { ArrowLeftCircle, ClipboardList, ShieldCheck } from "lucide-react";
import { PersonAvatar } from "@/components/ui/PersonAvatar";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const client = await getClientForUser(id, user);
  if (!client) return notFound();

  const canEditClient = hasPermission(user, "clients", "edit");
  const [
    medicareProfile,
    medicareOptions,
    obamacareProfile,
    obamacareOptions,
    familyHeritageProfile,
    clientActivities,
    clientTasks,
    clientAppointments,
    clientSales,
    clientNotes,
    clientDocuments,
  ] = await Promise.all([
    getMedicareProfileForClient(id, user),
    getMedicareFormOptions(),
    getObamacareProfileForClient(id, user),
    getObamacareFormOptions(),
    getFamilyHeritageProfileForClient(id, user),
    getActivitiesForUser(user, { clientId: id }),
    getTasksForUser(user, { clientId: id }),
    getAppointmentsForUser(user, { clientId: id }),
    getSalesForUser(user, { clientId: id }),
    getNotesForUser(user, { clientId: id }),
    getDocumentsForUser(user, { clientId: id }),
  ]);

  const policies = client.policies ?? [];
  const totalCommissions = policies.reduce((sum, p) => sum + (p.commission?.agentAmount ?? 0), 0);

  return (
    <div>
      <PageHeader
        title={`${client.firstName} ${client.lastName}`}
        description={`Cliente desde ${formatDate(client.createdAt)} (${timeSince(client.createdAt)} en cartera)`}
        actions={
          client.originLeadId ? (
            <Link href={`/leads/${client.originLeadId}`}>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 text-sm text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]">
                <ArrowLeftCircle className="h-4 w-4" /> Ver lead de origen
              </span>
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge status="good">Activo</Badge>
        <Badge status="neutral" className="font-mono">{formatClientCode(client.clientNumber)}</Badge>
        <Badge status="neutral">
          <PersonAvatar name={client.agentName || "?"} person={{ agentId: client.agentId }} size={16} className="mr-1" />
          Vendedor: {client.agentName}
        </Badge>
        {client.aorName && (
          <Badge status="neutral">
            <PersonAvatar name={client.aorName} person={{ agentId: client.aorId }} size={16} className="mr-1" />
            AOR: {client.aorName}
          </Badge>
        )}
        {client.dob && <Badge status="info">{calculateAge(client.dob)} años</Badge>}
      </div>

      <Card>
        <CardContent className="pt-5">
          <Tabs
            tabs={[
              {
                id: "overview",
                label: "Overview",
                content: (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase text-[var(--ink-muted)]">Datos básicos</h4>
                      <Info label="Teléfono" value={client.phone} />
                      <Info label="Email" value={client.email} />
                      <Info label="Dirección" value={client.address} />
                      <Info label="Código postal" value={client.zipCode} />
                      <Info label="Condado / Estado" value={client.county || client.state ? `${client.county ?? "—"}, ${client.state ?? "—"}` : undefined} />
                      <Info label="Idioma preferido" value={client.preferredLanguage} />
                      <Info label="Origen" value={client.sourceName} />
                      {client.customFieldValues &&
                        Object.entries(client.customFieldValues).map(([key, value]) => (
                          <Info key={key} label={key} value={value} />
                        ))}
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase text-[var(--ink-muted)]">Resumen financiero</h4>
                        <Info label="Pólizas activas" value={String(client.activePolicies)} />
                        <Info label="Comisiones generadas" value={formatCurrency(totalCommissions)} />
                      </div>
                      <SensitiveDataPanel
                        clientId={client.id}
                        initialFields={client.sensitiveFields ?? []}
                        canEdit={hasPermission(user, "clients", "edit")}
                        canReveal={hasPermission(user, "sensitive_data", "view")}
                      />
                    </div>
                  </div>
                ),
              },
              {
                id: "policies",
                label: "Pólizas",
                content:
                  policies.length === 0 ? (
                    <Empty text="Sin pólizas registradas todavía." />
                  ) : (
                    <Table>
                      <THead>
                        <Tr>
                          <Th>Número</Th>
                          <Th>Línea</Th>
                          <Th>Carrier</Th>
                          <Th>Plan</Th>
                          <Th>Prima</Th>
                          <Th>Estado</Th>
                        </Tr>
                      </THead>
                      <TBody>
                        {policies.map((p) => (
                          <Tr key={p.id}>
                            <Td>{p.policyNumber ?? "—"}</Td>
                            <Td>{p.line}</Td>
                            <Td>{p.carrier}</Td>
                            <Td>{p.planName ?? "—"}</Td>
                            <Td>{p.premium != null ? formatCurrency(p.premium) : "—"}</Td>
                            <Td><Badge status={statusToBadgeVariant(p.status)}>{p.status}</Badge></Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  ),
              },
              {
                id: "commissions",
                label: "Comisiones",
                content: (() => {
                  const withCommission = policies.filter((p) => p.commission);
                  return withCommission.length === 0 ? (
                    <Empty text="Sin comisiones registradas todavía." />
                  ) : (
                    <Table>
                      <THead>
                        <Tr>
                          <Th>Póliza</Th>
                          <Th>Línea</Th>
                          <Th>Agente</Th>
                          <Th>AOR</Th>
                          <Th>Estado</Th>
                        </Tr>
                      </THead>
                      <TBody>
                        {withCommission.map((p) => (
                          <Tr key={p.id}>
                            <Td>{p.policyNumber ?? "—"}</Td>
                            <Td>{p.line}</Td>
                            <Td>{p.commission!.agentAmount != null ? formatCurrency(p.commission!.agentAmount) : "—"}</Td>
                            <Td>{p.commission!.aorAmount != null ? formatCurrency(p.commission!.aorAmount) : "—"}</Td>
                            <Td><Badge status={statusToBadgeVariant(p.commission!.status)}>{p.commission!.status}</Badge></Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  );
                })(),
              },
              {
                id: "sales",
                label: "Ventas",
                content:
                  clientSales.length === 0 ? (
                    <Empty text="Sin ventas registradas para este cliente todavía." />
                  ) : (
                    <Table>
                      <THead>
                        <Tr>
                          <Th>Línea</Th>
                          <Th>Carrier</Th>
                          <Th>Plan</Th>
                          <Th>Prima</Th>
                          <Th>Comisión esperada</Th>
                          <Th>Fecha</Th>
                        </Tr>
                      </THead>
                      <TBody>
                        {clientSales.map((s) => (
                          <Tr key={s.id}>
                            <Td>{s.line}</Td>
                            <Td>{s.carrier}</Td>
                            <Td>{s.planName ?? "—"}</Td>
                            <Td>{formatCurrency(s.premium)}</Td>
                            <Td>{s.expectedCommission != null ? formatCurrency(s.expectedCommission) : "—"}</Td>
                            <Td>{formatDate(s.saleDate)}</Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  ),
              },
              {
                id: "activities",
                label: "Actividades",
                content:
                  clientActivities.length === 0 ? (
                    <Empty text="Sin actividades registradas todavía." />
                  ) : (
                    <div className="space-y-2">
                      {clientActivities.map((a) => (
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
                  clientTasks.length === 0 ? (
                    <Empty text="Sin tareas asociadas todavía." />
                  ) : (
                    <div className="space-y-2">
                      {clientTasks.map((t) => (
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
                id: "appointments",
                label: "Citas",
                content:
                  clientAppointments.length === 0 ? (
                    <Empty text="Sin citas agendadas todavía." />
                  ) : (
                    <div className="space-y-2">
                      {clientAppointments.map((ap) => (
                        <div key={ap.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-hairline)] p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{ap.title}</p>
                            <p className="text-xs text-[var(--ink-muted)]">{formatDate(ap.startsAt)} · {formatTime(ap.startsAt)}</p>
                          </div>
                          <Badge status={statusToBadgeVariant(ap.status)}>{ap.status}</Badge>
                        </div>
                      ))}
                    </div>
                  ),
              },
              {
                id: "documents",
                label: "Documentos",
                content: (
                  <DocumentsTab
                    clientId={client.id}
                    initialDocuments={clientDocuments}
                    canEdit={canEditClient}
                  />
                ),
              },
              {
                id: "notes",
                label: "Notas",
                content: (
                  <NotesTab clientId={client.id} initialNotes={clientNotes} canEdit={canEditClient} />
                ),
              },
              {
                id: "insurance",
                label: "Seguros",
                content:
                  client.linesOfBusiness.length === 0 ? (
                    <Empty text="Sin líneas de seguro asociadas todavía." />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {client.linesOfBusiness.map((l) => (
                        <div
                          key={l}
                          className="flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] px-3 py-2 text-sm"
                        >
                          <ShieldCheck className="h-4 w-4 text-[var(--brand-500)]" /> {l}
                        </div>
                      ))}
                    </div>
                  ),
              },
              {
                id: "medicare",
                label: "Medicare",
                content: (
                  <MedicareProfileTab
                    clientId={client.id}
                    initialProfile={medicareProfile}
                    carriers={medicareOptions.carriers}
                    canEdit={canEditClient}
                  />
                ),
              },
              {
                id: "obamacare",
                label: "Obamacare",
                content: (
                  <ObamacareProfileTab
                    clientId={client.id}
                    initialProfile={obamacareProfile}
                    carriers={obamacareOptions.carriers}
                    canEdit={canEditClient}
                  />
                ),
              },
              {
                id: "family_heritage",
                label: "Family Heritage",
                content: (
                  <FamilyHeritageProfileTab
                    clientId={client.id}
                    initialProfile={familyHeritageProfile}
                    canEdit={canEditClient}
                  />
                ),
              },
              {
                id: "history",
                label: "Historial",
                content: (
                  <div className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
                    <ClipboardList className="h-4 w-4" /> Sin historial de cambios todavía.
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}


function Empty({ text }: { text: string }) {
  return <p className="text-sm text-[var(--ink-muted)]">{text}</p>;
}
