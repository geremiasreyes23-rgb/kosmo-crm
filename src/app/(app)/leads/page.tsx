import { requireUser, canViewAll } from "@/lib/auth";
import { getLeadPipelineStages, getLeadsForUser, getLeadFormOptions } from "./data";
import { LeadsView } from "./LeadsView";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const user = await requireUser();
  const [stages, leads, formOptions] = await Promise.all([
    getLeadPipelineStages(),
    getLeadsForUser(user),
    getLeadFormOptions(),
  ]);

  return (
    <LeadsView
      initialLeads={leads}
      stages={stages}
      formOptions={formOptions}
      canAssignOthers={canViewAll(user)}
      currentUserName={`${user.firstName} ${user.lastName}`}
      currentAgentId={user.agentId}
    />
  );
}
