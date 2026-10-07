/**
 * Visibilidad por persona — catálogo de TODO lo que se puede mostrar u
 * ocultar a un usuario concreto, por encima de lo que dicta su rol:
 *
 *   módulo del menú → pestaña del CRM → sección → campo
 *
 * Cada elemento tiene una clave estable (ej. "module:/leads",
 * "lead.MEDICARE.compliance", "lead.MEDICARE.compliance.soaDate"). En la
 * base de datos solo se guardan las EXCEPCIONES de cada persona
 * (UserVisibilityOverride: clave → visible true/false); lo que no tiene
 * excepción hereda del rol (módulos) o queda visible (resto).
 *
 * Ocultar un elemento oculta también todo lo que cuelga de él (ocultar la
 * sección "SOA, grabación e inscripción" oculta sus campos).
 *
 * El árbol de Leads se arma solo a partir de src/lib/leads/lineSchema.ts:
 * si se agrega un campo a una línea de negocio, aparece aquí sin tocar nada.
 *
 * Sin dependencias de servidor: lo usan el servidor (validación, menú) y
 * el navegador (formularios, Configuración).
 */

import { NAV_MODULES } from "@/lib/navModules";
import { COMMON_LABELS, LINE_DEFS, type CommonValues, type LineCode } from "@/lib/leads/lineSchema";

export type VisibilityKind = "group" | "module" | "tab" | "section" | "field";

export interface VisibilityNode {
  key: string;
  label: string;
  kind: VisibilityKind;
  hint?: string;
  children?: VisibilityNode[];
}

/** Pestañas internas del CRM (CrmSubNav) — cuelgan del módulo "/leads". */
export const CRM_TABS = [
  { key: "crm:/leads", href: "/leads", label: "Leads" },
  { key: "crm:/clients", href: "/clients", label: "Clientes" },
  { key: "crm:/sales", href: "/sales", label: "Ventas" },
  { key: "crm:/policies", href: "/policies", label: "Pólizas" },
] as const;

export const moduleKey = (href: string) => `module:${href}`;
export const commonFieldKey = (field: keyof CommonValues | "sensitive" | "documents" | "notes") => `lead.common.${field}`;
export const lineSectionKey = (code: LineCode, sectionId: string) => `lead.${code}.${sectionId}`;
export const lineFieldKey = (code: LineCode, sectionId: string, fieldKey: string) => `lead.${code}.${sectionId}.${fieldKey}`;

/** Campos de Cliente Común que nunca se ocultan (identifican al lead). */
const ALWAYS_VISIBLE_COMMON: (keyof CommonValues)[] = ["firstName", "lastName"];

function buildLeadTree(): VisibilityNode[] {
  const common: VisibilityNode = {
    key: "lead.common",
    label: "Leads · Información del cliente",
    kind: "section",
    children: [
      ...(Object.keys(COMMON_LABELS) as (keyof CommonValues)[])
        .filter((k) => !ALWAYS_VISIBLE_COMMON.includes(k))
        .map((k) => ({ key: commonFieldKey(k), label: COMMON_LABELS[k], kind: "field" as const })),
      {
        key: commonFieldKey("sensitive"),
        label: "Información restringida (Social Security, clave de seguridad)",
        kind: "field",
      },
      { key: commonFieldKey("documents"), label: "Documentos adjuntos", kind: "field" },
      { key: commonFieldKey("notes"), label: "Notas", kind: "field" },
    ],
  };

  const lines: VisibilityNode[] = (Object.keys(LINE_DEFS) as LineCode[]).map((code) => {
    const def = LINE_DEFS[code];
    return {
      key: `lead.${code}`,
      label: `Leads · ${def.label}`,
      kind: "section",
      children: def.sections.map((section) => ({
        key: lineSectionKey(code, section.id),
        label: section.title,
        kind: "section",
        children: section.fields.map((f) => ({
          key: lineFieldKey(code, section.id, f.key),
          label: f.label,
          kind: "field",
        })),
      })),
    };
  });

  return [common, ...lines];
}

/** Árbol completo que se muestra en Configuración → Visibilidad por usuario. */
export const VISIBILITY_TREE: VisibilityNode[] = [
  {
    key: "group:modules",
    label: "Módulos del menú",
    kind: "group",
    children: NAV_MODULES.map((m) =>
      m.key === "/leads"
        ? {
            key: moduleKey(m.key),
            label: m.label,
            kind: "module" as const,
            children: CRM_TABS.map((t) => ({ key: t.key, label: `Pestaña ${t.label}`, kind: "tab" as const })),
          }
        : { key: moduleKey(m.key), label: m.label, kind: "module" as const }
    ),
  },
  {
    key: "group:leads",
    label: "Formulario y ficha del lead",
    kind: "group",
    hint: "Lo que se oculta aquí no se muestra ni se exige al crear o editar un lead.",
    children: buildLeadTree(),
  },
];

/** Padre de cada clave (para heredar el "oculto"). */
const PARENT = new Map<string, string>();
/** Todas las claves configurables (sin los grupos). */
export const ALL_VISIBILITY_KEYS: string[] = [];
(function index(nodes: VisibilityNode[], parent: string | null) {
  for (const n of nodes) {
    if (parent && !parent.startsWith("group:")) PARENT.set(n.key, parent);
    if (n.kind !== "group") ALL_VISIBILITY_KEYS.push(n.key);
    if (n.children) index(n.children, n.key);
  }
})(VISIBILITY_TREE, null);

const KEY_SET = new Set(ALL_VISIBILITY_KEYS);
export function isVisibilityKey(key: string): boolean {
  return KEY_SET.has(key);
}

/**
 * Valor por defecto (sin excepción personal) de cada clave: los módulos los
 * define el rol; todo lo demás es visible.
 */
export function roleDefault(key: string, roleModuleKeys: Set<string>, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  if (key.startsWith("module:")) return roleModuleKeys.has(key.slice("module:".length));
  return true;
}

/**
 * Calcula las claves OCULTAS para una persona: excepción personal si existe,
 * si no el valor del rol; y todo lo que cuelga de algo oculto queda oculto.
 * El Super Admin nunca tiene nada oculto (no puede quedarse sin acceso).
 */
export function computeHiddenKeys(
  roleModuleKeys: Set<string>,
  overrides: Record<string, boolean>,
  isSuperAdmin: boolean
): string[] {
  if (isSuperAdmin) return [];
  const own = new Map<string, boolean>();
  for (const key of ALL_VISIBILITY_KEYS) {
    own.set(key, key in overrides ? overrides[key] : roleDefault(key, roleModuleKeys, false));
  }
  const hidden: string[] = [];
  for (const key of ALL_VISIBILITY_KEYS) {
    let cursor: string | undefined = key;
    let visible = true;
    while (cursor) {
      if (own.get(cursor) === false) {
        visible = false;
        break;
      }
      cursor = PARENT.get(cursor);
    }
    if (!visible) hidden.push(key);
  }
  return hidden;
}

/** Módulo + pestaña del CRM que corresponden a una ruta (para bloquear el
 * acceso directo por URL a lo que la persona no ve). */
export function keysForPath(pathname: string): string[] {
  const keys: string[] = [];
  const tab = CRM_TABS.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));
  if (tab) {
    keys.push(moduleKey("/leads"), tab.key);
    return keys;
  }
  const mod = NAV_MODULES.find((m) => pathname === m.key || pathname.startsWith(`${m.key}/`));
  if (mod) keys.push(moduleKey(mod.key));
  return keys;
}
