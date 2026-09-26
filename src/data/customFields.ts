// Catálogo de campos personalizados — demuestra el módulo "Campos
// personalizados" (sección 17 del brief) aplicado al formulario de Leads:
// 1) campos específicos que cambian según el producto/línea de negocio
//    de interés, y 2) un catálogo de campos opcionales que el usuario puede
//    agregar a mano, igual que "+ Agregar campo" en Bitrix24.
// En Fase 3+ este catálogo se reemplaza por lo que el administrador defina
// desde Configuración → Campos personalizados (tabla CustomField).

export type FieldType = "text" | "number" | "select" | "boolean" | "textarea";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  placeholder?: string;
}

/** Campos que aparecen automáticamente según el producto/línea seleccionada. */
export const productFieldsByLine: Record<string, FieldDef[]> = {
  "Medicare Advantage": [
    { key: "medicareNumber", label: "Número de Medicare", type: "text" },
    { key: "hasMedicaid", label: "¿Tiene Medicaid?", type: "boolean" },
    { key: "currentCarrier", label: "Carrier actual", type: "text" },
    {
      key: "currentPlanType",
      label: "Tipo de plan actual",
      type: "select",
      options: ["HMO", "PPO", "D-SNP", "C-SNP"],
    },
  ],
  Obamacare: [
    { key: "householdIncome", label: "Ingresos del hogar (anual)", type: "number" },
    { key: "householdSize", label: "Personas en el hogar", type: "number" },
    { key: "hasEmployerCoverage", label: "¿Cobertura por empleador?", type: "boolean" },
    {
      key: "planTypeInterest",
      label: "Tipo de plan de interés",
      type: "select",
      options: ["Bronce", "Plata", "Oro"],
    },
  ],
  "Family Heritage": [
    {
      key: "planType",
      label: "Tipo de plan",
      type: "select",
      options: ["Elite 8", "Preferred 4", "Standard 2"],
    },
    {
      key: "coverageType",
      label: "Tipo de cobertura",
      type: "select",
      options: ["Individual", "Couple", "Single-Parent", "Family"],
    },
    { key: "rop", label: "¿Interesado en ROP?", type: "boolean" },
  ],
};

/** Catálogo de campos opcionales — el usuario los agrega manualmente con
 * "+ Agregar campo" cuando el caso lo amerita, sin que estén siempre visibles. */
export const extraFieldsCatalog: FieldDef[] = [
  { key: "preferredLanguageAlt", label: "Idioma alterno", type: "text" },
  { key: "referredBy", label: "Referido por", type: "text" },
  { key: "bestTimeToCall", label: "Mejor horario para llamar", type: "text" },
  { key: "spouseName", label: "Nombre del cónyuge", type: "text" },
  { key: "hasDentalInterest", label: "¿Interesado en dental?", type: "boolean" },
  { key: "hasVisionInterest", label: "¿Interesado en visión?", type: "boolean" },
  { key: "zipCode", label: "Código postal", type: "text" },
  { key: "county", label: "Condado", type: "text" },
  { key: "additionalNotes", label: "Comentario adicional", type: "textarea" },
];
