import { requireUser } from "@/lib/auth";
import { getRelatedEntityOptions } from "@/lib/relatedRecords";
import { getAppointmentsForUser } from "./data";
import { CalendarView } from "./CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await requireUser();
  const [appointments, relatedOptions] = await Promise.all([
    getAppointmentsForUser(user),
    getRelatedEntityOptions(user),
  ]);

  return <CalendarView initialAppointments={appointments} relatedOptions={relatedOptions} />;
}
