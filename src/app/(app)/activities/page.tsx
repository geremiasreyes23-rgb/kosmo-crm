import { requireUser } from "@/lib/auth";
import { getDailyReportsForUser, canReviewDailyReports } from "./reports-data";
import { DailyReportsView } from "./DailyReportsView";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const user = await requireUser();
  const reports = await getDailyReportsForUser(user);

  return (
    <DailyReportsView
      initialReports={reports}
      currentUserId={user.id}
      canReview={canReviewDailyReports(user)}
    />
  );
}
