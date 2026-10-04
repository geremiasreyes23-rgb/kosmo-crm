import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CHROME_GRADIENT_STYLE } from "./chromeGradient";
import { MainFrame } from "./MainFrame";
import { MessengerProvider } from "@/components/messenger/MessengerProvider";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import { ToastNotificationProvider } from "@/components/notifications/ToastNotificationProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { DailyReportProvider } from "@/components/daily-report/DailyReportProvider";
import type { SessionUser } from "@/lib/auth";
import type { TimeEntryPayload } from "@/app/(app)/clock-actions";
import type { ProfileViewData } from "@/app/(app)/profile/data";
import type { MessengerInitialData } from "@/app/(app)/messages/data";
import type { NotificationInitialData } from "@/app/(app)/notifications/data";

export function AppShell({
  children,
  user,
  initialTimeEntry,
  profileData,
  messengerData,
  notificationData,
  visibleModuleKeys,
  canDailyReport = false,
}: {
  children: ReactNode;
  user: SessionUser;
  initialTimeEntry: TimeEntryPayload | null;
  profileData: ProfileViewData;
  messengerData: MessengerInitialData;
  notificationData: NotificationInitialData;
  /** Qué módulos del Sidebar ve este usuario, según su rol — ver
   * src/app/(app)/layout.tsx (de ahí sale calculado) y Configuración →
   * Roles y permisos → "Visibilidad de módulos" (de ahí se edita). */
  visibleModuleKeys: Set<string>;
  /** Puede registrar reportes diarios (activities:create) — habilita el
   * modal de Reporte diario (recordatorio + reloj de la jornada). */
  canDailyReport?: boolean;
}) {
  return (
    // ToastNotificationProvider va afuera de todo — así tanto
    // MessengerProvider (mensajes nuevos) como NotificationProvider (el
    // resto de eventos: tareas, correo interno, citas, Turning 65) pueden
    // lanzar una notificación emergente con useNotifyToast() sin importar
    // en qué pantalla del CRM esté el usuario.
    <ThemeProvider initialTheme={user.themePreference}>
    <ToastNotificationProvider>
      <MessengerProvider initialData={messengerData}>
        <NotificationProvider initialData={notificationData}>
        <DailyReportProvider userId={user.id} enabled={canDailyReport}>
          {/* El wrapper exterior lleva el mismo degradado morado→negro que
              Sidebar/Header (CHROME_GRADIENT_STYLE, con backgroundAttachment
              fixed para que coincida sin costuras). Antes el <main> ocupaba
              0 a 0 todo el espacio restante sin separación — ahora <main> es
              un panel angosto por un margen chico (arriba + izquierda), así
              que ese degradado del "chrome" se asoma en la separación y deja
              ver claramente las esquinas superiores redondeadas del panel,
              como una ventana integrada dentro de la app. Abajo y a la
              derecha el panel sigue llegando hasta el borde de la pantalla
              (sin esquinas redondeadas ahí) para no perder área útil. */}
          <div className="flex h-screen overflow-hidden" style={CHROME_GRADIENT_STYLE}>
            <Sidebar visibleModuleKeys={visibleModuleKeys} />
            <div className="flex min-w-0 flex-1 flex-col">
              <Header user={user} initialTimeEntry={initialTimeEntry} profileData={profileData} />
              <main className="ml-2.5 mt-2.5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[18px] bg-[var(--surface-page)] md:ml-3 md:mt-3">
                <MainFrame>{children}</MainFrame>
              </main>
            </div>
          </div>
        </DailyReportProvider>
        </NotificationProvider>
      </MessengerProvider>
    </ToastNotificationProvider>
    </ThemeProvider>
  );
}
