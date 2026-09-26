import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProfileViewData } from "./profile/data";
import { getMessengerViewData } from "./messages/data";
import { getNotificationsForUser } from "./notifications/data";
import type { TimeEntryPayload } from "./clock-actions";

export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Jornada de fichaje abierta (si hay una) — se pasa al Header para que el
  // cronómetro arranque con el estado real guardado en base de datos, no
  // desde cero en cada carga de página.
  const activeEntry = await prisma.timeEntry.findFirst({
    where: { userId: user.id, status: { in: ["WORKING", "PAUSED"] } },
    orderBy: { clockIn: "desc" },
  });
  const initialTimeEntry: TimeEntryPayload | null = activeEntry
    ? {
        id: activeEntry.id,
        status: activeEntry.status,
        clockIn: activeEntry.clockIn.toISOString(),
        pausedAt: activeEntry.pausedAt ? activeEntry.pausedAt.toISOString() : null,
        totalPausedSeconds: activeEntry.totalPausedSeconds,
      }
    : null;

  // "Mi perfil" (el panel lateral que abre el Header) necesita bastante más
  // que SessionUser — foto de portada, ficha de contacto, reconocimientos,
  // actividad reciente — así que se resuelve una sola vez acá (se recalcula
  // en cada navegación, igual que activeEntry arriba) y baja por props hasta
  // el Header, que es quien realmente lo usa.
  const profileData = await getProfileViewData(user);

  // Chat interno — usuarios, conversaciones, mensajes y no-leídos reales
  // (reemplaza el shell de datos ficticios de Fase 1). Se resuelve acá
  // porque el badge de no-leídos vive en el Sidebar, visible en cualquier
  // página, no solo en /messages.
  const messengerData = await getMessengerViewData(user);

  // Campanita de notificaciones — mismo motivo que messengerData: se
  // resuelve acá porque el contador de no-leídas vive en el Header, visible
  // en cualquier página.
  const notificationData = await getNotificationsForUser(user.id);

  return (
    <AppShell
      user={user}
      initialTimeEntry={initialTimeEntry}
      profileData={profileData}
      messengerData={messengerData}
      notificationData={notificationData}
    >
      {children}
    </AppShell>
  );
}
