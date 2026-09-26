import { requireUser, canViewAll } from "@/lib/auth";
import { getClientsForUser, getClientFormOptions } from "./data";
import { ClientsView } from "./ClientsView";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const user = await requireUser();
  const [clients, formOptions] = await Promise.all([
    getClientsForUser(user),
    getClientFormOptions(),
  ]);

  return (
    <ClientsView
      initialClients={clients}
      formOptions={formOptions}
      canAssignOthers={canViewAll(user)}
    />
  );
}
