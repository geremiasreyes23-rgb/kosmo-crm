"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, hasPermission } from "@/lib/auth";
import { publishNotificationEvent } from "@/lib/notificationEvents";
import { publishFeedEvent } from "@/lib/feedEvents";
import { extractMentions } from "@/lib/feed/mentions";
import { stripMentionTokens } from "@/lib/feed/mentions";
import type { FeedAudience, FeedReactionType } from "@/types";
import type { NotificationVM } from "@/types";

export interface FeedActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const MAX_ATTACHMENT_SIZE_MB = 8;
const MAX_ATTACHMENTS_PER_POST = 5;

export interface FeedAttachmentInput {
  fileName: string;
  dataUrl: string;
  sizeBytes: number;
  mimeType?: string;
}

function validateAttachments(attachments: FeedAttachmentInput[] | undefined): string | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  if (attachments.length > MAX_ATTACHMENTS_PER_POST) {
    return `Puedes adjuntar hasta ${MAX_ATTACHMENTS_PER_POST} archivos por publicación.`;
  }
  for (const att of attachments) {
    if (!att.dataUrl.startsWith("data:")) {
      return `No se pudo procesar "${att.fileName}" — vuelve a adjuntarlo.`;
    }
    if (att.sizeBytes > MAX_ATTACHMENT_SIZE_MB * 1024 * 1024) {
      return `"${att.fileName}" supera el límite de ${MAX_ATTACHMENT_SIZE_MB}MB.`;
    }
  }
  return undefined;
}

/** Crea una notificación puntual (mismo patrón que messages/actions.ts) — a
 * diferencia de notificationScheduler.ts esto no es "descubrir" algo
 * revisando la base, es un evento puntual que ya sabemos que ocurrió. */
async function notifyUser(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
}) {
  const row = await prisma.notification.create({ data: params });
  const vm: NotificationVM = {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    relatedEntityType: row.relatedEntityType ?? undefined,
    relatedEntityId: row.relatedEntityId ?? undefined,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
  publishNotificationEvent({ type: "notification", userId: params.userId, notification: vm });
}

async function notifyMentionsAndBroadcast(params: {
  postId: string;
  authorId: string;
  authorName: string;
  audience: FeedAudience;
  mentionUserIds: string[];
  mentionsEveryone: boolean;
  excerpt: string;
  kind: "post" | "comment";
}) {
  const recipientIds = new Set<string>();
  for (const id of params.mentionUserIds) if (id !== params.authorId) recipientIds.add(id);

  if (params.mentionsEveryone || params.audience === "EVERYONE") {
    const everyone = await prisma.user.findMany({ where: { status: "ACTIVE", id: { not: params.authorId } }, select: { id: true } });
    // Solo se notifica de verdad a todos cuando se usó @Todos explícitamente
    // en el texto — el audience "Todos" por sí solo no genera una
    // notificación por cada publicación (sería demasiado ruido), ver spec
    // sección 16.
    if (params.mentionsEveryone) {
      for (const u of everyone) recipientIds.add(u.id);
    }
  }

  if (params.audience === "TEAM") {
    const author = await prisma.user.findUnique({ where: { id: params.authorId }, select: { department: true } });
    if (author?.department) {
      const teammates = await prisma.user.findMany({
        where: { status: "ACTIVE", department: author.department, id: { not: params.authorId } },
        select: { id: true },
      });
      for (const u of teammates) recipientIds.add(u.id);
    }
  }

  const title = params.kind === "post" ? "Nueva publicación en el Feed" : "Nuevo comentario en el Feed";
  await Promise.all(
    Array.from(recipientIds).map((userId) =>
      notifyUser({
        userId,
        type: params.kind === "post" ? "feed_post" : "feed_reply",
        title,
        message: `${params.authorName}: ${params.excerpt}`.slice(0, 180),
        relatedEntityType: "FeedPost",
        relatedEntityId: params.postId,
      })
    )
  );
}

export interface CreatePostInput {
  body: string;
  audience: FeedAudience;
  specificUserIds?: string[];
  attachments?: FeedAttachmentInput[];
}

export async function createPostAction(input: CreatePostInput): Promise<FeedActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "feed", "create")) {
    return { ok: false, error: "No tienes permiso para publicar en el Feed." };
  }

  const body = input.body.trim();
  const hasAttachments = (input.attachments?.length ?? 0) > 0;
  if (!body && !hasAttachments) {
    return { ok: false, error: "Escribe algo o adjunta un archivo antes de publicar." };
  }
  const attachmentError = validateAttachments(input.attachments);
  if (attachmentError) return { ok: false, error: attachmentError };

  if (input.audience === "SPECIFIC" && (!input.specificUserIds || input.specificUserIds.length === 0)) {
    return { ok: false, error: "Selecciona al menos una persona para esta publicación." };
  }

  const { userIds: mentionUserIds, mentionsEveryone } = extractMentions(body);

  const post = await prisma.feedPost.create({
    data: {
      authorId: user.id,
      body,
      kind: "USER",
      audience: input.audience,
      audienceUsers:
        input.audience === "SPECIFIC" && input.specificUserIds
          ? { create: input.specificUserIds.map((userId) => ({ userId })) }
          : undefined,
      attachments: hasAttachments
        ? {
            create: input.attachments!.map((a) => ({
              fileName: a.fileName,
              fileUrl: a.dataUrl,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
            })),
          }
        : undefined,
      mentions: mentionUserIds.length ? { create: mentionUserIds.map((mentionedUserId) => ({ mentionedUserId })) } : undefined,
    },
  });

  await notifyMentionsAndBroadcast({
    postId: post.id,
    authorId: user.id,
    authorName: `${user.firstName} ${user.lastName}`.trim(),
    audience: input.audience,
    mentionUserIds,
    mentionsEveryone,
    excerpt: stripMentionTokens(body).slice(0, 120) || "compartió un archivo",
    kind: "post",
  });

  publishFeedEvent({ type: "feed-changed", reason: "post-created" });
  revalidatePath("/feed");
  return { ok: true, id: post.id };
}

export async function editPostAction(postId: string, body: string): Promise<FeedActionResult> {
  const user = await requireUser();
  const post = await prisma.feedPost.findUnique({ where: { id: postId } });
  if (!post) return { ok: false, error: "La publicación ya no existe." };
  if (post.kind !== "USER") return { ok: false, error: "Las publicaciones de sistema no se pueden editar." };
  if (post.authorId !== user.id) return { ok: false, error: "Solo puedes editar tus propias publicaciones." };

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "La publicación no puede quedar vacía." };

  const { userIds: mentionUserIds } = extractMentions(trimmed);
  await prisma.$transaction([
    prisma.feedMention.deleteMany({ where: { postId } }),
    prisma.feedPost.update({
      where: { id: postId },
      data: {
        body: trimmed,
        editedAt: new Date(),
        mentions: mentionUserIds.length ? { create: mentionUserIds.map((mentionedUserId) => ({ mentionedUserId })) } : undefined,
      },
    }),
  ]);

  publishFeedEvent({ type: "feed-changed", reason: "post-updated" });
  revalidatePath("/feed");
  return { ok: true };
}

export async function deletePostAction(postId: string): Promise<FeedActionResult> {
  const user = await requireUser();
  const post = await prisma.feedPost.findUnique({ where: { id: postId }, select: { authorId: true, kind: true } });
  if (!post) return { ok: true };

  const canModerate = hasPermission(user, "feed", "moderate");
  if (post.kind === "SYSTEM" && !canModerate) {
    return { ok: false, error: "No tienes permiso para eliminar publicaciones de sistema." };
  }
  if (post.authorId !== user.id && !canModerate) {
    return { ok: false, error: "No puedes eliminar una publicación que no es tuya." };
  }

  await prisma.feedPost.delete({ where: { id: postId } });
  publishFeedEvent({ type: "feed-changed", reason: "post-deleted" });
  revalidatePath("/feed");
  return { ok: true };
}

export async function togglePinAction(postId: string, pinned: boolean): Promise<FeedActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "feed", "moderate")) {
    return { ok: false, error: "No tienes permiso para fijar publicaciones." };
  }
  await prisma.feedPost.update({
    where: { id: postId },
    data: { isPinned: pinned, pinnedAt: pinned ? new Date() : null, pinnedById: pinned ? user.id : null },
  });
  publishFeedEvent({ type: "feed-changed", reason: "post-pinned" });
  revalidatePath("/feed");
  return { ok: true };
}

export interface CreateCommentInput {
  postId: string;
  body: string;
  replyToId?: string;
}

export async function createCommentAction(input: CreateCommentInput): Promise<FeedActionResult> {
  const user = await requireUser();
  if (!hasPermission(user, "feed", "create")) {
    return { ok: false, error: "No tienes permiso para comentar en el Feed." };
  }
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Escribe un comentario antes de enviarlo." };

  const post = await prisma.feedPost.findUnique({ where: { id: input.postId }, select: { id: true, authorId: true, audience: true } });
  if (!post) return { ok: false, error: "La publicación ya no existe." };

  const { userIds: mentionUserIds, mentionsEveryone } = extractMentions(body);

  const comment = await prisma.feedComment.create({
    data: {
      postId: post.id,
      authorId: user.id,
      body,
      replyToId: input.replyToId,
      mentions: mentionUserIds.length ? { create: mentionUserIds.map((mentionedUserId) => ({ mentionedUserId })) } : undefined,
    },
  });

  const authorName = `${user.firstName} ${user.lastName}`.trim();
  const excerpt = stripMentionTokens(body).slice(0, 120);

  // A quien comenta le responde: al autor del post (si no es uno mismo) y,
  // si es una respuesta a otro comentario, también a ese comentarista.
  const directRecipients = new Set<string>();
  if (post.authorId && post.authorId !== user.id) directRecipients.add(post.authorId);
  if (input.replyToId) {
    const replyTo = await prisma.feedComment.findUnique({ where: { id: input.replyToId }, select: { authorId: true } });
    if (replyTo && replyTo.authorId !== user.id) directRecipients.add(replyTo.authorId);
  }
  await Promise.all(
    Array.from(directRecipients).map((userId) =>
      notifyUser({
        userId,
        type: "feed_reply",
        title: "Nuevo comentario en el Feed",
        message: `${authorName}: ${excerpt}`.slice(0, 180),
        relatedEntityType: "FeedPost",
        relatedEntityId: post.id,
      })
    )
  );

  await notifyMentionsAndBroadcast({
    postId: post.id,
    authorId: user.id,
    authorName,
    audience: post.audience,
    mentionUserIds,
    mentionsEveryone,
    excerpt,
    kind: "comment",
  });

  publishFeedEvent({ type: "feed-changed", reason: "comment-created" });
  revalidatePath("/feed");
  return { ok: true, id: comment.id };
}

export async function toggleReactionAction(postId: string, type: FeedReactionType): Promise<FeedActionResult> {
  const user = await requireUser();
  const post = await prisma.feedPost.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post) return { ok: false, error: "La publicación ya no existe." };

  const existing = await prisma.feedReaction.findUnique({
    where: { postId_userId: { postId, userId: user.id } },
  });

  if (existing && existing.type === type) {
    await prisma.feedReaction.delete({ where: { id: existing.id } });
  } else if (existing) {
    await prisma.feedReaction.update({ where: { id: existing.id }, data: { type } });
  } else {
    await prisma.feedReaction.create({ data: { postId, userId: user.id, type } });
    if (post.authorId && post.authorId !== user.id) {
      const userName = `${user.firstName} ${user.lastName}`.trim();
      await notifyUser({
        userId: post.authorId,
        type: "feed_reaction",
        title: "Nueva reacción en el Feed",
        message: `${userName} reaccionó a tu publicación.`,
        relatedEntityType: "FeedPost",
        relatedEntityId: postId,
      });
    }
  }

  publishFeedEvent({ type: "feed-changed", reason: "reaction-changed" });
  revalidatePath("/feed");
  return { ok: true };
}
