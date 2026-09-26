"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, Input, Select } from "@/components/ui/Field";
import { Info } from "@/components/clients/Info";
import { Plus, Trash2, ShieldAlert } from "lucide-react";
import { saveObamacareProfileAction, type SaveObamacareProfileInput } from "@/app/(app)/clients/[id]/obamacare/actions";
import type { ObamacareProfileVM, DependentVM } from "@/types";

function emptyProfile(): SaveObamacareProfileInput {
  return {
    hasSpouse: false,
    filesJointTaxes: false,
    hasEmployerCoverage: false,
    marketplaceConsent: false,
    dependents: [],
  };
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-[var(--ink-secondary)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[var(--border-hairline)]"
      />
      {label}
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold uppercase text-[var(--ink-muted)]">{children}</h4>;
}

const PLAN_TYPE_LABELS: Record<string, string> = { BRONZE: "Bronce", SILVER: "Plata", GOLD: "Oro" };

export function ObamacareProfileTab({
  clientId,
  initialProfile,
  carriers,
  canEdit,
}: {
  clientId: string;
  initialProfile: ObamacareProfileVM | null;
  carriers: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(!initialProfile);
  const [form, setForm] = useState<SaveObamacareProfileInput>(() => ({
    ...emptyProfile(),
    ...(initialProfile ?? {}),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof SaveObamacareProfileInput>(key: K, value: SaveObamacareProfileInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await saveObamacareProfileAction(clientId, form);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "No se pudo guardar el perfil de Obamacare.");
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
          <p className="text-sm text-[var(--ink-muted)]">Este cliente todavía no tiene un perfil de Obamacare.</p>
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
            <SectionTitle>Hogar</SectionTitle>
            <Info label="Edad" value={p.age != null ? String(p.age) : undefined} />
            <Info label="Personas en el hogar" value={p.householdSize != null ? String(p.householdSize) : undefined} />
            <Info label="Estado civil" value={p.maritalStatus} />
            <Info label="¿Tiene cónyuge?" value={p.hasSpouse ? "Sí" : "No"} />
            <Info label="¿Declara impuestos en conjunto?" value={p.filesJointTaxes ? "Sí" : "No"} />
            <Info label="¿Cobertura por empleador?" value={p.hasEmployerCoverage ? "Sí" : "No"} />
          </div>
          <div className="space-y-3">
            <SectionTitle>Plan</SectionTitle>
            <Info label="Periodo" value={p.period} />
            <Info label="Carrier" value={carriers.find((c) => c.id === p.carrierId)?.name} />
            <Info label="Plan" value={p.planName} />
            <Info label="Tipo de plan" value={p.planType ? PLAN_TYPE_LABELS[p.planType] : undefined} />
            <Info label="Prima mensual" value={p.monthlyPremium != null ? `$${p.monthlyPremium.toFixed(2)}` : undefined} />
            <Info label="ID de solicitud en el Marketplace" value={p.marketplaceApplicationId} />
            <Info label="Consentimiento del Marketplace" value={p.marketplaceConsent ? (p.consentDate ?? "Sí") : "No"} />
            <Info label="Fecha efectiva" value={p.effectiveDate} />
          </div>
        </div>
        {p.dependents.length > 0 && (
          <div className="border-t border-[var(--border-grid)] pt-4">
            <SectionTitle>Dependientes</SectionTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.dependents.map((d, i) => (
                <span key={i} className="rounded-full border border-[var(--border-hairline)] px-3 py-1 text-xs">
                  {d.firstName} {d.lastName}
                  {d.dob ? ` · ${d.dob}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="flex items-center gap-2 border-t border-[var(--border-grid)] pt-4 text-xs text-[var(--ink-muted)]">
          <ShieldAlert className="h-3.5 w-3.5" /> Los ingresos del hogar, el estatus migratorio y el SSN de cada
          dependiente se gestionan desde el panel de Datos sensibles, en la pestaña Overview.
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
          <SectionTitle>Hogar</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Edad">
              <Input
                type="number"
                value={form.age ?? ""}
                onChange={(e) => set("age", e.target.value ? Number(e.target.value) : undefined)}
              />
            </FieldWrapper>
            <FieldWrapper label="Personas en el hogar">
              <Input
                type="number"
                value={form.householdSize ?? ""}
                onChange={(e) => set("householdSize", e.target.value ? Number(e.target.value) : undefined)}
              />
            </FieldWrapper>
          </div>
          <FieldWrapper label="Estado civil">
            <Input value={form.maritalStatus ?? ""} onChange={(e) => set("maritalStatus", e.target.value)} />
          </FieldWrapper>
          <div className="flex flex-wrap gap-4">
            <Checkbox label="¿Tiene cónyuge?" checked={form.hasSpouse} onChange={(v) => set("hasSpouse", v)} />
            <Checkbox label="Declara impuestos en conjunto" checked={form.filesJointTaxes} onChange={(v) => set("filesJointTaxes", v)} />
            <Checkbox label="Cobertura por empleador" checked={form.hasEmployerCoverage} onChange={(v) => set("hasEmployerCoverage", v)} />
          </div>
        </div>

        <div className="space-y-3">
          <SectionTitle>Plan</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Periodo">
              <Input value={form.period ?? ""} onChange={(e) => set("period", e.target.value)} />
            </FieldWrapper>
            <FieldWrapper label="Carrier">
              <Select value={form.carrierId ?? ""} onChange={(e) => set("carrierId", e.target.value || undefined)}>
                <option value="">Sin especificar</option>
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FieldWrapper>
          </div>
          <FieldWrapper label="Nombre del plan">
            <Input value={form.planName ?? ""} onChange={(e) => set("planName", e.target.value)} />
          </FieldWrapper>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Tipo de plan">
              <Select value={form.planType ?? ""} onChange={(e) => set("planType", (e.target.value || undefined) as SaveObamacareProfileInput["planType"])}>
                <option value="">Sin especificar</option>
                <option value="BRONZE">Bronce</option>
                <option value="SILVER">Plata</option>
                <option value="GOLD">Oro</option>
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Prima mensual">
              <Input
                type="number"
                value={form.monthlyPremium ?? ""}
                onChange={(e) => set("monthlyPremium", e.target.value ? Number(e.target.value) : undefined)}
              />
            </FieldWrapper>
          </div>
          <FieldWrapper label="ID de solicitud en el Marketplace">
            <Input value={form.marketplaceApplicationId ?? ""} onChange={(e) => set("marketplaceApplicationId", e.target.value)} />
          </FieldWrapper>
          <Checkbox
            label="El cliente dio su consentimiento en el Marketplace"
            checked={form.marketplaceConsent}
            onChange={(v) => set("marketplaceConsent", v)}
          />
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Fecha de consentimiento">
              <Input type="date" value={form.consentDate ?? ""} onChange={(e) => set("consentDate", e.target.value || undefined)} />
            </FieldWrapper>
            <FieldWrapper label="Fecha efectiva">
              <Input type="date" value={form.effectiveDate ?? ""} onChange={(e) => set("effectiveDate", e.target.value || undefined)} />
            </FieldWrapper>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border-grid)] pt-4">
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>Dependientes</SectionTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => set("dependents", [...form.dependents, { firstName: "", lastName: "" } as DependentVM])}
          >
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </div>
        <div className="space-y-2">
          {form.dependents.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="flex-1"
                placeholder="Nombre"
                value={d.firstName}
                onChange={(e) =>
                  set(
                    "dependents",
                    form.dependents.map((row, j) => (j === i ? { ...row, firstName: e.target.value } : row))
                  )
                }
              />
              <Input
                className="flex-1"
                placeholder="Apellido"
                value={d.lastName}
                onChange={(e) =>
                  set(
                    "dependents",
                    form.dependents.map((row, j) => (j === i ? { ...row, lastName: e.target.value } : row))
                  )
                }
              />
              <Input
                className="w-40"
                type="date"
                value={d.dob ?? ""}
                onChange={(e) =>
                  set(
                    "dependents",
                    form.dependents.map((row, j) => (j === i ? { ...row, dob: e.target.value || undefined } : row))
                  )
                }
              />
              <button
                type="button"
                onClick={() => set("dependents", form.dependents.filter((_, j) => j !== i))}
                className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--status-critical)]"
                aria-label="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {form.dependents.length === 0 && <p className="text-xs text-[var(--ink-muted)]">Sin dependientes todavía.</p>}
        </div>
        <p className="mt-2 flex items-center gap-2 text-xs text-[var(--ink-muted)]">
          <ShieldAlert className="h-3.5 w-3.5" /> El SSN de cada dependiente se gestiona desde el panel de Datos
          sensibles, en la pestaña Overview.
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
