import {
  Mail,
  MessageCircle,
  CheckSquare2,
  ClipboardList,
  CalendarClock,
  Cake,
  UserCheck,
  Users,
  ListChecks,
  ShieldCheck,
  DollarSign,
  Megaphone,
  AlertTriangle,
  Bell,
  ClipboardCheck,
  FileClock,
  Newspaper,
  MessageSquare,
  ThumbsUp,
  Send,
  type LucideIcon,
} from "lucide-react";
import type { NotificationVM } from "@/types";

/**
 * Metadatos visuales (ícono + color de acento) por tipo de notificación —
 * un único lugar del que toman tanto la campanita del Header
 * (NotificationBell) como las notificaciones emergentes flotantes
 * (ToastNotificationProvider), para no mantener dos mapas de íconos
 * duplicados y desincronizados.
 *
 * Los tipos internal_mail...turning_65 y documentation_pending ya se
 * generan solos hoy (ver messages/actions.ts, mail/actions.ts y
 * notificationScheduler.ts). El resto todavía no tiene un disparador en el backend — están acá para
 * que el sistema de notificaciones emergentes quede listo para usarlos en
 * cuanto se conecten (ver el pedido de "sistema reutilizable" del CRM), sin
 * inventar datos ni fabricar eventos que no existen todavía.
 */
export interface NotificationTypeMeta {
  icon: LucideIcon;
  /** Color de acento (borde/ícono) — coincide con el color de esa sección
   * en el sidebar (ver Sidebar.tsx) cuando existe, para que la notificación
   * se sienta parte del mismo sistema visual. */
  accent: string;
}

export const NOTIFICATION_TYPE_META: Record<string, NotificationTypeMeta> = {
  internal_message: { icon: MessageCircle, accent: "#20b6ac" },
  internal_mail: { icon: Mail, accent: "#5b6bd6" },
  task_overdue: { icon: CheckSquare2, accent: "#e34948" },
  task_upcoming: { icon: CheckSquare2, accent: "#eda100" },
  task_assigned: { icon: ClipboardList, accent: "#3987e5" },
  upcoming_appointment: { icon: CalendarClock, accent: "#1baf7a" },
  turning_65: { icon: Cake, accent: "#e87ba4" },
  new_client: { icon: UserCheck, accent: "#1baf7a" },
  new_lead: { icon: Users, accent: "#eb6834" },
  client_status_change: { icon: UserCheck, accent: "#1baf7a" },
  new_activity: { icon: ListChecks, accent: "#e87ba4" },
  policy_update: { icon: ShieldCheck, accent: "#4a3aa7" },
  new_commission: { icon: DollarSign, accent: "#eda100" },
  admin_notice: { icon: Megaphone, accent: "#898781" },
  system_alert: { icon: AlertTriangle, accent: "#e34948" },
  daily_report_submitted: { icon: ListChecks, accent: "#e87ba4" },
  daily_report_reviewed: { icon: ClipboardCheck, accent: "#e87ba4" },
  documentation_pending: { icon: FileClock, accent: "#eda100" },
  submission_requested: { icon: Send, accent: "#c2185b" },
  submission_updated: { icon: Send, accent: "#c2185b" },
  // Feed de Actividades
  feed_post: { icon: Newspaper, accent: "#8b5cf6" },
  feed_reply: { icon: MessageSquare, accent: "#8b5cf6" },
  feed_reaction: { icon: ThumbsUp, accent: "#8b5cf6" },
};

const DEFAULT_META: NotificationTypeMeta = { icon: Bell, accent: "#898781" };

export function notificationTypeMeta(type: string): NotificationTypeMeta {
  return NOTIFICATION_TYPE_META[type] ?? DEFAULT_META;
}

/** A qué pantalla lleva un click sobre esta notificación. */
export function notificationHref(n: Pick<NotificationVM, "relatedEntityType" | "relatedEntityId">): string {
  switch (n.relatedEntityType) {
    case "InternalMessage":
      return "/mail";
    case "Conversation":
      return "/messages";
    case "Task":
      return "/tasks";
    case "Appointment":
      return "/calendar";
    case "Client":
      return n.relatedEntityId ? `/clients/${n.relatedEntityId}` : "/clients";
    case "LeadSubmission":
      return "/submissions";
    case "Lead":
      return n.relatedEntityId ? `/leads/${n.relatedEntityId}` : "/leads";
    case "Policy":
      return "/policies";
    case "Sale":
    case "Commission":
      return "/commissions";
    case "Activity":
    case "DailyReport":
      return "/activities";
    case "FeedPost":
      return n.relatedEntityId ? `/feed#post-${n.relatedEntityId}` : "/feed";
    default:
      return "#";
  }
}
