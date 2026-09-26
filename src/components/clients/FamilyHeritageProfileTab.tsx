"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, Input, Select } from "@/components/ui/Field";
import { Info } from "@/components/clients/Info";
import { Plus, Trash2, ShieldAlert } from "lucide-react";
import {
  saveFamilyHeritageProfileAction,
  type SaveFamilyHeritageProfileInput,
} from "@/app/(app)/clients/[id]/family-heritage/actions";
import type { FamilyHeritageProfileVM } from "@/types";

function emptyProfile(): SaveFamilyHeritageProfileInput {
  return { rop: false, coveredMembers: [] };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold uppercase text-[var(--ink-muted)]">{children}</h4>;
}

const PLAN_LABELS: Record<string, string> = { ELITE_8: "Elite 8", PREFERRED_4: "Preferred 4", STANDARD_2: "Standard 2" };
const COVERAGE_LABELS: Record<string, string> = {
  INDIVIDUAL: "Individual",
  COUPLE: "Pareja",
  SINGLE_PARENT: "Madre/padre soltero",
  FAMILY: "Familiar",
};

export function FamilyHeritageProfileTab({
  clientId,
  initialProfile,
  canEdit,
}: {
  clientId: string;
  initialProfile: FamilyHeritageProfileVM | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(!initialProfile);
  const [form, setForm] = useState<SaveFamilyHeritageProfileInput>(() => ({
    ...emptyProfile(),
    ...(initialProfile ?? {}),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof SaveFamilyHeritageProfileInput>(key: K, value: SaveFamilyHeritageProfileInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await saveFamilyHeritageProfileAction(clientId, form);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "No se pudo guardar el perfil de Family Heritage.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    const p = initialProfile;
    if (!p) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-[var(--ink-muted)]">Este cliente todavía no tiene un perfil de Family Heritage.</p>
          {canEdit && (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Plus className="h-4 w-4" /> Crear perfil
            </Button>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-5">
        {canEdit && (
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Editar perfil
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <SectionTitle>Plan</SectionTitle>
            <Info label="Tipo de plan" value={p.planType ? PLAN_LABELS[p.planType] : undefined} />
            <Info label="Tipo de cobertura" value={p.coverageType ? COVERAGE_LABELS[p.coverageType] : undefined} />
            <Info label="Edad de emisión" value={p.issueAge != null ? String(p.issueAge) : undefined} />
            <Info label="¿Interesado en ROP?" value={p.rop ? "Sí" : "No"} />
            <Info label="Prima mensual" value={p.monthlyPremium != null ? `$${p.monthlyPremium.toFixed(2)}` : undefined} />
          </div>
          <div className="space-y-3">
            <SectionTitle>Póliza</SectionTitle>
            <Info label="Número de póliza" value={p.policyNumber} />
            <Info label="Fecha efectiva" value={p.effectiveDate} />
            <Info label="Día de débito" value={p.debitDayOfMonth != null ? String(p.debitDayOfMonth) : undefined} />
          </div>
        </div>
        {p.coveredMembers.length > 0 && (
          <div className="border-t border-[var(--border-grid)] pt-4">
            <SectionTitle>Miembros cubiertos</SectionTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.coveredMembers.map((m, i) => (
                <span key={i} className="rounded-full border border-[var(--border-hairline)] px-3 py-1 text-xs">
                  {m.firstName} {m.lastName}
                  {m.relationship ? ` · ${m.relationship}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="flex items-center gap-2 border-t border-[var(--border-grid)] pt-4 text-xs text-[var(--ink-muted)]">
          <ShieldAlert className="h-3.5 w-3.5" /> Los datos bancarios de domiciliación y el SSN de cada miembro
          cubierto se gestionan desde el panel de Datos sensibles, en la pestaña Overview.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-[var(--status-critical)]">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <SectionTitle>Plan</SectionTitle>
          <FieldWrapper label="Tipo de plan">
            <Select value={form.planType ?? ""} onChange={(e) => set("planType", (e.target.value || undefined) as SaveFamilyHeritageProfileInput["planType"])}>
              <option value="">Sin especificar</option>
              <option value="ELITE_8">Elite 8</option>
              <option value="PREFERRED_4">Preferred 4</option>
              <option value="STANDARD_2">Standard 2</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Tipo de cobertura">
            <Select value={form.coverageType ?? ""} onChange={(e) => set("coverageType", (e.target.value || undefined) as SaveFamilyHeritageProfileInput["coverageType"])}>
              <option value="">Sin especificar</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="COUPLE">Pareja</option>
              <option value="SINGLE_PARENT">Madre/padre soltero</option>
              <option value="FAMILY">Familiar</option>
            </Select>
          </FieldWrapper>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Edad de emisión">
              <Input
                type="number"
                value={form.issueAge ?? ""}
                onChange={(e) => set("issueAge", e.target.value ? Number(e.target.value) : undefined)}
              />
            </FieldWrapper>
            <FieldWrapper label="Prima mensual">
              <Input
                type="number"
                value={form.monthlyPremium ?? ""}
                onChange={(e) => set("monthlyPremium", e.target.value ? Number(e.target.value) : undefined)}
              />
            </FieldWrapper>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--ink-secondary)]">
            <input
              type="checkbox"
              checked={form.rop}
              onChange={(e) => set("rop", e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-hairline)]"
            />
            ¿Interesado en ROP (Return of Premium)?
          </label>
        </div>

        <div className="space-y-3">
          <SectionTitle>Póliza</SectionTitle>
          <FieldWrapper label="Número de póliza">
            <Input value={form.policyNumber ?? ""} onChange={(e) => set("policyNumber", e.target.value)} />
          </FieldWrapper>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Fecha efectiva">
              <Input type="date" value={form.effectiveDate ?? ""} onChange={(e) => set("effectiveDate", e.target.value || undefined)} />
            </FieldWrapper>
            <FieldWrapper label="Día de débito (1-31)">
              <Input
                type="number"
                min={1}
                max={31}
                value={form.debitDayOfMonth ?? ""}
                onChange={(e) => set("debitDayOfMonth", e.target.value ? Number(e.target.value) : undefined)}
              />
            </FieldWrapper>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border-grid)] pt-4">
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>Miembros cubiertos</SectionTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => set("coveredMembers", [...form.coveredMembers, { firstName: "", lastName: "" }])}
          >
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </div>
        <div className="space-y-2">
          {form.coveredMembers.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="flex-1"
                placeholder="Nombre"
                value={m.firstName}
                onChange={(e) =>
                  set("coveredMembers", form.coveredMembers.map((row, j) => (j === i ? { ...row, firstName: e.target.value } : row)))
                }
              />
              <Input
                className="flex-1"
                placeholder="Apellido"
                value={m.lastName}
                onChange={(e) =>
                  set("coveredMembers", form.coveredMembers.map((row, j) => (j === i ? { ...row, lastName: e.target.value } : row)))
                }
              />
              <Input
                className="w-36"
                placeholder="Relación"
                value={m.relationship ?? ""}
                onChange={(e) =>
                  set("coveredMembers", form.coveredMembers.map((row, j) => (j === i ? { ...row, relationship: e.target.value } : row)))
                }
              />
              <Input
                className="w-40"
                type="date"
                value={m.dob ?? ""}
                onChange={(e) =>
                  set("coveredMembers", form.coveredMembers.map((row, j) => (j === i ? { ...row, dob: e.target.value || undefined } : row)))
                }
              />
              <button
                type="button"
                onClick={() => set("coveredMembers", form.coveredMembers.filter((_, j) => j !== i))}
                className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--status-critical)]"
                aria-label="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {form.coveredMembers.length === 0 && <p className="text-xs text-[var(--ink-muted)]">Sin miembros todavía.</p>}
        </div>
        <p className="mt-2 flex items-center gap-2 text-xs text-[var(--ink-muted)]">
          <ShieldAlert className="h-3.5 w-3.5" /> El SSN de cada miembro cubierto se gestiona desde el panel de
          Datos sensibles, en la pestaña Overview.
        </p>
      </div>

      <div className="flex justify-end gap-2 border-t border-[var(--border-grid)] pt-4">
        {initialProfile && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={saving}>
            Cancelar
          </Button>
        )}
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar perfil"}
        </Button>
      </div>
    </div>
  );
}
