"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishNotificationEvent } from "@/lib/notificationEvents";

export async function markNotificationReadAction(notificationId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();

  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true },
  });
  if (!existing || existing.userId !== user.id) return { ok: false };

  await prisma.notification.update({ where: { id: notificationId }, data: { isRead: true } });

  publishNotificationEvent({ type: "read", userId: user.id, notificationId });

  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<{ ok: boolean }> {
  const user = await requireUser();

  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });

  publishNotificationEvent({ type: "read", userId: user.id });

  return { ok: true };
}
