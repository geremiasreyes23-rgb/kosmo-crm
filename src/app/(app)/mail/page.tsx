import { requireUser } from "@/lib/auth";
import { getMailOverview, getComposeDirectory, getMailSettingsVM } from "./data";
import { MailView } from "@/components/mail/MailView";

export const dynamic = "force-dynamic";

export default async function MailPage() {
  const user = await requireUser();
  const [overview, directory, settings] = await Promise.all([
    getMailOverview(user),
    getComposeDirectory(user.id),
    getMailSettingsVM(),
  ]);

  return (
    <MailView
      currentUser={{ id: user.id, firstName: user.firstName, lastName: user.lastName }}
      overview={overview}
      directory={directory}
      settings={settings}
    />
  );
}
