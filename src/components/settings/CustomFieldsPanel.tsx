"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { FieldWrapper, Input, Select } from "@/components/ui/Field";
import {
  createCustomFieldAction,
  setCustomFieldVisibilityAction,
  deleteCustomFieldAction,
  type CreateCustomFieldInput,
} from "@/app/(app)/settings/custom-fields-actions";

export interface CustomFieldRow {
  id: string;
  entityType: string;
  name: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  isVisible: boolean;
  options: string[] | null;
  insuranceLineName: string | null;
}

const ENTITY_LABEL: Record<string, string> = {
  LEAD: "Lead",
  CLIENT: "Cliente",
  POLICY: "Póliza",
  SALE: "Venta",
  DEPENDENT: "Dependiente",
};

const FIELD_TYPE_LABEL: Record<string, string> = {
  TEXT: "Texto corto",
  NUMBER: "Número",
  DECIMAL: "Número decimal",
  DATE: "Fecha",
  DATETIME: "Fecha y hora",
  BOOLEAN: "Sí / No",
  SELECT: "Lista desplegable",
  MULTISELECT: "Selección múltiple",
  EMAIL: "Correo electrónico",
  PHONE: "Teléfono",
  URL: "Enlace (URL)",
  TEXTAREA: "Texto largo",
  FILE: "Archivo",
};

// Entidades cuyo formulario YA muestra campos personalizados en pantalla hoy
// (ver src/app/(app)/leads/LeadsView.tsx + leads/data.ts). Crear un campo
// para otra entidad se guarda igual en el catálogo, pero todavía no hay una
// pantalla que lo dibuje — se lo advertimos al usuario en vez de dejar que
// piense que "no funcionó" como con el botón que estaba roto antes.
const ENTITIES_WITH_LIVE_FORM = new Set(["LEAD"]);

const emptyForm = {
  entityType: "LEAD",
  label: "",
  fieldType: "TEXT",
  optionsText: "",
  isRequired: false,
  visibility: "always" as "always" | "line",
  insuranceLineId: "",
};

export function CustomFieldsPanel({
  initialFields,
  insuranceLines,
  canManage,
}: {
  initialFields: CustomFieldRow[];
  insuranceLines: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const needsOptions = form.fieldType === "SELECT" || form.fieldType === "MULTISELECT";

  function openCreate() {
    setForm(emptyForm);
    setFormError(null);
    setCreateOpen(true);
  }

  async function handleSubmit() {
    if (!form.label.trim()) {
      setFormError("El nombre del campo es obligatorio.");
      return;
    }
    const options = needsOptions
      ? form.optionsText.split(",").map((o) => o.trim()).filter(Boolean)
      : undefined;
    if (needsOptions && (!options || options.length === 0)) {
      setFormError("Agrega al menos una opción, separadas por coma.");
      return;
    }

    const payload: CreateCustomFieldInput = {
      entityType: form.entityType as CreateCustomFieldInput["entityType"],
      label: form.label.trim(),
      fieldType: form.fieldType as CreateCustomFieldInput["fieldType"],
      options,
      isRequired: form.isRequired,
      insuranceLineId:
        form.entityType === "LEAD" && form.visibility === "line" ? form.insuranceLineId || null : null,
    };

    setSaving(true);
    setFormError(null);
    const result = await createCustomFieldAction(payload);
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error ?? "No se pudo crear el campo.");
      return;
    }
    setCreateOpen(false);
    router.refresh();
  }

  async function handleToggleVisibility(field: CustomFieldRow) {
    setBusyId(field.id);
    setListError(null);
    const result = await setCustomFieldVisibilityAction(field.id, !field.isVisible);
    setBusyId(null);
    if (!result.ok) {
      setListError(result.error ?? "No se pudo actualizar el campo.");
      return;
    }
    router.refresh();
  }

  async function handleDelete(field: CustomFieldRow) {
    if (!window.confirm(`¿Eliminar el campo "${field.label}"? Esta acción no se puede deshacer.`)) return;
    setBusyId(field.id);
    setListError(null);
    const result = await deleteCustomFieldAction(field.id);
    setBusyId(null);
    if (!result.ok) {
      setListError(result.error ?? "No se pudo eliminar el campo.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--ink-muted)]">
          {initialFields.length} campo{initialFields.length === 1 ? "" : "s"} — se usan en los formularios de
          Lead, Cliente, Póliza y Venta según el producto que se esté vendiendo.
        </p>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nuevo campo
          </Button>
        )}
      </div>

      {listError && (
        <p className="mb-3 rounded-lg border border-red-200 bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
          {listError}
        </p>
      )}

      <Table>
        <THead>
          <Tr>
            <Th>Entidad</Th>
            <Th>Campo</Th>
            <Th>Tipo</Th>
            <Th>Se ve en</Th>
            <Th>Estado</Th>
            {canManage && <Th></Th>}
          </Tr>
        </THead>
        <TBody>
          {initialFields.map((f) => (
            <Tr key={f.id}>
              <Td>
                <Badge status="info">{ENTITY_LABEL[f.entityType] ?? f.entityType}</Badge>
              </Td>
              <Td>
                <p className="font-medium">{f.label}</p>
                <p className="text-xs text-[var(--ink-muted)]">{f.name}</p>
              </Td>
              <Td>{FIELD_TYPE_LABEL[f.fieldType] ?? f.fieldType}</Td>
              <Td>
                {ENTITIES_WITH_LIVE_FORM.has(f.entityType) ? (
                  f.insuranceLineName ?? "Siempre disponible"
                ) : (
                  <span className="text-[var(--ink-muted)]">Aún sin pantalla</span>
                )}
              </Td>
              <Td>
                <Badge status={f.isVisible ? "good" : "neutral"}>{f.isVisible ? "Activo" : "Inactivo"}</Badge>
              </Td>
              {canManage && (
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      title={f.isVisible ? "Desactivar" : "Activar"}
                      disabled={busyId === f.id}
                      onClick={() => handleToggleVisibility(f)}
                      className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Eliminar"
                      disabled={busyId === f.id}
                      onClick={() => handleDelete(f)}
                      className="rounded-md p-1.5 text-[var(--ink-secondary)] hover:bg-[var(--status-critical-bg)] hover:text-[var(--status-critical)] disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              )}
            </Tr>
          ))}
          {initialFields.length === 0 && (
            <Tr>
              <Td colSpan={canManage ? 6 : 5}>
                <p className="py-6 text-center text-sm text-[var(--ink-muted)]">
                  Todavía no hay campos personalizados — crea el primero con &quot;Nuevo campo&quot;.
                </p>
              </Td>
            </Tr>
          )}
        </TBody>
      </Table>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo campo personalizado"
        description="Queda disponible de inmediato en el formulario correspondiente — sin tocar código."
      >
        <div className="space-y-4">
          {formError && (
            <p className="rounded-lg border border-red-200 bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
              {formError}
            </p>
          )}

          <FieldWrapper label="Entidad">
            <Select
              value={form.entityType}
              onChange={(e) => setForm({ ...form, entityType: e.target.value, visibility: "always", insuranceLineId: "" })}
            >
              {Object.entries(ENTITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FieldWrapper>

          {!ENTITIES_WITH_LIVE_FORM.has(form.entityType) && (
            <p className="rounded-lg border border-[var(--status-warning-bg)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning)]">
              El formulario de {ENTITY_LABEL[form.entityType]} todavía no dibuja campos personalizados en
              pantalla (solo Lead lo hace hoy) — este campo queda guardado en el catálogo, listo para cuando se
              conecte esa pantalla.
            </p>
          )}

          <FieldWrapper label="Nombre del campo">
            <Input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder='Ej. "¿Tiene cobertura dental?"'
            />
          </FieldWrapper>

          <FieldWrapper label="Tipo de campo">
            <Select value={form.fieldType} onChange={(e) => setForm({ ...form, fieldType: e.target.value })}>
              {Object.entries(FIELD_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FieldWrapper>

          {needsOptions && (
            <FieldWrapper label="Opciones (separadas por coma)">
              <Input
                value={form.optionsText}
                onChange={(e) => setForm({ ...form, optionsText: e.target.value })}
                placeholder="Ej. Sí, No, Pendiente"
              />
            </FieldWrapper>
          )}

          {form.entityType === "LEAD" && (
            <FieldWrapper label="¿Dónde se debe ver este campo?">
              <Select
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value as "always" | "line" })}
              >
                <option value="always">Siempre disponible (catálogo &quot;+ Agregar campo&quot;)</option>
                <option value="line">Solo para una línea de negocio específica</option>
              </Select>
            </FieldWrapper>
          )}

          {form.entityType === "LEAD" && form.visibility === "line" && (
            <FieldWrapper label="Línea de negocio">
              <Select
                value={form.insuranceLineId}
                onChange={(e) => setForm({ ...form, insuranceLineId: e.target.value })}
              >
                <option value="">Selecciona...</option>
                {insuranceLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name}
                  </option>
                ))}
              </Select>
            </FieldWrapper>
          )}

          <label className="flex items-center gap-2 text-sm text-[var(--ink-secondary)]">
            <input
              type="checkbox"
              checked={form.isRequired}
              onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
              className="h-4 w-4 rounded border-[var(--border-hairline)]"
            />
            Obligatorio al completar el formulario
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              {saving ? "Creando..." : "Crear campo"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
