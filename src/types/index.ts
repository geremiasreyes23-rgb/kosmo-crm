// Tipos de UI — reflejan el modelo de prisma/schema.prisma en una forma
// liviana para alimentar el shell visual con datos mock. Cuando se conecte
// la base de datos real (Fase 2+), estos tipos se derivan de Prisma Client.

export type PipelineStageName = string;

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  isWon?: boolean;
  isLost?: boolean;
}

export interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  isSeller: boolean;
  isAor: boolean;
  status: "ACTIVE" | "INACTIVE";
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  state?: string;
  source: string;
  agentName: string;
  stageId: string;
  createdAt: string;
  lastContactAt?: string;
  nextFollowUpAt?: string;
  /** Producto/línea de interés — determina qué campos específicos se
   * capturaron en la creación del lead (ver src/data/customFields.ts). */
  productLine?: string;
  /** Valores de campos personalizados (por línea + agregados a mano),
   * guardados como pares clave/valor tal como los modela CustomFieldValue
   * en el schema de Prisma. */
  customFieldValues?: Record<string, string>;
  /** Presente solo si este lead ya fue convertido a cliente (sección 6.B
   * del brief) — el botón "Convertir a cliente" pasa a mostrar un enlace al
   * cliente en vez de la acción, y no se puede convertir dos veces. */
  convertedClientId?: string;
  convertedAt?: string;
}

/** Vista previa segura de un campo sensible (SSN, cuenta bancaria...) — solo
 * la máscara, nunca el valor real (ver src/lib/sensitiveData.ts, que sí vive
 * en el servidor). El valor real solo llega al cliente bajo demanda, vía
 * revealSensitiveFieldAction, y solo si el usuario tiene el permiso
 * "sensitive_data:view". */
export interface SensitiveFieldVM {
  id: string;
  fieldKey: string;
  label: string;
  maskedPreview: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  /** ID visible asignado por el sistema (Client.clientNumber) — usar
   * formatClientCode() en src/lib/utils.ts para mostrarlo como "C-000123". */
  clientNumber: number;
  firstName: string;
  lastName: string;
  dob?: string;
  phone?: string;
  email?: string;
  address?: string;
  zipCode?: string;
  state?: string;
  county?: string;
  preferredLanguage?: string;
  sourceId?: string;
  sourceName?: string;
  agentId?: string;
  agentName: string;
  aorId?: string;
  aorName?: string;
  /** Lead del que se originó este cliente, si vino de una conversión (ver
   * convertLeadToClientAction) — null/undefined si se creó directo. */
  originLeadId?: string;
  createdAt: string;
  activePolicies: number;
  linesOfBusiness: string[];
  customFieldValues?: Record<string, string>;
  /** Solo máscaras — ver SensitiveFieldVM. Opcional para no romper datos de
   * demostración que no traen ninguna; en datos reales siempre viene, aunque
   * sea un arreglo vacío (ver getClientForUser en clients/data.ts). */
  sensitiveFields?: SensitiveFieldVM[];
  /** Pólizas reales del cliente (Policy, sección 9 del brief) — vacío hasta
   * que exista un flujo que las cree (fase posterior). Opcional por la
   * misma razón que sensitiveFields. */
  policies?: ClientPolicyVM[];
}

export interface ClientPolicyVM {
  id: string;
  policyNumber?: string;
  line: string;
  carrier: string;
  planName?: string;
  premium?: number;
  status: PolicyStatus;
  commission?: {
    agentAmount?: number;
    aorAmount?: number;
    status: "PENDING" | "PAID" | "CHARGEBACK";
  };
}

export type PolicyStatus =
  | "QUOTE"
  | "APPLICATION"
  | "PENDING"
  | "APPROVED"
  | "ACTIVE"
  | "CANCELLED"
  | "REJECTED"
  | "CHARGEBACK";

export interface Policy {
  id: string;
  policyNumber?: string;
  clientId: string;
  clientName: string;
  insuranceLineId: string;
  line: string;
  carrierId: string;
  carrier: string;
  planName?: string;
  premium?: number;
  saleDate?: string;
  effectiveDate?: string;
  status: PolicyStatus;
  agentId?: string;
  agentName: string;
}

export type SaleMethod = "PHONE" | "IN_PERSON" | "VIRTUAL" | "ONLINE";

export interface Sale {
  id: string;
  /** Se liga a un Client O a un Lead, nunca ambos (ver Sale en el schema) —
   * igual convención que Activity/Task/Appointment. */
  clientId?: string;
  leadId?: string;
  /** Nombre del cliente o lead vinculado, listo para mostrar. */
  clientName: string;
  agentId?: string;
  agentName: string;
  insuranceLineId?: string;
  line: string;
  carrierId?: string;
  carrier: string;
  planName?: string;
  premium: number;
  method?: SaleMethod;
  stageId: string;
  saleDate: string;
  effectiveDate?: string;
  expectedCommission?: number;
  receivedCommission?: number;
  /** Presente solo si esta venta ya generó su Policy (al llegar a una etapa
   * isWon) — ver sección 6.C del brief de arquitectura. */
  policyId?: string;
}

export interface NoteVM {
  id: string;
  body: string;
  createdAt: string;
  leadId?: string;
  clientId?: string;
  policyId?: string;
}

export interface DocumentVM {
  id: string;
  fileName: string;
  fileUrl: string;
  category?: string;
  uploadedByName: string;
  uploadedAt: string;
  leadId?: string;
  clientId?: string;
  saleId?: string;
  policyId?: string;
  /** A qué tipo de registro está ligado — para el módulo standalone
   * /documents, que lista documentos de las 4 entidades a la vez (ver
   * relatedInfo en documents/data.ts). Ausente solo si el documento quedó
   * huérfano (su lead/cliente/venta/póliza fue borrado). */
  relatedType?: "Lead" | "Client" | "Sale" | "Policy";
  relatedLabel?: string;
  relatedHref?: string;
}

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface CrmTask {
  id: string;
  title: string;
  description?: string;
  /** Etiqueta lista para mostrar — nombre del lead/cliente vinculado, o "—"
   * si no tiene. Los datos reales además traen relatedLeadId/relatedClientId
   * para poder linkear; los de demostración (src/data/mock.ts) solo traen
   * esta etiqueta. */
  relatedTo: string;
  relatedLeadId?: string;
  relatedClientId?: string;
  assignedTo: string;
  assignedToId?: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
}

export interface ActivityItem {
  id: string;
  type: "CALL" | "EMAIL" | "SMS" | "WHATSAPP" | "MEETING" | "NOTE" | "FOLLOW_UP";
  relatedTo: string;
  relatedLeadId?: string;
  relatedClientId?: string;
  user: string;
  occurredAt: string;
  notes?: string;
}

export type DailyReportStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface DailyReportVM {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  content: string;
  status: DailyReportStatus;
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewComment?: string;
  createdAt: string;
}

export interface AppointmentItem {
  id: string;
  title: string;
  relatedTo: string;
  relatedLeadId?: string;
  relatedClientId?: string;
  startsAt: string;
  durationMinutes: number;
  status: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
}

export interface CommissionRow {
  id: string;
  policyNumber: string;
  clientName: string;
  line: string;
  agentAmount: number;
  aorAmount: number;
  carrierCommission: number;
  margin: number;
  status: "PENDING" | "PAID" | "CHARGEBACK";
}

export type ChatUserStatus = "ONLINE" | "AWAY" | "OFFLINE";

export interface ChatUser {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  status: ChatUserStatus;
  /** Iniciales a mostrar en el avatar; si no se define, se calculan del nombre. */
  initials?: string;
  /** Foto de perfil real (mismo avatarUrl de User) — si no hay, se muestran
   * las iniciales sobre avatarColor. */
  avatarUrl?: string;
}

export interface MessageAttachment {
  id: string;
  type: "IMAGE";
  url: string;
  name?: string;
}

export type MessageDeliveryStatus = "SENT" | "DELIVERED" | "READ";

export interface ChatMessage {
  id: string;
  conversationId: string;
  /** id de ChatUser — "me" para el usuario actual (Yoaldrys). */
  senderId: string;
  text?: string;
  /** Emoji usado como "sticker" — se muestra grande, sin fondo de burbuja. */
  sticker?: string;
  attachments?: MessageAttachment[];
  sentAt: string;
  status?: MessageDeliveryStatus;
  /** Cuándo se editó por última vez — solo el remitente puede editar, y solo
   * el texto (no aplica a stickers). undefined = nunca editado. */
  editedAt?: string;
  /** Borrado lógico — cuando está seteado, text/sticker/attachments ya no
   * viajan del servidor y la UI muestra "Mensaje eliminado" en su lugar. */
  deletedAt?: string;
  /** Mensaje fijado de la conversación (uno solo a la vez, ver
   * togglePinMessageAction). */
  pinned?: boolean;
}

/** Fila del modelo Notification, tal como la ve el cliente — ver
 * src/lib/notificationScheduler.ts para los tipos que se generan solos
 * (task_overdue, task_upcoming, upcoming_appointment, turning_65) y
 * mail/actions.ts (internal_mail) / messages/actions.ts (internal_message)
 * para los que se generan al momento. */
export interface NotificationVM {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  /** Otro participante además de "me" (chats 1:1 por ahora). */
  userId: string;
  pinned?: boolean;
}

/** Ficha rápida de un compañero — la que se ve al hacer click/click derecho
 * sobre su foto o su nombre en Mensajería (ver UserProfileCard). Es de solo
 * lectura y usa columnas de User que ya existen (no hay migración de por
 * medio), a diferencia de ProfileViewData que es para el propio usuario. */
export interface UserQuickProfileVM {
  id: string;
  name: string;
  roleName: string;
  jobTitle: string | null;
  department: string | null;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  coverPhotoUrl: string | null;
  city: string | null;
  status: "ONLINE" | "OFFLINE";
  supervisorName: string | null;
  /** Fecha de nacimiento formateada corta ("14 de marzo") — igual que
   * ProfileViewData.contactFields, sin el año. */
  birthdayLabel: string | null;
  notificationLanguage: string | null;
  workFormat: string | null;
  /** Igual forma que ProfileViewData.recognitionCounts, pero `type` como
   * string plano (no RecognitionType) para no acoplar este archivo, que es
   * client-safe, a @prisma/client — UserProfileCard lo castea al mostrarlo. */
  recognitionCounts: { type: string; count: number }[];
}

export interface DashboardSummary {
  newLeads: number;
  pendingLeads: number;
  contactedLeads: number;
  convertedLeads: number;
  newClients: number;
  salesThisMonth: number;
  activePolicies: number;
  pendingPolicies: number;
  cancelledPolicies: number;
  commissionsPending: number;
  commissionsPaid: number;
  chargebacks: number;
  margin: number;
}

// ---------------------------------------------------------------------------
// PERFILES POR LÍNEA DE NEGOCIO — Medicare Advantage (Fase 7) / Obamacare (Fase 8)
// Los campos *Ref del schema (medicareNumberRef, medicaidNumberRef,
// householdIncomeRef, immigrationStatusRef, Dependent.ssnRef) no se exponen
// acá como texto plano a propósito — son punteros a SensitiveField (sección
// 7 del brief) y se gestionan desde el panel "Datos sensibles" existente en
// la pestaña Overview del cliente, no desde estos formularios.

export type MedicarePlanType = "HMO" | "PPO" | "D_SNP" | "C_SNP";
export type MedicarePresentationMethod = "PHONE" | "IN_PERSON" | "VIRTUAL";

export interface MedicareConditionVM {
  id?: string;
  name: string;
  isChronic: boolean;
}

export interface MedicareMedicationVM {
  id?: string;
  name: string;
  mg?: string;
  frequency?: string;
}

export interface MedicareSpecialistVM {
  id?: string;
  name: string;
  address?: string;
  phone?: string;
  nextAppointmentAt?: string;
}

export interface MedicareProfileVM {
  hasMedicaid: boolean;
  dualClassification?: string;
  qmb: boolean;
  fbde: boolean;
  slmb: boolean;
  extraHelp: boolean;

  healthRating?: number;
  weight?: number;
  height?: number;
  homeAttendant: boolean;
  homeAttendantCompany?: string;
  hasCancer: boolean;
  onDialysis: boolean;

  primaryDoctorName?: string;
  primaryDoctorAddress?: string;
  primaryDoctorPhone?: string;
  preferredPharmacy?: string;

  currentCarrierId?: string;
  currentPlanName?: string;
  currentPlanType?: MedicarePlanType;
  offeredCarrierId?: string;
  offeredPlanName?: string;
  offeredPlanType?: MedicarePlanType;
  changeReason?: string;
  electionPeriod?: string;
  presentationMethod?: MedicarePresentationMethod;

  soaSigned: boolean;
  soaDate?: string;
  soaMethod?: string;
  callRecordingUrl?: string;

  effectiveDate?: string;
  confirmationNumber?: string;

  poa: boolean;
  poaFirstName?: string;
  poaLastName?: string;
  poaAddress?: string;
  poaPhone?: string;
  poaRelationship?: string;

  currentAor: boolean;
  currentAorName?: string;
  acceptsAgentChange: boolean;
  acceptsPlanChange: boolean;
  signatureUrl?: string;

  conditions: MedicareConditionVM[];
  medications: MedicareMedicationVM[];
  specialists: MedicareSpecialistVM[];
}

export type ObamacarePlanType = "BRONZE" | "SILVER" | "GOLD";

export interface DependentVM {
  id?: string;
  firstName: string;
  lastName: string;
  dob?: string;
}

export interface ObamacareProfileVM {
  age?: number;
  householdSize?: number;
  maritalStatus?: string;
  hasSpouse: boolean;
  filesJointTaxes: boolean;
  hasEmployerCoverage: boolean;

  period?: string;
  carrierId?: string;
  planName?: string;
  planType?: ObamacarePlanType;
  monthlyPremium?: number;
  marketplaceApplicationId?: string;
  marketplaceConsent: boolean;
  consentDate?: string;
  effectiveDate?: string;

  dependents: DependentVM[];
}

// ---------------------------------------------------------------------------
// PERFIL POR LÍNEA DE NEGOCIO — Family Heritage (Fase 9)
// Los campos *Ref (bankNameRef, accountHolderRef, accountCityRef,
// routingNumberRef, accountNumberRef, CoveredMember.ssnRef) tampoco se
// exponen acá como texto plano, mismo criterio que Medicare/Obamacare — son
// datos bancarios/identificación y se gestionan desde el panel de Datos
// sensibles en Overview.

export type FamilyHeritagePlan = "ELITE_8" | "PREFERRED_4" | "STANDARD_2";
export type FamilyHeritageCoverage = "INDIVIDUAL" | "COUPLE" | "SINGLE_PARENT" | "FAMILY";

export interface CoveredMemberVM {
  id?: string;
  firstName: string;
  lastName: string;
  dob?: string;
  relationship?: string;
}

export interface FamilyHeritageProfileVM {
  planType?: FamilyHeritagePlan;
  coverageType?: FamilyHeritageCoverage;
  issueAge?: number;
  rop: boolean;
  monthlyPremium?: number;
  policyNumber?: string;
  effectiveDate?: string;
  debitDayOfMonth?: number;
  coveredMembers: CoveredMemberVM[];
}

// ---------------------------------------------------------------------------
// COMISIONES Y TARIFAS (Fase 10)

export type AmountType = "FIXED" | "PERCENTAGE";

export interface CommissionRateVM {
  id: string;
  insuranceLineId: string;
  lineName: string;
  agentId?: string;
  agentName?: string;
  agentAmountOrPct: number;
  agentAmountType: AmountType;
  managerPct?: number;
  aorAmount?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
}

export type CommissionStatus = "PENDING" | "PAID" | "CHARGEBACK";

export interface CommissionVM {
  id: string;
  policyId: string;
  policyNumber?: string;
  clientName: string;
  line: string;
  agentAmount?: number;
  managerAmount?: number;
  aorAmount?: number;
  totalAcquisitionCost?: number;
  carrierCommission?: number;
  margin?: number;
  agentPaymentDate?: string;
  carrierPaymentDate?: string;
  status: CommissionStatus;
}
