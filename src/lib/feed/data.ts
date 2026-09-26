import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/auth";
import { syncSystemEventsFromAuditLog } from "@/lib/feed/systemEvents";
import { mapPost, SYSTEM_EVENT_TITLES } from "@/lib/feed/mappers";
import { stripMentionTokens } from "@/lib/feed/mentions";
import { formatBytes } from "@/lib/utils";
import type {
  FeedFilter,
  FeedPageDataVM,
  FeedRecentActivityItem,
  FeedSharedFileItem,
  FeedSortOrder,
  FeedSystemEventType,
  FeedUpcomingEventItem,
  FeedUserOption,
} from "@/types";
import type { Prisma } from "@prisma/client";

const authorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  department: true,
  role: { select: { name: true } },
} satisfies Prisma.UserSelect;

const postInclude = {
  author: { select: authorSelect },
  audienceUsers: { include: { user: { select: { firstName: true, lastName: true } } } },
  attachments: true,
  mentions: { include: { mentionedUser: { select: { firstName: true, lastName: true } } } },
  reactions: { select: { userId: true, type: true } },
  comments: {
    include: {
      author: { select: authorSelect },
      mentions: { include: { mentionedUser: { select: { firstName: true, lastName: true } } } },
    },
  },
} satisfies Prisma.FeedPostInclude;

type FeedPostWithRelations = Prisma.FeedPostGetPayload<{ include: typeof postInclude }>;

export async function getFeedUserOptions(): Promise<FeedUserOption[]> {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, department: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim(), department: u.department ?? undefined }));
}

export interface FeedQueryOptions {
  filter: FeedFilter;
  sort: FeedSortOrder;
}

export async function getFeedPageData(user: SessionUser, options: FeedQueryOptions): Promise<FeedPageDataVM> {
  await syncSystemEventsFromAuditLog();

  const [me, users] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { department: true } }),
    getFeedUserOptions(),
  ]);
  const myDepartment = me?.department ?? null;
  const canModerate = hasPermission(user, "feed", "moderate");

  const visibilityFilter: Prisma.FeedPostWhereInput = {
    OR: [
      { audience: "EVERYONE" },
      { authorId: user.id },
      ...(myDepartment ? [{ audience: "TEAM" as const, author: { department: myDepartment } }] : []),
      { audience: "SPECIFIC", audienceUsers: { some: { userId: user.id } } },
    ],
  };

  const filterClause: Prisma.FeedPostWhereInput = {};
  if (options.filter === "mine") filterClause.authorId = user.id;
  if (options.filter === "system") filterClause.kind = "SYSTEM";
  if (options.filter === "mentions") filterClause.mentions = { some: { mentionedUserId: user.id } };

  const rows = await prisma.feedPost.findMany({
    where: { AND: [visibilityFilter, filterClause] },
    include: postInclude,
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  let ordered = rows;
  if (options.sort === "oldest") {
    ordered = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  } else if (options.sort === "most_commented") {
    ordered = [...rows].sort((a, b) => b.comments.length - a.comments.length);
  }
  // Fijados siempre primero, sin importar el orden elegido — igual que
  // Bitrix24 (spec sección 13).
  const pinned = ordered.filter((r) => r.isPinned);
  const rest = ordered.filter((r) => !r.isPinned);
  const finalOrder = [...pinned, ...rest];

  const posts = finalOrder.map((row) => mapPost(row, { currentUserId: user.id, canModerate }));

  const sidebar = await getSidebarData(user, finalOrder);

  return {
    currentUserId: user.id,
    posts,
    users,
    sidebar,
    canPostAsEveryone: true,
  };
}

async function getSidebarData(user: SessionUser, visiblePosts: FeedPostWithRelations[]) {
  const [mentionRows, upcoming] = await Promise.all([
    prisma.feedMention.findMany({
      where: { mentionedUserId: user.id },
      include: {
        post: { select: { id: true, body: true, author: { select: { firstName: true, lastName: true } } } },
        comment: { select: { id: true, postId: true, body: true, author: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.appointment.findMany({
      where: { userId: user.id, startsAt: { gte: new Date() }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
      orderBy: { startsAt: "asc" },
      take: 5,
    }),
  ]);

  const mentions = mentionRows.map((m) => {
    const fromName = m.comment
      ? `${m.comment.author.firstName} ${m.comment.author.lastName}`.trim()
      : m.post
        ? `${m.post.author?.firstName ?? ""} ${m.post.author?.lastName ?? ""}`.trim()
        : "Alguien";
    const excerptSource = m.comment?.body ?? m.post?.body ?? "";
    const postId = m.comment?.postId ?? m.post?.id ?? "";
    return {
      id: m.id,
      fromName: fromName || "Alguien",
      excerpt: stripMentionTokens(excerptSource).slice(0, 120),
      href: `/feed#post-${postId}`,
      createdAt: m.createdAt.toISOString(),
    };
  });

  const recentActivity: FeedRecentActivityItem[] = visiblePosts
    .filter((p) => p.kind === "SYSTEM")
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      label: p.systemEventType ? SYSTEM_EVENT_TITLES[p.systemEventType as FeedSystemEventType] : "Actividad",
      createdAt: p.createdAt.toISOString(),
      href: `/feed#post-${p.id}`,
    }));

  const upcomingEvents: FeedUpcomingEventItem[] = upcoming.map((a) => ({
    id: a.id,
    title: a.title,
    startsAt: a.startsAt.toISOString(),
    durationMinutes: a.durationMinutes,
  }));

  const sharedFiles: FeedSharedFileItem[] = visiblePosts
    .flatMap((p) => p.attachments.map((att) => ({ att, postId: p.id, createdAt: att.createdAt })))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map(({ att, postId }) => ({
      id: att.id,
      fileName: att.fileName,
      sizeBytes: att.sizeBytes,
      createdAt: att.createdAt.toISOString(),
      postId,
    }));

  return { mentions, recentActivity, upcomingEvents, sharedFiles };
}

export { formatBytes };
