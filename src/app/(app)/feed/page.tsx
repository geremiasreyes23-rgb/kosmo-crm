import { requireUser } from "@/lib/auth";
import { getFeedPageData } from "@/lib/feed/data";
import { initials, avatarColorFromId } from "@/lib/utils";
import { FeedView } from "./FeedView";
import type { FeedAuthorVM, FeedFilter, FeedSortOrder } from "@/types";

export const dynamic = "force-dynamic";

const VALID_FILTERS: FeedFilter[] = ["all", "mentions", "mine", "system"];
const VALID_SORTS: FeedSortOrder[] = ["recent", "oldest", "most_commented"];

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const filter = VALID_FILTERS.includes(params.filter as FeedFilter) ? (params.filter as FeedFilter) : "all";
  const sort = VALID_SORTS.includes(params.sort as FeedSortOrder) ? (params.sort as FeedSortOrder) : "recent";

  const user = await requireUser();
  const data = await getFeedPageData(user, { filter, sort });

  const name = `${user.firstName} ${user.lastName}`.trim();
  const currentAuthor: FeedAuthorVM = {
    id: user.id,
    name,
    initials: initials(name),
    avatarUrl: user.avatarUrl ?? undefined,
    avatarColor: avatarColorFromId(user.id),
    roleName: user.roleName,
  };

  return <FeedView data={data} filter={filter} sort={sort} currentAuthor={currentAuthor} />;
}
