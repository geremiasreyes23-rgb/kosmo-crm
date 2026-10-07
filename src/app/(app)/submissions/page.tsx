import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canSeePath } from "@/lib/visibility-server";
import { formatLeadCode } from "@/lib/utils";
import { getLineDef, readStoredLineDetails, submissionFieldDefs, type LineValues } from "@/lib/leads/lineSchema";
import { SubmissionsView, type SubmissionRow } from "./SubmissionsView";

export const dynamic = "force-dynamic";

/** Panel "Envíos" — solo para quien tiene visible el módulo (por rol o por
 * persona, ver Configuración). */
export default async function SubmissionsPage() {
  const user = await requireUser();
  if (!(await canSeePath(user, "/submissions"))) return notFound();

  const leads = await prisma.lead.findMany({
    where: { submissionStatus: { not: null } },
    orderBy: [{ submissionRequestedAt: "desc" }],
    take: 500,
    select: {
      id: true,
      leadNumber: true,
      firstName: true,
      lastName: true,
      phone: true,
      dob: true,
      state: true,
      lineDetails: true,
      agentId: true,
      agent: { select: { firstName: true, lastName: true } },
      interestedLine: { select: { code: true, name: true } },
      submissionStatus: true,
      submissionRequestedAt: true,
      submittedAt: true,
      submissionNotes: true,
      submittedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const rows: SubmissionRow[] = leads.map((l) => {
    const def = getLineDef(l.interestedLine?.code);
    const stored = def ? readStoredLineDetails(l.lineDetails, def.code) : null;
    // Solo viajan al navegador los campos de envío (no la línea completa).
    const values: LineValues = {};
    if (def && stored) for (const { field } of submissionFieldDefs(def.code)) values[field.key] = stored[field.key] ?? "";
    return {
      id: l.id,
      leadCode: formatLeadCode(l.leadNumber),
      name: `${l.firstName} ${l.lastName}`,
      phone: l.phone ?? "",
      dob: l.dob ? l.dob.toISOString().slice(0, 10) : "",
      state: l.state ?? "",
      lineCode: def?.code ?? null,
      lineName: l.interestedLine?.name ?? "Sin línea",
      agentId: l.agentId ?? undefined,
      agentName: l.agent ? `${l.agent.firstName} ${l.agent.lastName}` : "",
      status: l.submissionStatus!,
      requestedAt: l.submissionRequestedAt?.toISOString() ?? null,
      submittedAt: l.submittedAt?.toISOString() ?? null,
      submittedByName: l.submittedBy ? `${l.submittedBy.firstName} ${l.submittedBy.lastName}` : "",
      submittedById: l.submittedBy?.id,
      notes: l.submissionNotes ?? "",
      values,
    };
  });

  return <SubmissionsView initialRows={rows} />;
}
