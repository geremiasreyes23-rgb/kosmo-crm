/**
 * Contrato de campos del módulo Leads: CLIENTE COMÚN + LÍNEA DE NEGOCIO.
 *
 *   Lead = Cliente Común (siempre visible, columnas de Lead)
 *        + campos de UNA línea de negocio (Lead.lineDetails, JSON)
 *
 * Este archivo es la única fuente de verdad para:
 *  - qué campos existen en cada línea (Medicare Advantage, Obamacare,
 *    Family Heritage) y en qué sección aparecen,
 *  - qué campos dependen de otra respuesta (visibleIf),
 *  - qué es obligatorio y cómo se valida.
 *
 * Lo importan tanto el formulario (cliente) como las Server Actions
 * (servidor): la validación corre con exactamente las mismas reglas en ambos
 * lados, y el servidor descarta cualquier clave que no pertenezca a la línea
 * activa — así es imposible mezclar campos de líneas distintas.
 *
 * Los datos restringidos (kind "sensitive") NUNCA se guardan en lineDetails:
 * viajan aparte y se cifran en SensitiveField (ver src/lib/sensitiveData.ts).
 *
 * Sin dependencias de servidor ni de React — debe poder importarse desde
 * ambos lados.
 */

// ───────────────────────────── Tipos ─────────────────────────────

export type LineCode = "MEDICARE" | "OBAMACARE" | "FAMILY_HERITAGE";

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "date"
  | "phone"
  | "email"
  | "select"
  | "yesno"
  | "multicheck"
  | "rating"
  | "carrier"
  | "signature"
  | "list"
  | "sensitive"
  /** Edad calculada a partir de una fecha de nacimiento (solo lectura). */
  | "computed-age"
  /** Alerta Turning 65 calculada desde la fecha de nacimiento del cliente. */
  | "turning65";

export interface Option {
  value: string;
  label: string;
}

/** Valores de un elemento de una lista repetible (dependiente, medicamento...). */
export interface ListItem {
  _id: string;
  [key: string]: string;
}

export type FieldValue = string | string[] | ListItem[] | boolean;
export type LineValues = Record<string, FieldValue>;

/** Contexto de solo lectura que algunos campos calculados necesitan. */
export interface LineContext {
  /** Fecha de nacimiento del cliente (YYYY-MM-DD) — de Cliente Común. */
  dob?: string;
}

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  options?: Option[];
  /** Por defecto todo campo visible es obligatorio. */
  optional?: boolean;
  /** Si devuelve false, el campo no se muestra, no se valida y su valor se
   * descarta al guardar. */
  visibleIf?: (values: LineValues) => boolean;
  placeholder?: string;
  hint?: string;
  /** Ocupa el ancho completo de la grilla de 2 columnas. */
  full?: boolean;
  min?: number;
  max?: number;
  /** kind "multicheck": opción que excluye a las demás (ej. "Ninguna"). */
  exclusiveOption?: string;
  /** kind "sensitive": formato esperado. */
  format?: "ssn" | "routing" | "account" | "day" | "free";
  /** kind "computed-age": clave de la fecha dentro del mismo elemento de lista. */
  fromKey?: string;
  // ── listas ──
  itemFields?: FieldDef[];
  itemLabel?: string;
  addLabel?: string;
  /** Texto del check "no aplica" — si se marca, la lista puede ir vacía. */
  noneLabel?: string;
}

export interface SectionDef {
  id: string;
  title: string;
  description?: string;
  restricted?: boolean;
  fields: FieldDef[];
}

export interface LineDef {
  code: LineCode;
  label: string;
  shortLabel: string;
  sections: SectionDef[];
}

// ───────────────────────────── Opciones ─────────────────────────────

export const YES_NO: Option[] = [
  { value: "yes", label: "Sí" },
  { value: "no", label: "No" },
];

const MEDICARE_PLAN_TYPES: Option[] = [
  { value: "HMO", label: "HMO" },
  { value: "PPO", label: "PPO" },
  { value: "D_SNP", label: "D-SNP" },
  { value: "C_SNP", label: "C-SNP" },
];

const PRESENTATION_METHODS: Option[] = [
  { value: "PHONE", label: "Telefónica" },
  { value: "IN_PERSON", label: "Presencial" },
  { value: "VIRTUAL", label: "Virtual" },
];

const isYes = (key: string) => (v: LineValues) => v[key] === "yes";

export const US_STATES: Option[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["PR", "Puerto Rico"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"],
  ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([value, label]) => ({ value, label }));

export const LANGUAGES: Option[] = [
  { value: "Español", label: "Español" },
  { value: "Inglés", label: "Inglés" },
  { value: "Portugués", label: "Portugués" },
  { value: "Creole", label: "Creole" },
  { value: "Otro", label: "Otro" },
];

// ───────────────────────────── Cliente Común ─────────────────────────────

/** Campos de Cliente Común — columnas de Lead (más dos datos restringidos
 * cifrados). Siempre visibles, independientes de la línea de negocio. */
export interface CommonValues {
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
  zipCode: string;
  county: string;
  state: string;
  preferredLanguage: string;
  sourceId: string;
  agentId: string;
  aorId: string;
}

export const EMPTY_COMMON: CommonValues = {
  firstName: "",
  lastName: "",
  dob: "",
  phone: "",
  email: "",
  address: "",
  zipCode: "",
  county: "",
  state: "",
  preferredLanguage: "",
  sourceId: "",
  agentId: "",
  aorId: "",
};

/** Obligatorios de Cliente Común. Correo, AOR, SSN, clave de seguridad,
 * documentos y notas son opcionales. */
export const COMMON_REQUIRED: (keyof CommonValues)[] = [
  "firstName",
  "lastName",
  "dob",
  "phone",
  "address",
  "zipCode",
  "county",
  "state",
  "preferredLanguage",
  "sourceId",
  "agentId",
];

export const COMMON_LABELS: Record<keyof CommonValues, string> = {
  firstName: "Nombre",
  lastName: "Apellido",
  dob: "Fecha de nacimiento",
  phone: "Teléfono",
  email: "Correo electrónico",
  address: "Dirección",
  zipCode: "Código postal",
  county: "Condado",
  state: "Estado",
  preferredLanguage: "Idioma preferido",
  sourceId: "Origen del lead",
  agentId: "Vendedor",
  aorId: "AOR",
};

/** Datos restringidos de Cliente Común (cifrados en SensitiveField). */
export const COMMON_SENSITIVE: { key: string; label: string; format: FieldDef["format"]; optional: boolean }[] = [
  { key: "ssn", label: "Social Security", format: "ssn", optional: true },
  { key: "alliance_security_key", label: "Clave de seguridad Alliance Insurance", format: "free", optional: true },
];

// ───────────────────────────── Medicare Advantage ─────────────────────────────

const MEDICARE: LineDef = {
  code: "MEDICARE",
  label: "Medicare Advantage",
  shortLabel: "Medicare",
  sections: [
    {
      id: "coverage",
      title: "Medicare y Medicaid",
      fields: [
        { key: "medicareNumber", label: "Número de Medicare", kind: "text", placeholder: "1EG4-TE5-MK73" },
        { key: "hasMedicaid", label: "Medicaid", kind: "yesno" },
        { key: "medicaidNumber", label: "Número de Medicaid", kind: "text", visibleIf: isYes("hasMedicaid") },
        {
          key: "dualClassification",
          label: "Clasificación dual",
          kind: "multicheck",
          full: true,
          options: [
            { value: "QMB", label: "QMB" },
            { value: "FBDE", label: "FBDE" },
            { value: "SLMB", label: "SLMB" },
            { value: "EXTRA_HELP", label: "Extra Help" },
            { value: "NONE", label: "Ninguna" },
          ],
          exclusiveOption: "NONE",
        },
      ],
    },
    {
      id: "health",
      title: "Salud",
      fields: [
        {
          key: "conditions",
          label: "Enfermedades",
          kind: "list",
          full: true,
          itemLabel: "Enfermedad",
          addLabel: "Agregar enfermedad",
          noneLabel: "No reporta enfermedades",
          itemFields: [
            { key: "name", label: "Nombre", kind: "text" },
            { key: "chronic", label: "Crónica", kind: "yesno" },
          ],
        },
        {
          key: "medications",
          label: "Medicamentos",
          kind: "list",
          full: true,
          itemLabel: "Medicamento",
          addLabel: "Agregar medicamento",
          noneLabel: "No toma medicamentos",
          itemFields: [
            { key: "name", label: "Nombre", kind: "text" },
            { key: "mg", label: "MG", kind: "text", placeholder: "500 mg" },
            { key: "frequency", label: "Frecuencia", kind: "text", placeholder: "2 veces al día" },
          ],
        },
        { key: "healthRating", label: "Calificación de salud (1 a 10)", kind: "rating", min: 1, max: 10, full: true },
        { key: "weight", label: "Peso (lb)", kind: "number", min: 1, max: 1500 },
        { key: "height", label: "Altura", kind: "text", placeholder: "5' 7\"" },
        { key: "homeAttendant", label: "Home attendant", kind: "yesno" },
        { key: "homeAttendantCompany", label: "Compañía del home attendant", kind: "text", visibleIf: isYes("homeAttendant") },
        { key: "hasCancer", label: "Cáncer", kind: "yesno" },
        { key: "onDialysis", label: "Diálisis", kind: "yesno" },
      ],
    },
    {
      id: "providers",
      title: "Doctores, citas y farmacia",
      fields: [
        { key: "primaryDoctorName", label: "Doctor primario: nombre", kind: "text" },
        { key: "primaryDoctorPhone", label: "Doctor primario: teléfono", kind: "phone" },
        { key: "primaryDoctorAddress", label: "Doctor primario: dirección", kind: "text", full: true },
        {
          key: "specialists",
          label: "Especialista(s)",
          kind: "list",
          full: true,
          itemLabel: "Especialista",
          addLabel: "Agregar especialista",
          noneLabel: "No tiene especialistas",
          itemFields: [
            { key: "name", label: "Nombre", kind: "text" },
            { key: "phone", label: "Teléfono", kind: "phone" },
            { key: "address", label: "Dirección", kind: "text", full: true },
          ],
        },
        {
          key: "appointments",
          label: "Futuras citas",
          kind: "list",
          full: true,
          itemLabel: "Cita",
          addLabel: "Agregar cita",
          noneLabel: "Sin citas programadas",
          itemFields: [
            { key: "date", label: "Fecha", kind: "date" },
            { key: "description", label: "Doctor / motivo", kind: "text" },
          ],
        },
        { key: "preferredPharmacy", label: "Farmacia preferida", kind: "text", full: true },
      ],
    },
    {
      id: "plan",
      title: "Plan",
      fields: [
        { key: "carrierId", label: "Carrier", kind: "carrier", full: true },
        { key: "currentPlanName", label: "Plan actual: nombre", kind: "text" },
        { key: "currentPlanType", label: "Plan actual: tipo", kind: "select", options: MEDICARE_PLAN_TYPES },
        { key: "offeredPlanName", label: "Plan ofrecido: nombre", kind: "text" },
        { key: "offeredPlanType", label: "Plan ofrecido: tipo", kind: "select", options: MEDICARE_PLAN_TYPES },
        { key: "changeReason", label: "Razón del cambio", kind: "textarea", full: true },
        {
          key: "electionPeriod",
          label: "Período de elección",
          kind: "select",
          options: [
            { value: "AEP", label: "AEP (Annual Enrollment)" },
            { value: "OEP", label: "MA-OEP (Open Enrollment)" },
            { value: "IEP", label: "IEP (Initial Enrollment)" },
            { value: "ICEP", label: "ICEP" },
            { value: "SEP", label: "SEP (Special Enrollment)" },
          ],
        },
        { key: "presentationMethod", label: "Método de presentación", kind: "select", options: PRESENTATION_METHODS },
      ],
    },
    {
      id: "compliance",
      title: "SOA, grabación e inscripción",
      fields: [
        { key: "soaDate", label: "SOA: fecha", kind: "date" },
        { key: "soaMethod", label: "SOA: método", kind: "select", options: PRESENTATION_METHODS },
        { key: "callRecording", label: "Grabación de llamada (enlace / ID)", kind: "text", full: true },
        { key: "effectiveDate", label: "Fecha efectiva", kind: "date" },
        { key: "confirmationNumber", label: "Número de confirmación", kind: "text" },
      ],
    },
    {
      id: "poa",
      title: "POA (poder legal)",
      fields: [
        { key: "hasPoa", label: "¿Tiene POA?", kind: "yesno", full: true },
        { key: "poaFullName", label: "Nombre y apellido", kind: "text", visibleIf: isYes("hasPoa") },
        { key: "poaRelationship", label: "Parentesco", kind: "text", visibleIf: isYes("hasPoa") },
        { key: "poaPhone", label: "Teléfono", kind: "phone", visibleIf: isYes("hasPoa") },
        { key: "poaAddress", label: "Dirección", kind: "text", visibleIf: isYes("hasPoa") },
      ],
    },
    {
      id: "authorization",
      title: "Agente, autorización y firma",
      fields: [
        { key: "hasCurrentAor", label: "Agente de récord actual", kind: "yesno" },
        { key: "currentAorName", label: "Nombre del agente actual", kind: "text", optional: true, visibleIf: isYes("hasCurrentAor") },
        { key: "acceptsChange", label: "Acepta cambio de agente y plan", kind: "yesno", full: true },
        { key: "signature", label: "Firma", kind: "signature", full: true },
        { key: "turning65", label: "Alerta Turning 65", kind: "turning65", full: true },
      ],
    },
  ],
};

// ───────────────────────────── Obamacare ─────────────────────────────

const PERSON_ITEM_FIELDS = (extra: FieldDef[] = []): FieldDef[] => [
  { key: "firstName", label: "Nombre", kind: "text" },
  { key: "lastName", label: "Apellido", kind: "text" },
  { key: "dob", label: "Fecha de nacimiento", kind: "date" },
  { key: "age", label: "Edad", kind: "computed-age", fromKey: "dob" },
  ...extra,
  { key: "ssn", label: "Social Security", kind: "sensitive", format: "ssn" },
];

const OBAMACARE: LineDef = {
  code: "OBAMACARE",
  label: "Obamacare",
  shortLabel: "Obamacare",
  sections: [
    {
      id: "household",
      title: "Hogar y elegibilidad",
      fields: [
        { key: "age", label: "Edad", kind: "computed-age", hint: "Se calcula con la fecha de nacimiento del cliente." },
        { key: "income", label: "Ingresos anuales del hogar", kind: "money", min: 0 },
        { key: "householdSize", label: "Personas en el hogar", kind: "number", min: 1, max: 30 },
        {
          key: "immigrationStatus",
          label: "Status migratorio",
          kind: "select",
          options: [
            { value: "CITIZEN", label: "Ciudadano estadounidense" },
            { value: "PERMANENT_RESIDENT", label: "Residente permanente" },
            { value: "WORK_PERMIT", label: "Permiso de trabajo / visa" },
            { value: "ASYLUM_REFUGEE", label: "Asilo / refugiado" },
            { value: "TPS_PAROLE", label: "TPS / parole" },
            { value: "OTHER", label: "Otro" },
          ],
        },
        {
          key: "maritalStatus",
          label: "Estado civil",
          kind: "select",
          options: [
            { value: "MARRIED", label: "Casado" },
            { value: "SINGLE", label: "Soltero" },
          ],
        },
        { key: "hasSpouse", label: "Cónyuge", kind: "yesno" },
        { key: "jointTaxes", label: "Declaran taxes juntos", kind: "yesno" },
        { key: "employerCoverage", label: "Cobertura por empleador", kind: "yesno" },
      ],
    },
    {
      id: "plan",
      title: "Plan y Marketplace",
      fields: [
        {
          key: "period",
          label: "Período",
          kind: "select",
          options: [
            { value: "OPEN_ENROLLMENT", label: "Open Enrollment" },
            { value: "SEP", label: "SEP" },
          ],
        },
        { key: "carrierId", label: "Carrier", kind: "carrier" },
        { key: "planName", label: "Nombre del plan", kind: "text" },
        {
          key: "planType",
          label: "Tipo de plan",
          kind: "select",
          options: [
            { value: "BRONZE", label: "Bronce" },
            { value: "SILVER", label: "Plata" },
            { value: "GOLD", label: "Oro" },
          ],
        },
        { key: "monthlyPremium", label: "Prima mensual", kind: "money", min: 0 },
        { key: "marketplaceAppId", label: "ID de aplicación Marketplace", kind: "text" },
        { key: "consentDate", label: "Consentimiento firmado Marketplace: fecha", kind: "date" },
        { key: "effectiveDate", label: "Fecha efectiva", kind: "date" },
      ],
    },
    {
      id: "dependents",
      title: "Dependientes",
      fields: [
        { key: "hasDependents", label: "Dependientes", kind: "yesno", full: true },
        {
          key: "dependents",
          label: "Dependientes",
          kind: "list",
          full: true,
          itemLabel: "Dependiente",
          addLabel: "Agregar dependiente",
          visibleIf: isYes("hasDependents"),
          itemFields: PERSON_ITEM_FIELDS(),
        },
      ],
    },
  ],
};

// ───────────────────────────── Family Heritage ─────────────────────────────

const FAMILY_HERITAGE: LineDef = {
  code: "FAMILY_HERITAGE",
  label: "Family Heritage",
  shortLabel: "Family Heritage",
  sections: [
    {
      id: "plan",
      title: "Plan y póliza",
      fields: [
        {
          key: "planType",
          label: "Tipo de plan",
          kind: "select",
          options: [
            { value: "ELITE_8", label: "Elite 8" },
            { value: "PREFERRED_4", label: "Preferred 4" },
            { value: "STANDARD_2", label: "Standard 2" },
          ],
        },
        {
          key: "coverageType",
          label: "Tipo de cobertura",
          kind: "select",
          options: [
            { value: "INDIVIDUAL", label: "Individual" },
            { value: "COUPLE", label: "Couple" },
            { value: "SINGLE_PARENT", label: "Single-Parent" },
            { value: "FAMILY", label: "Family" },
          ],
        },
        { key: "issueAge", label: "Edad al momento de emisión", kind: "number", min: 0, max: 120 },
        { key: "rop", label: "ROP", kind: "yesno" },
        { key: "monthlyPremium", label: "Prima mensual", kind: "money", min: 0 },
        { key: "policyNumber", label: "Número de póliza", kind: "text" },
        { key: "effectiveDate", label: "Fecha efectiva", kind: "date" },
      ],
    },
    {
      id: "members",
      title: "Miembros cubiertos",
      fields: [
        { key: "hasDependents", label: "Dependientes", kind: "yesno", full: true },
        {
          key: "coveredMembers",
          label: "Miembros cubiertos",
          kind: "list",
          full: true,
          itemLabel: "Miembro cubierto",
          addLabel: "Agregar miembro",
          visibleIf: isYes("hasDependents"),
          itemFields: PERSON_ITEM_FIELDS([
            {
              key: "relationship",
              label: "Parentesco",
              kind: "select",
              options: [
                { value: "SPOUSE", label: "Cónyuge" },
                { value: "CHILD", label: "Hijo/a" },
                { value: "OTHER", label: "Otro" },
              ],
            },
          ]),
        },
      ],
    },
    {
      id: "bank",
      title: "Información bancaria",
      description: "Información restringida: se guarda cifrada y solo se muestra enmascarada.",
      restricted: true,
      fields: [
        { key: "bankName", label: "Nombre del banco", kind: "sensitive", format: "free" },
        { key: "accountHolder", label: "Titular", kind: "sensitive", format: "free" },
        { key: "accountCity", label: "Ciudad donde abrió la cuenta", kind: "sensitive", format: "free" },
        { key: "routingNumber", label: "Número de ruta/tránsito", kind: "sensitive", format: "routing" },
        { key: "accountNumber", label: "Número de cuenta", kind: "sensitive", format: "account" },
        { key: "debitDay", label: "Fecha de débito mensual (día del mes)", kind: "sensitive", format: "day" },
      ],
    },
  ],
};

export const LINE_DEFS: Record<LineCode, LineDef> = { MEDICARE, OBAMACARE, FAMILY_HERITAGE };

/**
 * Campos de ENVÍO (submisión a la aseguradora) por línea: los que llena
 * quien somete la solicitud desde el panel "Envíos". Siguen siendo campos
 * normales de la línea (viven en Lead.lineDetails); esta lista solo dice
 * cuáles muestra y exige el panel. `section` = id de la sección en LINE_DEFS.
 */
export const SUBMISSION_FIELDS: Record<LineCode, { section: string; keys: string[] }[]> = {
  MEDICARE: [{ section: "compliance", keys: ["soaDate", "soaMethod", "callRecording", "effectiveDate", "confirmationNumber"] }],
  OBAMACARE: [{ section: "plan", keys: ["marketplaceAppId", "consentDate", "effectiveDate"] }],
  FAMILY_HERITAGE: [{ section: "plan", keys: ["policyNumber", "effectiveDate"] }],
};

/** FieldDef + sección de cada campo de envío de una línea. */
export function submissionFieldDefs(code: LineCode): { sectionId: string; field: FieldDef }[] {
  const out: { sectionId: string; field: FieldDef }[] = [];
  for (const group of SUBMISSION_FIELDS[code]) {
    const section = LINE_DEFS[code].sections.find((s) => s.id === group.section);
    if (!section) continue;
    for (const key of group.keys) {
      const field = section.fields.find((f) => f.key === key);
      if (field) out.push({ sectionId: section.id, field });
    }
  }
  return out;
}

export function getLineDef(code: string | null | undefined): LineDef | null {
  if (!code) return null;
  return (LINE_DEFS as Record<string, LineDef>)[code] ?? null;
}

// ───────────────────────────── Fechas y edad ─────────────────────────────

/** Parsea "YYYY-MM-DD" como fecha local (sin el corrimiento de zona horaria
 * de new Date("YYYY-MM-DD"), que la interpreta como UTC). */
export function parseYmd(ymd: string | undefined | null): { y: number; m: number; d: number } | null {
  if (!ymd) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.slice(0, 10));
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

export function todayYmd(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function ageFromDob(dob: string | undefined | null, now = new Date()): number | null {
  const b = parseYmd(dob);
  if (!b) return null;
  let age = now.getFullYear() - b.y;
  const m = now.getMonth() + 1 - b.m;
  if (m < 0 || (m === 0 && now.getDate() < b.d)) age--;
  return age < 0 ? null : age;
}

export interface Turning65Info {
  /** Fecha en que cumple 65 (YYYY-MM-DD). */
  date: string;
  /** Días hasta esa fecha (negativo si ya pasó). */
  daysUntil: number;
  status: "upcoming" | "soon" | "turned";
  message: string;
}

/** Alerta Turning 65 — 100% automática desde la fecha de nacimiento.
 * "soon" = cumple 65 en los próximos 6 meses (ventana IEP). */
export function turning65(dob: string | undefined | null, now = new Date()): Turning65Info | null {
  const b = parseYmd(dob);
  if (!b) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${b.y + 65}-${p(b.m)}-${p(b.d)}`;
  const target = Date.UTC(b.y + 65, b.m - 1, b.d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntil = Math.round((target - today) / 86_400_000);
  if (daysUntil < 0) {
    return { date, daysUntil, status: "turned", message: "Ya cumplió 65 años." };
  }
  if (daysUntil <= 183) {
    return {
      date,
      daysUntil,
      status: "soon",
      message: daysUntil === 0 ? "Cumple 65 años hoy." : `Cumple 65 años en ${daysUntil} días.`,
    };
  }
  return { date, daysUntil, status: "upcoming", message: `Cumple 65 años en ${Math.round(daysUntil / 30.4)} meses.` };
}

// ───────────────────────────── Valores ─────────────────────────────

export function newItemId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const ITEM_ID_RE = /^[a-z0-9]{4,32}$/;

export function noneKey(listKey: string): string {
  return `${listKey}__none`;
}

/** Valores iniciales vacíos para una línea. */
export function emptyLineValues(code: LineCode): LineValues {
  const values: LineValues = {};
  for (const section of LINE_DEFS[code].sections) {
    for (const f of section.fields) {
      if (f.kind === "list") values[f.key] = [];
      else if (f.kind === "multicheck") values[f.key] = [];
      else if (f.kind === "sensitive" || f.kind === "computed-age" || f.kind === "turning65") continue;
      else values[f.key] = "";
    }
  }
  return values;
}

export function isFieldVisible(f: FieldDef, values: LineValues): boolean {
  return f.visibleIf ? f.visibleIf(values) : true;
}

/** Clave con la que un dato restringido se guarda en SensitiveField. */
export function sensitiveKeyFor(code: LineCode, fieldKey: string, list?: { listKey: string; itemId: string }): string {
  return list ? `${code}.${list.listKey}.${list.itemId}.${fieldKey}` : `${code}.${fieldKey}`;
}

/** Etiqueta legible de una clave de SensitiveField de un Lead. */
export function sensitiveKeyLabel(key: string): string {
  const common = COMMON_SENSITIVE.find((c) => c.key === key);
  if (common) return common.label;
  const parts = key.split(".");
  const line = getLineDef(parts[0]);
  if (!line) return key;
  const all = line.sections.flatMap((s) => s.fields);
  if (parts.length === 2) return all.find((f) => f.key === parts[1])?.label ?? key;
  if (parts.length === 4) {
    const list = all.find((f) => f.key === parts[1]);
    const sub = list?.itemFields?.find((f) => f.key === parts[3]);
    return `${sub?.label ?? parts[3]} (${list?.itemLabel ?? parts[1]})`;
  }
  return key;
}

/**
 * Limpia los valores de una línea antes de guardarlos: conserva solo las
 * claves definidas para ESA línea, solo los campos visibles (un campo
 * dependiente oculto, ej. "Número de Medicaid" con Medicaid = No, se
 * descarta), con el tipo correcto, y nunca datos restringidos.
 */
export function sanitizeLineValues(code: LineCode, raw: unknown): LineValues {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: LineValues = {};
  const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");

  // Primero los escalares (los visibleIf dependen de ellos).
  for (const section of LINE_DEFS[code].sections) {
    for (const f of section.fields) {
      switch (f.kind) {
        case "sensitive":
        case "computed-age":
        case "turning65":
        case "list":
          break;
        case "multicheck": {
          const allowed = new Set((f.options ?? []).map((o) => o.value));
          const arr = Array.isArray(input[f.key]) ? (input[f.key] as unknown[]) : [];
          let picked = arr.filter((x): x is string => typeof x === "string" && allowed.has(x));
          if (f.exclusiveOption && picked.includes(f.exclusiveOption)) picked = [f.exclusiveOption];
          out[f.key] = Array.from(new Set(picked));
          break;
        }
        case "select":
        case "yesno": {
          const opts = f.kind === "yesno" ? YES_NO : f.options ?? [];
          const v = str(input[f.key]);
          out[f.key] = opts.some((o) => o.value === v) ? v : "";
          break;
        }
        case "signature": {
          const v = str(input[f.key], 400_000);
          out[f.key] = v.startsWith("data:image/png;base64,") ? v : "";
          break;
        }
        default:
          out[f.key] = str(input[f.key]).trim();
      }
    }
  }

  // Después las listas, con sus elementos limpios.
  for (const section of LINE_DEFS[code].sections) {
    for (const f of section.fields) {
      if (f.kind !== "list") continue;
      const items = Array.isArray(input[f.key]) ? (input[f.key] as unknown[]) : [];
      const clean: ListItem[] = [];
      for (const it of items.slice(0, 50)) {
        if (!it || typeof it !== "object") continue;
        const obj = it as Record<string, unknown>;
        const id = typeof obj._id === "string" && ITEM_ID_RE.test(obj._id) ? obj._id : newItemId();
        const item: ListItem = { _id: id };
        for (const sub of f.itemFields ?? []) {
          if (sub.kind === "sensitive" || sub.kind === "computed-age") continue;
          const v = str(obj[sub.key], 500).trim();
          if (sub.kind === "select" || sub.kind === "yesno") {
            const opts = sub.kind === "yesno" ? YES_NO : sub.options ?? [];
            item[sub.key] = opts.some((o) => o.value === v) ? v : "";
          } else {
            item[sub.key] = v;
          }
        }
        clean.push(item);
      }
      out[f.key] = clean;
      if (f.noneLabel) out[noneKey(f.key)] = input[noneKey(f.key)] === true && clean.length === 0;
    }
  }

  // Por último se descartan los campos que quedaron ocultos.
  for (const section of LINE_DEFS[code].sections) {
    for (const f of section.fields) {
      if (!isFieldVisible(f, out) && f.key in out) {
        out[f.key] = f.kind === "list" || f.kind === "multicheck" ? [] : "";
        if (f.kind === "list") delete out[noneKey(f.key)];
      }
    }
  }
  return out;
}

/** Claves restringidas que pueden existir para un lead con esta línea y
 * estos valores (incluye las de cada dependiente/miembro actual). */
export function allowedSensitiveKeys(code: LineCode | null, values: LineValues): Set<string> {
  const keys = new Set(COMMON_SENSITIVE.map((c) => c.key));
  if (!code) return keys;
  for (const section of LINE_DEFS[code].sections) {
    for (const f of section.fields) {
      if (!isFieldVisible(f, values)) continue;
      if (f.kind === "sensitive") keys.add(sensitiveKeyFor(code, f.key));
      if (f.kind === "list") {
        const items = (values[f.key] as ListItem[]) ?? [];
        for (const sub of f.itemFields ?? []) {
          if (sub.kind !== "sensitive") continue;
          for (const it of items) keys.add(sensitiveKeyFor(code, sub.key, { listKey: f.key, itemId: it._id }));
        }
      }
    }
  }
  return keys;
}

// ───────────────────────────── Validación ─────────────────────────────

/** Errores por ruta de campo: "common.firstName", "line.medicaidNumber",
 * "line.dependents.<itemId>.dob", "sensitive.<clave>", "lineId". */
export type FieldErrors = Record<string, string>;

const digits = (s: string) => s.replace(/\D/g, "");

function validateSensitiveFormat(format: FieldDef["format"], value: string): string | null {
  const d = digits(value);
  switch (format) {
    case "ssn":
      return d.length === 9 ? null : "Debe tener 9 dígitos.";
    case "routing":
      return d.length === 9 ? null : "El número de ruta debe tener 9 dígitos.";
    case "account":
      return d.length >= 4 && d.length <= 17 ? null : "Número de cuenta inválido.";
    case "day": {
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= 31 ? null : "Día del mes entre 1 y 31.";
    }
    default:
      return value.trim() ? null : "Campo obligatorio.";
  }
}

function validateScalar(f: FieldDef, raw: string, today: string): string | null {
  const v = raw.trim();
  if (!v) return f.optional ? null : "Campo obligatorio.";
  switch (f.kind) {
    case "number":
    case "money":
    case "rating": {
      const n = Number(v);
      if (!Number.isFinite(n)) return "Debe ser un número.";
      if (f.min != null && n < f.min) return `Mínimo ${f.min}.`;
      if (f.max != null && n > f.max) return `Máximo ${f.max}.`;
      if (f.kind !== "money" && f.kind !== "number" && !Number.isInteger(n)) return "Debe ser un número entero.";
      return null;
    }
    case "date":
      return parseYmd(v) ? null : "Fecha inválida.";
    case "phone":
      return digits(v).length >= 10 ? null : "Teléfono inválido (mínimo 10 dígitos).";
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Correo inválido.";
    default:
      void today;
      return null;
  }
}

export interface ValidateLeadInput {
  common: CommonValues;
  /** Código de la línea seleccionada, o null si no se eligió. */
  lineCode: LineCode | null;
  /** true si se eligió una línea (aunque sea una sin definición propia). */
  hasLine: boolean;
  values: LineValues;
  /** Datos restringidos nuevos escritos en el formulario (clave → valor). */
  sensitiveInputs: Record<string, string>;
  /** Claves restringidas que ya están guardadas (en edición). */
  sensitiveSaved: Set<string> | string[];
  /** Visibilidad por persona (src/lib/visibility.ts): lo oculto para quien
   * llena el formulario no se valida ni se exige. */
  hidden?: Set<string>;
}

export function validateLead(input: ValidateLeadInput, now = new Date()): FieldErrors {
  const errors: FieldErrors = {};
  const today = todayYmd(now);
  const saved = input.sensitiveSaved instanceof Set ? input.sensitiveSaved : new Set(input.sensitiveSaved);
  const hasSensitive = (key: string) => !!input.sensitiveInputs[key]?.trim() || saved.has(key);
  const hidden = input.hidden ?? new Set<string>();

  // ── Cliente Común ──
  const c = input.common;
  for (const key of COMMON_REQUIRED) {
    if (hidden.has(`lead.common.${key}`)) continue;
    if (!String(c[key] ?? "").trim()) errors[`common.${key}`] = "Campo obligatorio.";
  }
  if (c.dob && !errors["common.dob"]) {
    if (!parseYmd(c.dob)) errors["common.dob"] = "Fecha inválida.";
    else if (c.dob > today) errors["common.dob"] = "La fecha de nacimiento no puede ser futura.";
  }
  if (c.phone && digits(c.phone).length < 10) errors["common.phone"] = "Teléfono inválido (mínimo 10 dígitos).";
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) errors["common.email"] = "Correo inválido.";
  if (c.zipCode && !/^\d{5}(-\d{4})?$/.test(c.zipCode.trim())) errors["common.zipCode"] = "Código postal de 5 dígitos.";
  for (const s of COMMON_SENSITIVE) {
    if (hidden.has("lead.common.sensitive")) break;
    const typed = input.sensitiveInputs[s.key]?.trim();
    if (typed) {
      const err = validateSensitiveFormat(s.format, typed);
      if (err) errors[`sensitive.${s.key}`] = err;
    } else if (!s.optional && !saved.has(s.key)) {
      errors[`sensitive.${s.key}`] = "Campo obligatorio.";
    }
  }

  // ── Línea de negocio ──
  if (!input.hasLine) {
    errors.lineId = "Selecciona la línea de negocio.";
    return errors;
  }
  const code = input.lineCode;
  if (!code) return errors;
  const values = input.values;

  for (const section of LINE_DEFS[code].sections) {
    for (const f of section.fields) {
      if (!isFieldVisible(f, values)) continue;
      if (hidden.has(`lead.${code}.${section.id}.${f.key}`)) continue;
      const path = `line.${f.key}`;
      switch (f.kind) {
        case "turning65":
          if (!parseYmd(c.dob)) errors[path] = "Requiere la fecha de nacimiento del cliente.";
          break;
        case "computed-age":
          if (!parseYmd(c.dob)) errors[path] = "Requiere la fecha de nacimiento del cliente.";
          break;
        case "sensitive": {
          const key = sensitiveKeyFor(code, f.key);
          const typed = input.sensitiveInputs[key]?.trim();
          if (typed) {
            const err = validateSensitiveFormat(f.format, typed);
            if (err) errors[`sensitive.${key}`] = err;
          } else if (!f.optional && !saved.has(key)) {
            errors[`sensitive.${key}`] = "Campo obligatorio.";
          }
          break;
        }
        case "multicheck": {
          const arr = (values[f.key] as string[]) ?? [];
          if (!f.optional && arr.length === 0) errors[path] = "Selecciona al menos una opción.";
          break;
        }
        case "signature":
          if (!f.optional && !String(values[f.key] ?? "")) errors[path] = "Falta la firma.";
          break;
        case "list": {
          const items = (values[f.key] as ListItem[]) ?? [];
          const none = values[noneKey(f.key)] === true;
          if (items.length === 0 && !none && !f.optional) {
            errors[path] = f.noneLabel
              ? `Agrega al menos un registro o marca "${f.noneLabel}".`
              : `Agrega al menos un ${(f.itemLabel ?? "registro").toLowerCase()}.`;
          }
          for (const it of items) {
            for (const sub of f.itemFields ?? []) {
              const subPath = `line.${f.key}.${it._id}.${sub.key}`;
              if (sub.kind === "computed-age") continue;
              if (sub.kind === "sensitive") {
                const key = sensitiveKeyFor(code, sub.key, { listKey: f.key, itemId: it._id });
                const typed = input.sensitiveInputs[key]?.trim();
                if (typed) {
                  const err = validateSensitiveFormat(sub.format, typed);
                  if (err) errors[`sensitive.${key}`] = err;
                } else if (!sub.optional && !hasSensitive(key)) {
                  errors[`sensitive.${key}`] = "Campo obligatorio.";
                }
                continue;
              }
              const err = validateScalar(sub, String(it[sub.key] ?? ""), today);
              if (err) errors[subPath] = err;
              else if (sub.kind === "date" && sub.key === "dob" && it[sub.key] > today) {
                errors[subPath] = "La fecha de nacimiento no puede ser futura.";
              }
            }
          }
          break;
        }
        default: {
          const err = validateScalar(f, String(values[f.key] ?? ""), today);
          if (err) errors[path] = err;
        }
      }
    }
  }
  return errors;
}

/** Progreso de llenado de una sección (campos visibles completos / total). */
export function sectionProgress(
  code: LineCode,
  section: SectionDef,
  values: LineValues,
  errors: FieldErrors,
  hidden?: Set<string>
): { done: number; total: number; hasErrors: boolean } {
  let done = 0;
  let total = 0;
  let hasErrors = false;
  for (const f of section.fields) {
    if (!isFieldVisible(f, values) || f.kind === "computed-age" || f.kind === "turning65") continue;
    if (hidden?.has(`lead.${code}.${section.id}.${f.key}`)) continue;
    total++;
    const path = `line.${f.key}`;
    const ownErrors = Object.keys(errors).some(
      (k) =>
        k === path ||
        k.startsWith(`${path}.`) ||
        (f.kind === "sensitive" && k === `sensitive.${sensitiveKeyFor(code, f.key)}`) ||
        (f.kind === "list" && k.startsWith(`sensitive.${code}.${f.key}.`))
    );
    if (ownErrors) hasErrors = true;
    if (f.kind === "list") {
      const items = (values[f.key] as ListItem[]) ?? [];
      if ((items.length > 0 || values[noneKey(f.key)] === true) && !ownErrors) done++;
    } else if (f.kind === "multicheck") {
      if (((values[f.key] as string[]) ?? []).length > 0) done++;
    } else if (f.kind === "sensitive") {
      if (!ownErrors) done++;
    } else if (String(values[f.key] ?? "").trim() && !ownErrors) {
      done++;
    }
  }
  return { done, total, hasErrors };
}

/** Texto legible del valor de un campo para la vista de detalle. */
export function displayValue(f: FieldDef, value: FieldValue | undefined): string {
  if (value == null || value === "") return "";
  if (f.kind === "yesno") return value === "yes" ? "Sí" : value === "no" ? "No" : "";
  if (f.kind === "select") return f.options?.find((o) => o.value === value)?.label ?? String(value);
  if (f.kind === "multicheck" && Array.isArray(value)) {
    return (value as string[]).map((v) => f.options?.find((o) => o.value === v)?.label ?? v).join(", ");
  }
  if (f.kind === "money") {
    const n = Number(value);
    return Number.isFinite(n)
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
      : String(value);
  }
  if (f.kind === "date") {
    const p = parseYmd(String(value));
    if (!p) return String(value);
    return new Intl.DateTimeFormat("es-ES", { year: "numeric", month: "short", day: "2-digit", timeZone: "UTC" }).format(
      new Date(Date.UTC(p.y, p.m - 1, p.d))
    );
  }
  return String(value);
}

/** Estructura guardada en Lead.lineDetails. */
export interface StoredLineDetails {
  line: LineCode;
  values: LineValues;
}

export function readStoredLineDetails(json: unknown, expected: LineCode | null): LineValues | null {
  if (!expected || !json || typeof json !== "object") return null;
  const obj = json as { line?: unknown; values?: unknown };
  if (obj.line !== expected) return null; // nunca mostrar datos de otra línea
  return sanitizeLineValues(expected, obj.values);
}
