import type { Prisma } from "@prisma/client";
import { initials, avatarColorFromId, formatBytes } from "@/lib/utils";
import { REACTION_ORDER } from "@/lib/feed/reactionMeta";
import type {
  FeedAttachmentVM,
  FeedAudience,
  FeedAuthorVM,
  FeedCommentVM,
  FeedMentionVM,
  FeedPostVM,
  FeedReactionSummary,
  FeedReactionType,
  FeedSystemEventType,
} from "@/types";

type UserLite = { id: string; firstName: string; lastName: string; avatarUrl: string | null; department: string | null; role?: { name: string } | null };

export function mapAuthor(user: UserLite | null | undefined): FeedAuthorVM | undefined {
  if (!user) return undefined;
  const name = `${user.firstName} ${user.lastName}`.trim();
  return {
    id: user.id,
    name,
    initials: initials(name),
    avatarUrl: user.avatarUrl ?? undefined,
    avatarColor: avatarColorFromId(user.id),
    department: user.department ?? undefined,
    roleName: user.role?.name,
  };
}

export const SYSTEM_EVENT_TITLES: Record<FeedSystemEventType, string> = {
  CLIENT_CREATED: "Nuevo cliente registrado",
  SALE_CREATED: "Venta completada",
  USER_JOINED: "Usuario se unió",
  TASK_COMPLETED: "Tarea finalizada",
};

function systemEventBody(
  systemEventType: FeedSystemEventType,
  data: Record<string, string | null | undefined>
): string {
  switch (systemEventType) {
    case "CLIENT_CREATED":
      return `${data.actorName ?? "Alguien"} agregó a ${data.clientName ?? "un nuevo cliente"} al CRM.`;
    case "SALE_CREATED": {
      const withClient = data.clientName ? ` con ${data.clientName}` : "";
      const withAmount = data.amountLabel ? ` por ${data.amountLabel}` : "";
      return `${data.actorName ?? "Alguien"} completó una venta${withClient}${withAmount}.`;
    }
    case "USER_JOINED": {
      const withDept = data.department ? ` · ${data.department}` : "";
      return `${data.newUserName ?? "Un nuevo integrante"} se unió al equipo${withDept}.`;
    }
    case "TASK_COMPLETED":
      return `${data.userName ?? "Alguien"} finalizó la tarea "${data.taskTitle ?? ""}".`;
    default:
      return "";
  }
}

export function mapAttachment(row: {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number;
}): FeedAttachmentVM {
  return {
    id: row.id,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    mimeType: row.mimeType ?? undefined,
    sizeBytes: row.sizeBytes,
  };
}

export function mapMentionUser(row: { mentionedUserId: string; mentionedUser: { firstName: string; lastName: string } }): FeedMentionVM {
  return { userId: row.mentionedUserId, name: `${row.mentionedUser.firstName} ${row.mentionedUser.lastName}`.trim() };
}

export function reactionSummary(
  reactions: { userId: string; type: FeedReactionType }[],
  currentUserId: string
): { summary: FeedReactionSummary[]; myReaction?: FeedReactionType; reactionCount: number } {
  const counts = new Map<FeedReactionType, number>();
  let myReaction: FeedReactionType | undefined;
  for (const r of reactions) {
    counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    if (r.userId === currentUserId) myReaction = r.type;
  }
  const summary = REACTION_ORDER.filter((t) => (counts.get(t) ?? 0) > 0).map((type) => ({
    type,
    count: counts.get(type) ?? 0,
    reactedByMe: myReaction === type,
  }));
  return { summary, myReaction, reactionCount: reactions.length };
}

export function audienceLabel(audience: FeedAudience, specificNames: string[]): string {
  if (audience === "EVERYONE") return "Todos";
  if (audience === "TEAM") return "Mi equipo";
  if (specificNames.length === 1) return specificNames[0];
  if (specificNames.length === 0) return "Usuarios específicos";
  return `${specificNames.length} personas`;
}

export function formatFileSize(sizeBytes: number): string {
  return formatBytes(sizeBytes);
}

interface PostRow {
  id: string;
  authorId: string | null;
  author: UserLite | null;
  body: string | null;
  kind: "USER" | "SYSTEM";
  systemEventType: string | null;
  systemEventData: Prisma.JsonValue | null;
  systemEntityType: string | null;
  systemEntityId: string | null;
  audience: FeedAudience;
  isPinned: boolean;
  createdAt: Date;
  editedAt: Date | null;
  audienceUsers: { userId: string; user: { firstName: string; lastName: string } }[];
  attachments: { id: string; fileName: string; fileUrl: string; mimeType: string | null; sizeBytes: number }[];
  mentions: { mentionedUserId: string; mentionedUser: { firstName: string; lastName: string } }[];
  reactions: { userId: string; type: FeedReactionType }[];
  comments: CommentRow[];
}

interface CommentRow {
  id: string;
  postId: string;
  authorId: string;
  author: UserLite;
  body: string;
  replyToId: string | null;
  createdAt: Date;
  mentions: { mentionedUserId: string; mentionedUser: { firstName: string; lastName: string } }[];
}

export function mapComment(row: CommentRow, commentsById: Map<string, CommentRow>): FeedCommentVM {
  const replyTo = row.replyToId ? commentsById.get(row.replyToId) : undefined;
  return {
    id: row.id,
    postId: row.postId,
    author: mapAuthor(row.author)!,
    body: row.body,
    mentions: row.mentions.map(mapMentionUser),
    replyToId: row.replyToId ?? undefined,
    replyToAuthorName: replyTo ? `${replyTo.author.firstName} ${replyTo.author.lastName}`.trim() : undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapPost(
  row: PostRow,
  ctx: { currentUserId: string; canModerate: boolean }
): FeedPostVM {
  const isMine = row.authorId === ctx.currentUserId;
  const commentsById = new Map(row.comments.map((c) => [c.id, c]));
  const { summary, myReaction, reactionCount } = reactionSummary(row.reactions, ctx.currentUserId);
  const specificNames = row.audienceUsers.map((au) => `${au.user.firstName} ${au.user.lastName}`.trim());

  const isSystem = row.kind === "SYSTEM";
  const body = isSystem && row.systemEventType
    ? systemEventBody(row.systemEventType as FeedSystemEventType, (row.systemEventData as Record<string, string | null>) ?? {})
    : row.body ?? "";

  let systemEntityHref: string | undefined;
  if (row.systemEntityType === "Client" && row.systemEntityId) systemEntityHref = `/clients/${row.systemEntityId}`;

  return {
    id: row.id,
    kind: row.kind,
    author: mapAuthor(row.author),
    body,
    systemEventType: (row.systemEventType as FeedSystemEventType) ?? undefined,
    systemEntityHref,
    audience: row.audience,
    audienceLabel: audienceLabel(row.audience, specificNames),
    isPinned: row.isPinned,
    canPin: ctx.canModerate,
    canEdit: !isSystem && isMine,
    canDelete: !isSystem && (isMine || ctx.canModerate),
    isMine,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString(),
    attachments: row.attachments.map(mapAttachment),
    mentions: row.mentions.map(mapMentionUser),
    comments: row.comments
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((c) => mapComment(c, commentsById)),
    commentCount: row.comments.length,
    reactions: summary,
    myReaction,
    reactionCount,
  };
}
