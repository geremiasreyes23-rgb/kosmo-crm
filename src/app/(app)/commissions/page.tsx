import { requireUser } from "@/lib/auth";
import { getCommissionsForUser, getCommissionsSummaryForUser } from "./data";
import { CommissionsView } from "./CommissionsView";

export const dynamic = "force-dynamic";

export default async function CommissionsPage() {
  const user = await requireUser();
  const [commissions, summary] = await Promise.all([
    getCommissionsForUser(user),
    getCommissionsSummaryForUser(user),
  ]);

  return <CommissionsView initialCommissions={commissions} summary={summary} />;
}
