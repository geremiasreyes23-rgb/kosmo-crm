/**
 * Catálogo único de tipos de notificación automática — fuente de verdad
 * compartida entre el seed (valores por defecto), notificationScheduler.ts
 * (qué umbral usar) y el panel de Configuración → Notificaciones (qué
 * mostrar y qué unidad tiene cada umbral). Antes de esto los umbrales
 * estaban fijos como constantes sueltas dentro del scheduler, sin ninguna
 * pantalla que los tocara.
 */
export type NotificationSettingUnit = "hours" | "days" | null;

export interface NotificationSettingDef {
  type: string;
  label: string;
  description: string;
  unit: NotificationSettingUnit;
  defaultEnabled: boolean;
  defaultThreshold: number | null;
}

export const NOTIFICATION_SETTINGS: NotificationSettingDef[] = [
  {
    type: "task_overdue",
    label: "Tareas vencidas",
    description: "Avisa al responsable apenas una tarea pasa su fecha límite sin completarse.",
    unit: null,
    defaultEnabled: true,
    defaultThreshold: null,
  },
  {
    type: "task_upcoming",
    label: "Tareas por vencer",
    description: "Avisa antes de que una tarea llegue a su fecha límite.",
    unit: "hours",
    defaultEnabled: true,
    defaultThreshold: 24,
  },
  {
    type: "upcoming_appointment",
    label: "Citas próximas",
    description: "Avisa antes de que empiece una cita agendada.",
    unit: "hours",
    defaultEnabled: true,
    defaultThreshold: 24,
  },
  {
    type: "documentation_pending",
    label: "Documentación pendiente",
    description: 'Avisa cuando un lead lleva demasiado tiempo parado en la etapa "Documentación pendiente".',
    unit: "days",
    defaultEnabled: true,
    defaultThreshold: 3,
  },
  {
    type: "turning_65",
    label: "Cliente cumple 65 años",
    description: "Avisa al agente cuando uno de sus clientes está por cumplir 65 (ventana de Medicare).",
    unit: "days",
    defaultEnabled: true,
    defaultThreshold: 30,
  },
  {
    type: "chargeback",
    label: "Chargeback de comisión",
    description: "Avisa al vendedor y al manager cuando una comisión pasa a estado Chargeback.",
    unit: null,
    defaultEnabled: true,
    defaultThreshold: null,
  },
];

export const NOTIFICATION_SETTING_TYPES: string[] = NOTIFICATION_SETTINGS.map((n) => n.type);
