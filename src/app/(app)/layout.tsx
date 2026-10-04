import { AppShell } from "@/components/layout/AppShell";
import { requireUser, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NAV_MODULE_KEYS } from "@/lib/navModules";
import { getProfileViewData } from "./profile/data";
import { getMessengerBadgeData } from "./messages/data";
import type { MessengerInitialData } from "./messages/data";
import { avatarColorFromId } from "@/lib/utils";
import { getNotificationsForUser } from "./notifications/data";
import type { TimeEntryPayload } from "./clock-actions";

export const dynamic = "force-dynamic";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Qué módulos del Sidebar ve este usuario — Super Admin siempre ve todo
  // (mismo criterio "bypass fijo" que hasPermission() en lib/auth.ts, para
  // que nunca quede accidentalmente afuera de su propia Configuración);
  // el resto lee RoleModuleVisibility, editable desde Configuración →
  // Roles y permisos → "Visibilidad de módulos" (roles-actions.ts).
  const visibleModuleKeys =
    user.roleName === "Super Admin"
      ? new Set(NAV_MODULE_KEYS)
      : new Set(
          (
            await prisma.roleModuleVisibility.findMany({
              where: { roleId: user.roleId, visible: true },
              select: { moduleKey: true },
            })
          ).map((v) => v.moduleKey)
        );

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

  // Chat interno — SOLO lo que necesita el badge de no-leídos del Sidebar
  // (visible en cualquier página, no solo en /messages): conteos y el par
  // id/otherUserId de cada conversación. Hasta sep/2026 esto traía el
  // historial COMPLETO de mensajes con imágenes en base64 en cada
  // navegación de toda la app — ver getMessengerBadgeData en messages/data.ts
  // para el detalle del incidente de egress que causó. El historial
  // completo (con imágenes y el roster con avatares) se pide una sola vez
  // desde el cliente al montar MessengerProvider (getMessengerFullDataAction).
  const messengerBadgeData = await getMessengerBadgeData(user);

  // currentUser liviano para MessengerProvider — se arma directo de `user`
  // (ya viene de requireUser(), sin consulta adicional) para no tener que
  // traer el roster completo solo para saber quién soy yo mismo.
  const messengerData: MessengerInitialData = {
    currentUser: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      role: user.roleName,
      avatarColor: avatarColorFromId(user.id),
      avatarUrl: user.avatarUrl ?? undefined,
      status: "ONLINE",
    },
    users: [],
    conversations: messengerBadgeData.conversations,
    messagesByConv: {},
    unreadByConv: messengerBadgeData.unreadByConv,
  };

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
      visibleModuleKeys={visibleModuleKeys}
      canDailyReport={hasPermission(user, "activities", "create")}
    >
      {children}
    </AppShell>
  );
}
