"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/Field";
import { Info } from "@/components/clients/Info";
import { Plus, Trash2, ShieldAlert } from "lucide-react";
import { saveMedicareProfileAction, type SaveMedicareProfileInput } from "@/app/(app)/clients/[id]/medicare/actions";
import type {
  MedicareProfileVM,
  MedicareConditionVM,
  MedicareMedicationVM,
  MedicareSpecialistVM,
} from "@/types";

function emptyProfile(): SaveMedicareProfileInput {
  return {
    hasMedicaid: false,
    qmb: false,
    fbde: false,
    slmb: false,
    extraHelp: false,
    homeAttendant: false,
    hasCancer: false,
    onDialysis: false,
    soaSigned: false,
    poa: false,
    currentAor: false,
    acceptsAgentChange: false,
    acceptsPlanChange: false,
    conditions: [],
    medications: [],
    specialists: [],
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

export function MedicareProfileTab({
  clientId,
  initialProfile,
  carriers,
  canEdit,
}: {
  clientId: string;
  initialProfile: MedicareProfileVM | null;
  carriers: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(!initialProfile);
  const [form, setForm] = useState<SaveMedicareProfileInput>(() => ({
    ...emptyProfile(),
    ...(initialProfile ?? {}),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof SaveMedicareProfileInput>(key: K, value: SaveMedicareProfileInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateRow<T>(list: T[], index: number, patch: Partial<T>): T[] {
    return list.map((row, i) => (i === index ? { ...row, ...patch } : row));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await saveMedicareProfileAction(clientId, form);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "No se pudo guardar el perfil de Medicare Advantage.");
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
          <p className="text-sm text-[var(--ink-muted)]">
            Este cliente todavía no tiene un perfil de Medicare Advantage.
          </p>
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
            <SectionTitle>Elegibilidad dual</SectionTitle>
            <Info label="¿Tiene Medicaid?" value={p.hasMedicaid ? "Sí" : "No"} />
            <Info label="Clasificación dual" value={p.dualClassification} />
            <Info label="QMB / FBDE / SLMB" value={`${p.qmb ? "QMB " : ""}${p.fbde ? "FBDE " : ""}${p.slmb ? "SLMB" : ""}`.trim() || undefined} />
            <Info label="Extra Help" value={p.extraHelp ? "Sí" : "No"} />
            <SectionTitle>Salud</SectionTitle>
            <Info label="Calificación de salud (1-10)" value={p.healthRating != null ? String(p.healthRating) : undefined} />
            <Info label="Peso (lbs)" value={p.weight != null ? String(p.weight) : undefined} />
            <Info label="Estatura (in)" value={p.height != null ? String(p.height) : undefined} />
            <Info label="Asistente en casa" value={p.homeAttendant ? p.homeAttendantCompany || "Sí" : "No"} />
            <Info label="¿Cáncer?" value={p.hasCancer ? "Sí" : "No"} />
            <Info label="¿Diálisis?" value={p.onDialysis ? "Sí" : "No"} />
            <SectionTitle>Médico y farmacia</SectionTitle>
            <Info label="Médico primario" value={p.primaryDoctorName} />
            <Info label="Dirección del médico" value={p.primaryDoctorAddress} />
            <Info label="Teléfono del médico" value={p.primaryDoctorPhone} />
            <Info label="Farmacia preferida" value={p.preferredPharmacy} />
          </div>
          <div className="space-y-3">
            <SectionTitle>Plan actual</SectionTitle>
            <Info label="Carrier actual" value={carriers.find((c) => c.id === p.currentCarrierId)?.name} />
            <Info label="Plan actual" value={p.currentPlanName} />
            <Info label="Tipo de plan" value={p.currentPlanType} />
            <SectionTitle>Plan ofrecido</SectionTitle>
            <Info label="Carrier ofrecido" value={carriers.find((c) => c.id === p.offeredCarrierId)?.name} />
            <Info label="Plan ofrecido" value={p.offeredPlanName} />
            <Info label="Tipo de plan" value={p.offeredPlanType} />
            <Info label="Motivo del cambio" value={p.changeReason} />
            <Info label="Periodo de elección" value={p.electionPeriod} />
            <Info label="Método de presentación" value={p.presentationMethod} />
            <SectionTitle>SOA y confirmación</SectionTitle>
            <Info label="SOA firmado" value={p.soaSigned ? (p.soaDate ?? "Sí") : "No"} />
            <Info label="Fecha efectiva" value={p.effectiveDate} />
            <Info label="Número de confirmación" value={p.confirmationNumber} />
          </div>
        </div>
        {p.poa && (
          <div className="space-y-3 border-t border-[var(--border-grid)] pt-4">
            <SectionTitle>Poder (POA)</SectionTitle>
            <Info label="Nombre" value={[p.poaFirstName, p.poaLastName].filter(Boolean).join(" ") || undefined} />
            <Info label="Relación" value={p.poaRelationship} />
            <Info label="Teléfono" value={p.poaPhone} />
          </div>
        )}
        {p.conditions.length > 0 && (
          <div className="border-t border-[var(--border-grid)] pt-4">
            <SectionTitle>Condiciones médicas</SectionTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.conditions.map((c, i) => (
                <span key={i} className="rounded-full border border-[var(--border-hairline)] px-3 py-1 text-xs">
                  {c.name}
                  {c.isChronic ? " · crónica" : ""}
                </span>
              ))}
            </div>
          </div>
        )}
        {p.medications.length > 0 && (
          <div className="border-t border-[var(--border-grid)] pt-4">
            <SectionTitle>Medicamentos</SectionTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.medications.map((m, i) => (
                <span key={i} className="rounded-full border border-[var(--border-hairline)] px-3 py-1 text-xs">
                  {[m.name, m.mg, m.frequency].filter(Boolean).join(" · ")}
                </span>
              ))}
            </div>
          </div>
        )}
        {p.specialists.length > 0 && (
          <div className="border-t border-[var(--border-grid)] pt-4">
            <SectionTitle>Especialistas</SectionTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.specialists.map((s, i) => (
                <span key={i} className="rounded-full border border-[var(--border-hairline)] px-3 py-1 text-xs">
                  {[s.name, s.nextAppointmentAt].filter(Boolean).join(" · ")}
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="flex items-center gap-2 border-t border-[var(--border-grid)] pt-4 text-xs text-[var(--ink-muted)]">
          <ShieldAlert className="h-3.5 w-3.5" /> El número de Medicare/Medicaid se gestiona desde el panel de Datos
          sensibles, en la pestaña Overview.
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
          <SectionTitle>Elegibilidad dual</SectionTitle>
          <Checkbox label="¿Tiene Medicaid?" checked={form.hasMedicaid} onChange={(v) => set("hasMedicaid", v)} />
          <FieldWrapper label="Clasificación dual">
            <Input value={form.dualClassification ?? ""} onChange={(e) => set("dualClassification", e.target.value)} />
          </FieldWrapper>
          <div className="flex flex-wrap gap-4">
            <Checkbox label="QMB" checked={form.qmb} onChange={(v) => set("qmb", v)} />
            <Checkbox label="FBDE" checked={form.fbde} onChange={(v) => set("fbde", v)} />
            <Checkbox label="SLMB" checked={form.slmb} onChange={(v) => set("slmb", v)} />
            <Checkbox label="Extra Help" checked={form.extraHelp} onChange={(v) => set("extraHelp", v)} />
          </div>

          <SectionTitle>Salud</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            <FieldWrapper label="Salud (1-10)">
              <Input
                type="number"
                min={1}
                max={10}
                value={form.healthRating ?? ""}
                onChange={(e) => set("healthRating", e.target.value ? Number(e.target.value) : undefined)}
              />
            </FieldWrapper>
            <FieldWrapper label="Peso (lbs)">
              <Input
                type="number"
                value={form.weight ?? ""}
                onChange={(e) => set("weight", e.target.value ? Number(e.target.value) : undefined)}
              />
            </FieldWrapper>
            <FieldWrapper label="Estatura (in)">
              <Input
                type="number"
                value={form.height ?? ""}
                onChange={(e) => set("height", e.target.value ? Number(e.target.value) : undefined)}
              />
            </FieldWrapper>
          </div>
          <Checkbox label="Tiene asistente en casa" checked={form.homeAttendant} onChange={(v) => set("homeAttendant", v)} />
          {form.homeAttendant && (
            <FieldWrapper label="Compañía del asistente">
              <Input value={form.homeAttendantCompany ?? ""} onChange={(e) => set("homeAttendantCompany", e.target.value)} />
            </FieldWrapper>
          )}
          <div className="flex flex-wrap gap-4">
            <Checkbox label="¿Cáncer?" checked={form.hasCancer} onChange={(v) => set("hasCancer", v)} />
            <Checkbox label="¿En diálisis?" checked={form.onDialysis} onChange={(v) => set("onDialysis", v)} />
          </div>

          <SectionTitle>Médico y farmacia</SectionTitle>
          <FieldWrapper label="Médico primario">
            <Input value={form.primaryDoctorName ?? ""} onChange={(e) => set("primaryDoctorName", e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="Dirección del médico">
            <Input value={form.primaryDoctorAddress ?? ""} onChange={(e) => set("primaryDoctorAddress", e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="Teléfono del médico">
            <Input value={form.primaryDoctorPhone ?? ""} onChange={(e) => set("primaryDoctorPhone", e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="Farmacia preferida">
            <Input value={form.preferredPharmacy ?? ""} onChange={(e) => set("preferredPharmacy", e.target.value)} />
          </FieldWrapper>
        </div>

        <div className="space-y-3">
          <SectionTitle>Plan actual</SectionTitle>
          <FieldWrapper label="Carrier actual">
            <Select value={form.currentCarrierId ?? ""} onChange={(e) => set("currentCarrierId", e.target.value || undefined)}>
              <option value="">Sin especificar</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Nombre del plan actual">
            <Input value={form.currentPlanName ?? ""} onChange={(e) => set("currentPlanName", e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="Tipo de plan actual">
            <Select value={form.currentPlanType ?? ""} onChange={(e) => set("currentPlanType", (e.target.value || undefined) as SaveMedicareProfileInput["currentPlanType"])}>
              <option value="">Sin especificar</option>
              <option value="HMO">HMO</option>
              <option value="PPO">PPO</option>
              <option value="D_SNP">D-SNP</option>
              <option value="C_SNP">C-SNP</option>
            </Select>
          </FieldWrapper>

          <SectionTitle>Plan ofrecido</SectionTitle>
          <FieldWrapper label="Carrier ofrecido">
            <Select value={form.offeredCarrierId ?? ""} onChange={(e) => set("offeredCarrierId", e.target.value || undefined)}>
              <option value="">Sin especificar</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Nombre del plan ofrecido">
            <Input value={form.offeredPlanName ?? ""} onChange={(e) => set("offeredPlanName", e.target.value)} />
          </FieldWrapper>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Tipo de plan ofrecido">
              <Select value={form.offeredPlanType ?? ""} onChange={(e) => set("offeredPlanType", (e.target.value || undefined) as SaveMedicareProfileInput["offeredPlanType"])}>
                <option value="">Sin especificar</option>
                <option value="HMO">HMO</option>
                <option value="PPO">PPO</option>
                <option value="D_SNP">D-SNP</option>
                <option value="C_SNP">C-SNP</option>
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Periodo de elección">
              <Input value={form.electionPeriod ?? ""} onChange={(e) => set("electionPeriod", e.target.value)} />
            </FieldWrapper>
          </div>
          <FieldWrapper label="Motivo del cambio">
            <Textarea value={form.changeReason ?? ""} onChange={(e) => set("changeReason", e.target.value)} />
          </FieldWrapper>
          <FieldWrapper label="Método de presentación">
            <Select value={form.presentationMethod ?? ""} onChange={(e) => set("presentationMethod", (e.target.value || undefined) as SaveMedicareProfileInput["presentationMethod"])}>
              <option value="">Sin especificar</option>
              <option value="PHONE">Teléfono</option>
              <option value="IN_PERSON">En persona</option>
              <option value="VIRTUAL">Virtual</option>
            </Select>
          </FieldWrapper>

          <SectionTitle>SOA y confirmación</SectionTitle>
          <Checkbox label="SOA firmado" checked={form.soaSigned} onChange={(v) => set("soaSigned", v)} />
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Fecha de SOA">
              <Input type="date" value={form.soaDate ?? ""} onChange={(e) => set("soaDate", e.target.value || undefined)} />
            </FieldWrapper>
            <FieldWrapper label="Método de SOA">
              <Input value={form.soaMethod ?? ""} onChange={(e) => set("soaMethod", e.target.value)} />
            </FieldWrapper>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Fecha efectiva">
              <Input type="date" value={form.effectiveDate ?? ""} onChange={(e) => set("effectiveDate", e.target.value || undefined)} />
            </FieldWrapper>
            <FieldWrapper label="Número de confirmación">
              <Input value={form.confirmationNumber ?? ""} onChange={(e) => set("confirmationNumber", e.target.value)} />
            </FieldWrapper>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border-grid)] pt-4">
        <SectionTitle>Poder (POA)</SectionTitle>
        <Checkbox label="El cliente tiene un POA" checked={form.poa} onChange={(v) => set("poa", v)} />
        {form.poa && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <FieldWrapper label="Nombre">
              <Input value={form.poaFirstName ?? ""} onChange={(e) => set("poaFirstName", e.target.value)} />
            </FieldWrapper>
            <FieldWrapper label="Apellido">
              <Input value={form.poaLastName ?? ""} onChange={(e) => set("poaLastName", e.target.value)} />
            </FieldWrapper>
            <FieldWrapper label="Dirección">
              <Input value={form.poaAddress ?? ""} onChange={(e) => set("poaAddress", e.target.value)} />
            </FieldWrapper>
            <FieldWrapper label="Teléfono">
              <Input value={form.poaPhone ?? ""} onChange={(e) => set("poaPhone", e.target.value)} />
            </FieldWrapper>
            <FieldWrapper label="Relación">
              <Input value={form.poaRelationship ?? ""} onChange={(e) => set("poaRelationship", e.target.value)} />
            </FieldWrapper>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border-grid)] pt-4">
        <SectionTitle>AOR y consentimientos</SectionTitle>
        <div className="mt-3 flex flex-wrap gap-4">
          <Checkbox label="AOR actual" checked={form.currentAor} onChange={(v) => set("currentAor", v)} />
          <Checkbox label="Acepta cambio de agente" checked={form.acceptsAgentChange} onChange={(v) => set("acceptsAgentChange", v)} />
          <Checkbox label="Acepta cambio de plan" checked={form.acceptsPlanChange} onChange={(v) => set("acceptsPlanChange", v)} />
        </div>
        {form.currentAor && (
          <FieldWrapper label="Nombre del AOR actual">
            <Input value={form.currentAorName ?? ""} onChange={(e) => set("currentAorName", e.target.value)} />
          </FieldWrapper>
        )}
      </div>

      <RowListEditor<MedicareConditionVM>
        title="Condiciones médicas"
        rows={form.conditions}
        onChange={(rows) => set("conditions", rows)}
        newRow={() => ({ name: "", isChronic: false })}
        renderRow={(row, i, onPatch) => (
          <>
            <Input
              className="flex-1"
              placeholder="Nombre de la condición"
              value={row.name}
              onChange={(e) => onPatch({ name: e.target.value })}
            />
            <Checkbox label="Crónica" checked={row.isChronic} onChange={(v) => onPatch({ isChronic: v })} />
          </>
        )}
      />

      <RowListEditor<MedicareMedicationVM>
        title="Medicamentos"
        rows={form.medications}
        onChange={(rows) => set("medications", rows)}
        newRow={() => ({ name: "" })}
        renderRow={(row, i, onPatch) => (
          <>
            <Input className="flex-1" placeholder="Nombre" value={row.name} onChange={(e) => onPatch({ name: e.target.value })} />
            <Input className="w-24" placeholder="Mg" value={row.mg ?? ""} onChange={(e) => onPatch({ mg: e.target.value })} />
            <Input className="w-32" placeholder="Frecuencia" value={row.frequency ?? ""} onChange={(e) => onPatch({ frequency: e.target.value })} />
          </>
        )}
      />

      <RowListEditor<MedicareSpecialistVM>
        title="Especialistas"
        rows={form.specialists}
        onChange={(rows) => set("specialists", rows)}
        newRow={() => ({ name: "" })}
        renderRow={(row, i, onPatch) => (
          <>
            <Input className="flex-1" placeholder="Nombre" value={row.name} onChange={(e) => onPatch({ name: e.target.value })} />
            <Input className="w-40" placeholder="Teléfono" value={row.phone ?? ""} onChange={(e) => onPatch({ phone: e.target.value })} />
            <Input
              className="w-40"
              type="date"
              value={row.nextAppointmentAt ?? ""}
              onChange={(e) => onPatch({ nextAppointmentAt: e.target.value || undefined })}
            />
          </>
        )}
      />

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

function RowListEditor<T>({
  title,
  rows,
  onChange,
  newRow,
  renderRow,
}: {
  title: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  newRow: () => T;
  renderRow: (row: T, index: number, onPatch: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <div className="border-t border-[var(--border-grid)] pt-4">
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>{title}</SectionTitle>
        <Button variant="ghost" size="sm" onClick={() => onChange([...rows, newRow()])}>
          <Plus className="h-4 w-4" /> Agregar
        </Button>
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            {renderRow(row, i, (patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))))}
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--status-critical)]"
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-xs text-[var(--ink-muted)]">Sin registros todavía.</p>}
      </div>
    </div>
  );
}
