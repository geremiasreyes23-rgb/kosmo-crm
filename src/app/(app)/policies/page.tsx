import { requireUser, canViewAll } from "@/lib/auth";
import { getPoliciesForUser, getPolicyFormOptions } from "./data";
import { PoliciesView } from "./PoliciesView";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const user = await requireUser();
  const [policies, formOptions] = await Promise.all([
    getPoliciesForUser(user),
    getPolicyFormOptions(user),
  ]);

  return (
    <PoliciesView
      initialPolicies={policies}
      formOptions={formOptions}
      canAssignOthers={canViewAll(user)}
    />
  );
}
