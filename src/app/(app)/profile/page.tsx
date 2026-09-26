import { requireUser } from "@/lib/auth";
import { getProfileViewData } from "./data";
import { ProfileView } from "@/components/profile/ProfileView";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const data = await getProfileViewData(sessionUser);

  return <ProfileView data={data} />;
}
