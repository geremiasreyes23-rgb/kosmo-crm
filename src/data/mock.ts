// Datos de demostración para el UI Shell (Fase 1). Todo es ficticio y no
// representa personas ni cuentas reales; los identificadores sensibles se
// muestran siempre enmascarados, tal como lo haría el sistema en producción.
import type {
  Lead,
  Client,
  Policy,
  Sale,
  CrmTask,
  ActivityItem,
  AppointmentItem,
  CommissionRow,
  DashboardSummary,
  PipelineStage,
} from "@/types";

export const leadPipelineStages: PipelineStage[] = [
  { id: "new", name: "Nuevo", order: 1 },
  { id: "contact", name: "Contactar", order: 2 },
  { id: "contacted", name: "Contactado", order: 3 },
  { id: "qualified", name: "Calificado", order: 4 },
  { id: "appt", name: "Cita programada", order: 5 },
  { id: "in_process", name: "En proceso", order: 6 },
  { id: "offer", name: "Oferta presentada", order: 7 },
  { id: "docs", name: "Documentación pendiente", order: 8 },
  { id: "won", name: "Venta cerrada", order: 9, isWon: true },
  { id: "not_interested", name: "No interesado", order: 10, isLost: true },
  { id: "not_qualified", name: "No califica", order: 11, isLost: true },
  { id: "lost", name: "Perdido", order: 12, isLost: true },
];

export const salesPipelineStages: PipelineStage[] = [
  { id: "s_quote", name: "Cotización", order: 1 },
  { id: "s_application", name: "Aplicación", order: 2 },
  { id: "s_pending", name: "Pendiente", order: 3 },
  { id: "s_approved", name: "Aprobada", order: 4 },
  { id: "s_won", name: "Cerrada", order: 5, isWon: true },
  { id: "s_lost", name: "Perdida", order: 6, isLost: true },
];

export const dashboardSummary: DashboardSummary = {
  newLeads: 38,
  pendingLeads: 21,
  contactedLeads: 54,
  convertedLeads: 17,
  newClients: 12,
  salesThisMonth: 29,
  activePolicies: 214,
  pendingPolicies: 16,
  cancelledPolicies: 5,
  commissionsPending: 18400,
  commissionsPaid: 62300,
  chargebacks: 3,
  margin: 41250,
};

export const salesByLineChart = [
  { line: "Medicare Advantage", ventas: 62 },
  { line: "Obamacare", ventas: 48 },
  { line: "Family Heritage", ventas: 21 },
];

export const salesTrendChart = [
  { mes: "Abr", ventas: 24 },
  { mes: "May", ventas: 31 },
  { mes: "Jun", ventas: 27 },
  { mes: "Jul", ventas: 35 },
  { mes: "Ago", ventas: 30 },
  { mes: "Sep", ventas: 29 },
];

export const leadConversionChart = [
  { etapa: "Nuevo", cantidad: 38 },
  { etapa: "Contactado", cantidad: 54 },
  { etapa: "Calificado", cantidad: 33 },
  { etapa: "Cita", cantidad: 22 },
  { etapa: "Cerrado", cantidad: 17 },
];

export const leads: Lead[] = [
  {
    id: "L-1042",
    firstName: "Marta",
    lastName: "Reyes",
    phone: "(305) 555-0142",
    email: "marta.reyes@example.com",
    state: "FL",
    source: "Referido",
    agentName: "Carlos Gómez",
    stageId: "contacted",
    createdAt: "2026-09-01",
    lastContactAt: "2026-09-08",
    nextFollowUpAt: "2026-09-15",
    productLine: "Medicare Advantage",
    customFieldValues: { medicareNumber: "1EG4-TE5-MK72", hasMedicaid: "No", currentCarrier: "Humana" },
  },
  { id: "L-1043", firstName: "Luis", lastName: "Fernández", phone: "(786) 555-0119", email: "luis.fernandez@example.com", state: "FL", source: "Base de datos", agentName: "Ana Ibarra", stageId: "new", createdAt: "2026-09-10" },
  { id: "L-1044", firstName: "Yolanda", lastName: "Pérez", phone: "(407) 555-0187", state: "FL", source: "Evento", agentName: "Carlos Gómez", stageId: "appt", createdAt: "2026-08-27", nextFollowUpAt: "2026-09-14" },
  { id: "L-1045", firstName: "Roberto", lastName: "Díaz", phone: "(954) 555-0166", email: "roberto.diaz@example.com", state: "FL", source: "Llamada entrante", agentName: "Ana Ibarra", stageId: "offer", createdAt: "2026-08-20" },
  { id: "L-1046", firstName: "Carmen", lastName: "Salazar", phone: "(305) 555-0133", state: "FL", source: "Referido", agentName: "Carlos Gómez", stageId: "qualified", createdAt: "2026-09-05" },
  { id: "L-1047", firstName: "Pedro", lastName: "Nuñez", phone: "(786) 555-0155", state: "FL", source: "Otro", agentName: "Ana Ibarra", stageId: "not_interested", createdAt: "2026-08-15" },
];

export const clients: Client[] = [
  { id: "C-3081", firstName: "Josefina", lastName: "Ramírez", dob: "1958-03-12", phone: "(305) 555-0201", email: "josefina.ramirez@example.com", address: "1200 Brickell Ave", state: "FL", county: "Miami-Dade", preferredLanguage: "Español", agentName: "Carlos Gómez", aorName: "Alliance Insurance", createdAt: "2023-04-11", activePolicies: 2, linesOfBusiness: ["Medicare Advantage"] },
  { id: "C-3082", firstName: "Manuel", lastName: "Torres", dob: "1972-11-02", phone: "(786) 555-0212", email: "manuel.torres@example.com", address: "45 SW 8th St", state: "FL", county: "Miami-Dade", preferredLanguage: "Español", agentName: "Ana Ibarra", createdAt: "2024-01-22", activePolicies: 1, linesOfBusiness: ["Obamacare"] },
  { id: "C-3083", firstName: "Gloria", lastName: "Mendoza", dob: "1960-07-19", phone: "(407) 555-0223", address: "780 Orange Ave", state: "FL", county: "Orange", preferredLanguage: "Español", agentName: "Carlos Gómez", createdAt: "2022-09-30", activePolicies: 3, linesOfBusiness: ["Medicare Advantage", "Family Heritage"] },
  { id: "C-3084", firstName: "Ricardo", lastName: "Vega", dob: "1985-02-28", phone: "(954) 555-0234", address: "22 Las Olas Blvd", state: "FL", county: "Broward", preferredLanguage: "Inglés", agentName: "Ana Ibarra", createdAt: "2025-06-14", activePolicies: 1, linesOfBusiness: ["Obamacare"] },
];

export const policies: Policy[] = [
  { id: "P-9001", policyNumber: "MED-778812", clientName: "Josefina Ramírez", line: "Medicare Advantage", carrier: "Humana", planName: "Gold Plus HMO", premium: 0, saleDate: "2023-04-11", effectiveDate: "2023-05-01", status: "ACTIVE", agentName: "Carlos Gómez" },
  { id: "P-9002", policyNumber: "OBA-441029", clientName: "Manuel Torres", line: "Obamacare", carrier: "Oscar Health", planName: "Silver Simple", premium: 128, saleDate: "2024-01-22", effectiveDate: "2024-02-01", status: "ACTIVE", agentName: "Ana Ibarra" },
  { id: "P-9003", policyNumber: "FH-220091", clientName: "Gloria Mendoza", line: "Family Heritage", carrier: "Family Heritage Life", planName: "Elite 8 Family", premium: 89, saleDate: "2022-09-30", effectiveDate: "2022-10-15", status: "ACTIVE", agentName: "Carlos Gómez" },
  { id: "P-9004", policyNumber: "OBA-441077", clientName: "Ricardo Vega", line: "Obamacare", carrier: "Ambetter", planName: "Bronze Basic", premium: 64, saleDate: "2025-06-14", effectiveDate: "2025-07-01", status: "PENDING", agentName: "Ana Ibarra" },
  { id: "P-9005", policyNumber: "MED-778850", clientName: "Gloria Mendoza", line: "Medicare Advantage", carrier: "CarePlus", planName: "Complete Care HMO", premium: 0, saleDate: "2024-11-02", effectiveDate: "2024-12-01", status: "CANCELLED", agentName: "Carlos Gómez" },
];

export const salesPipeline: Sale[] = [
  { id: "S-501", clientName: "Luis Fernández", agentName: "Ana Ibarra", line: "Medicare Advantage", carrier: "Humana", premium: 0, stageId: "s_quote", saleDate: "2026-09-10", expectedCommission: 480 },
  { id: "S-502", clientName: "Yolanda Pérez", agentName: "Carlos Gómez", line: "Obamacare", carrier: "Oscar Health", premium: 142, stageId: "s_application", saleDate: "2026-09-08", expectedCommission: 210 },
  { id: "S-503", clientName: "Roberto Díaz", agentName: "Ana Ibarra", line: "Obamacare", carrier: "Ambetter", premium: 98, stageId: "s_pending", saleDate: "2026-09-05", expectedCommission: 195 },
  { id: "S-504", clientName: "Carmen Salazar", agentName: "Carlos Gómez", line: "Family Heritage", carrier: "Family Heritage Life", premium: 76, stageId: "s_approved", saleDate: "2026-09-02", expectedCommission: 320 },
];

export const tasks: CrmTask[] = [
  { id: "T-201", title: "Llamar para confirmar cita", relatedTo: "Marta Reyes", assignedTo: "Carlos Gómez", dueDate: "2026-09-14", priority: "HIGH", status: "PENDING" },
  { id: "T-202", title: "Enviar cotización Obamacare", relatedTo: "Luis Fernández", assignedTo: "Ana Ibarra", dueDate: "2026-09-13", priority: "URGENT", status: "IN_PROGRESS" },
  { id: "T-203", title: "Recoger documentación pendiente", relatedTo: "Roberto Díaz", assignedTo: "Ana Ibarra", dueDate: "2026-09-16", priority: "MEDIUM", status: "PENDING" },
  { id: "T-204", title: "Seguimiento post-venta", relatedTo: "Gloria Mendoza", assignedTo: "Carlos Gómez", dueDate: "2026-09-20", priority: "LOW", status: "PENDING" },
];

export const activities: ActivityItem[] = [
  { id: "A-701", type: "CALL", relatedTo: "Marta Reyes", user: "Carlos Gómez", occurredAt: "2026-09-08T14:30:00", notes: "Interesada, pidió llamar la próxima semana." },
  { id: "A-702", type: "EMAIL", relatedTo: "Luis Fernández", user: "Ana Ibarra", occurredAt: "2026-09-10T09:15:00", notes: "Se envió folleto de planes Obamacare." },
  { id: "A-703", type: "MEETING", relatedTo: "Yolanda Pérez", user: "Carlos Gómez", occurredAt: "2026-09-09T16:00:00", notes: "Cita presencial en oficina." },
  { id: "A-704", type: "NOTE", relatedTo: "Gloria Mendoza", user: "Carlos Gómez", occurredAt: "2026-09-07T11:00:00", notes: "Cliente satisfecha, posible referido." },
];

export const appointments: AppointmentItem[] = [
  { id: "AP-301", title: "Revisión anual de plan", relatedTo: "Josefina Ramírez", startsAt: "2026-09-15T10:00:00", durationMinutes: 45, status: "CONFIRMED" },
  { id: "AP-302", title: "Presentación Medicare", relatedTo: "Yolanda Pérez", startsAt: "2026-09-14T15:30:00", durationMinutes: 60, status: "SCHEDULED" },
  { id: "AP-303", title: "Firma de aplicación", relatedTo: "Roberto Díaz", startsAt: "2026-09-16T09:00:00", durationMinutes: 30, status: "SCHEDULED" },
];

export const commissions: CommissionRow[] = [
  { id: "CM-801", policyNumber: "MED-778812", clientName: "Josefina Ramírez", line: "Medicare Advantage", agentAmount: 420, aorAmount: 60, carrierCommission: 540, margin: 60, status: "PAID" },
  { id: "CM-802", policyNumber: "OBA-441029", clientName: "Manuel Torres", line: "Obamacare", agentAmount: 180, aorAmount: 0, carrierCommission: 210, margin: 30, status: "PAID" },
  { id: "CM-803", policyNumber: "FH-220091", clientName: "Gloria Mendoza", line: "Family Heritage", agentAmount: 260, aorAmount: 40, carrierCommission: 340, margin: 40, status: "PENDING" },
  { id: "CM-804", policyNumber: "MED-778850", clientName: "Gloria Mendoza", line: "Medicare Advantage", agentAmount: 0, aorAmount: 0, carrierCommission: 0, margin: 0, status: "CHARGEBACK" },
];

export const agentPerformance = [
  { agente: "Carlos Gómez", ventas: 34 },
  { agente: "Ana Ibarra", ventas: 27 },
  { agente: "Marisol Ortega", ventas: 19 },
];

export const turning65Alerts = [
  { clientName: "Manuel Torres", dob: "1972-11-02", turns65On: "2037-11-02" },
  { clientName: "Ricardo Vega", dob: "1985-02-28", turns65On: "2050-02-28" },
];
