"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  FileText,
  HeartPulse,
  Lock,
  Paperclip,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";
import { DynamicField } from "@/components/ui/DynamicField";
import { AddFieldMenu } from "@/components/ui/AddFieldMenu";
import { PersonSelect, agentOptions } from "@/components/ui/PersonSelect";
import { PersonChip } from "@/components/ui/PersonAvatar";
import { cn, formatBytes } from "@/lib/utils";
import { createLeadAction, updateLeadAction, type LeadFormPayload } from "@/app/(app)/leads/actions";
import type { LeadEditData, LeadFormOptions } from "@/app/(app)/leads/data";
import { uploadDocumentAction } from "@/lib/documents/actions";
import type { PipelineStage } from "@/types";
import {
  COMMON_LABELS,
  COMMON_REQUIRED,
  COMMON_SENSITIVE,
  EMPTY_COMMON,
  LANGUAGES,
  LINE_DEFS,
  US_STATES,
  ageFromDob,
  emptyLineValues,
  sectionProgress,
  validateLead,
  type CommonValues,
  type FieldErrors,
  type LineCode,
  type LineValues,
} from "@/lib/leads/lineSchema";
import { LeadField, SensitiveInput, inputClass } from "./primitives";
import { LineFields, RestrictedLabel, Turning65Alert } from "./LineFields";

const MAX_DOCUMENT_SIZE_MB = 8;

const LINE_ICONS: Record<string, ReactNode> = {
  MEDICARE: <HeartPulse className="h-5 w-5" />,
  OBAMACARE: <ShieldCheck className="h-5 w-5" />,
  FAMILY_HERITAGE: <Users className="h-5 w-5" />,
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatToday(iso?: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(
    iso ? new Date(iso) : new Date()
  );
}

/** Bloque numerado de primer nivel: 1 Cliente · 2 Línea · 3 Detalle de línea. */
function Block({
  step,
  title,
  subtitle,
  right,
  children,
  tone = "default",
}: {
  step: number;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  tone?: "default" | "brand";
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-[var(--surface-card)] shadow-sm",
        tone === "brand" ? "border-[var(--brand-300)]" : "border-[var(--border-hairline)]"
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-[var(--border-hairline)] px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-500)] text-xs font-bold text-white">
            {step}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink-primary)]">{title}</h3>
            {subtitle && <p className="text-xs text-[var(--ink-muted)]">{subtitle}</p>}
          </div>
        </div>
        {right}
      </header>
      <div className="space-y-5 px-4 py-4">{children}</div>
    </section>
  );
}

function SubHeading({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <h4 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
      {icon}
      {children}
    </h4>
  );
}

function ProgressPill({ done, total, hasErrors }: { done: number; total: number; hasErrors: boolean }) {
  const complete = total > 0 && done === total && !hasErrors;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        hasErrors
          ? "bg-[var(--status-critical-bg)] text-[var(--status-critical)]"
          : complete
            ? "bg-[var(--status-good-bg)] text-[var(--status-good)]"
            : "bg-[var(--surface-sunken)] text-[var(--ink-secondary)]"
      )}
    >
      {hasErrors ? <AlertCircle className="h-3 w-3" /> : complete ? <CheckCircle2 className="h-3 w-3" /> : null}
      {done}/{total}
    </span>
  );
}

export interface LeadFormDrawerProps {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  formOptions: LeadFormOptions;
  /** Solo en creación. */
  stages?: PipelineStage[];
  initialStageId?: string;
  /** Solo en edición. */
  initial?: LeadEditData;
  canAssignOthers: boolean;
  currentUserName: string;
  currentAgentId?: string | null;
  onSaved?: (leadId: string) => void;
}

/**
 * Formulario de Lead (crear y editar) — estructura fija:
 *   1. Información del cliente (Cliente Común, siempre visible)
 *   2. Línea de negocio (selector)
 *   3. Información de [línea] (solo los campos de la línea elegida)
 */
export function LeadFormDrawer(props: LeadFormDrawerProps) {
  const { open, onClose, mode, formOptions, stages = [], initial, canAssignOthers, currentUserName } = props;
  const router = useRouter();

  const [common, setCommon] = useState<CommonValues>(EMPTY_COMMON);
  const [lineId, setLineId] = useState("");
  /** Valores por línea en memoria: cambiar de línea y volver no pierde lo
   * escrito antes de guardar. Al guardar solo viaja la línea activa. */
  const [valuesByLine, setValuesByLine] = useState<Partial<Record<LineCode, LineValues>>>({});
  const [sensitiveInputs, setSensitiveInputs] = useState<Record<string, string>>({});
  const [stageId, setStageId] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [extraFields, setExtraFields] = useState<LeadFormOptions["extraFields"]>([]);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [restrictedOpen, setRestrictedOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reinicia el formulario cada vez que se abre.
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setCommon({ ...EMPTY_COMMON, ...initial.common });
      setLineId(initial.lineId);
      const code = formOptions.insuranceLines.find((l) => l.id === initial.lineId)?.lineCode;
      setValuesByLine(code && initial.lineValues ? { [code]: { ...emptyLineValues(code), ...initial.lineValues } } : {});
      setCustomValues(initial.customFieldValues);
      setExtraFields(formOptions.extraFields.filter((f) => f.key in initial.customFieldValues));
    } else {
      setCommon({ ...EMPTY_COMMON, agentId: canAssignOthers ? "" : props.currentAgentId ?? "" });
      setLineId("");
      setValuesByLine({});
      setCustomValues({});
      setExtraFields([]);
      setStageId(props.initialStageId || stages[0]?.id || "");
    }
    setSensitiveInputs({});
    setNote("");
    setFiles([]);
    setErrors({});
    setFormError(null);
    setOpenSections({});
    setRestrictedOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const line = formOptions.insuranceLines.find((l) => l.id === lineId) ?? null;
  const lineCode = line?.lineCode ?? null;
  const lineDef = lineCode ? LINE_DEFS[lineCode] : null;
  const values: LineValues = lineCode ? valuesByLine[lineCode] ?? emptyLineValues(lineCode) : {};
  const savedLineCode = mode === "edit" ? formOptions.insuranceLines.find((l) => l.id === initial?.lineId)?.lineCode ?? null : null;
  const lineChanged = mode === "edit" && !!initial?.lineId && initial.lineId !== lineId;

  const savedMasks = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of initial?.sensitive ?? []) m[s.fieldKey] = s.maskedPreview;
    return m;
  }, [initial]);

  const lineCustomFields = lineId ? formOptions.fieldsByLine[lineId] ?? [] : [];
  const carriers = lineId ? formOptions.carriersByLine[lineId] ?? [] : [];
  const availableExtra = formOptions.extraFields.filter((f) => !extraFields.some((x) => x.key === f.key));

  function setCommonField<K extends keyof CommonValues>(key: K, value: string) {
    setCommon((prev) => ({ ...prev, [key]: value }));
    clearError(`common.${key}`);
  }
  function clearError(path: string) {
    setErrors((prev) => {
      if (!(path in prev)) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }
  function setLineValue(key: string, value: LineValues[string]) {
    if (!lineCode) return;
    setValuesByLine((prev) => ({
      ...prev,
      [lineCode]: { ...(prev[lineCode] ?? emptyLineValues(lineCode)), [key]: value },
    }));
  }
  function setSensitive(key: string, value: string) {
    setSensitiveInputs((prev) => ({ ...prev, [key]: value }));
  }
  function selectLine(id: string) {
    setLineId(id);
    clearError("lineId");
    // Al cambiar de línea, los errores de la anterior dejan de aplicar.
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k.startsWith("common.") || k === "sensitive.ssn" || k === "sensitive.alliance_security_key")));
    setOpenSections({});
  }

  // Progreso por sección (de la línea activa).
  const sectionStats = useMemo(() => {
    if (!lineDef || !lineCode) return [];
    return lineDef.sections.map((s) => ({ id: s.id, ...sectionProgress(lineCode, s, values, errors) }));
  }, [lineDef, lineCode, values, errors]);

  const commonDone = COMMON_REQUIRED.filter((k) => String(common[k] ?? "").trim() && !errors[`common.${k}`]).length;
  const lineTotals = sectionStats.reduce(
    (acc, s) => ({ done: acc.done + s.done, total: acc.total + s.total }),
    { done: 0, total: 0 }
  );

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: File[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_DOCUMENT_SIZE_MB * 1024 * 1024) {
        setFormError(`"${f.name}" supera el límite de ${MAX_DOCUMENT_SIZE_MB}MB.`);
        continue;
      }
      next.push(f);
    }
    setFiles((prev) => [...prev, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function revealErrors(errs: FieldErrors) {
    // Abre las secciones con errores y lleva la vista al primero.
    if (lineDef && lineCode) {
      const opened: Record<string, boolean> = {};
      for (const s of lineDef.sections) {
        if (sectionProgress(lineCode, s, values, errs).hasErrors) opened[s.id] = true;
      }
      setOpenSections((prev) => ({ ...prev, ...opened }));
    }
    if (Object.keys(errs).some((k) => k === "sensitive.ssn" || k === "sensitive.alliance_security_key")) {
      setRestrictedOpen(true);
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = bodyRef.current?.querySelector('[data-field-error="true"], [data-line-error="true"]');
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      })
    );
  }

  async function handleSubmit() {
    setFormError(null);
    const clientErrors = validateLead({
      common,
      lineCode,
      hasLine: !!lineId,
      values,
      sensitiveInputs,
      sensitiveSaved: Object.keys(savedMasks),
    });
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      const n = Object.keys(clientErrors).length;
      setFormError(n === 1 ? "Falta completar 1 campo obligatorio." : `Faltan ${n} campos por completar o corregir.`);
      revealErrors(clientErrors);
      return;
    }

    const payload: LeadFormPayload = {
      common,
      lineId,
      lineValues: values,
      sensitive: Object.fromEntries(Object.entries(sensitiveInputs).filter(([, v]) => v.trim())),
      customFieldValues: customValues,
      note: note.trim() || undefined,
      stageId: mode === "create" ? stageId : undefined,
    };

    setSubmitting(true);
    const result =
      mode === "edit" && initial ? await updateLeadAction(initial.leadId, payload) : await createLeadAction(payload);
    if (!result.ok || !result.id) {
      setSubmitting(false);
      setFormError(result.error ?? "No se pudo guardar el lead.");
      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
        revealErrors(result.fieldErrors);
      }
      return;
    }

    // Documentos adjuntos: se suben una vez que el lead existe.
    const failed: string[] = [];
    for (const file of files) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const up = await uploadDocumentAction({
          fileName: file.name,
          dataUrl,
          sizeBytes: file.size,
          relatedLeadId: result.id,
        });
        if (!up.ok) failed.push(file.name);
      } catch {
        failed.push(file.name);
      }
    }
    setSubmitting(false);
    if (failed.length) {
      window.alert(`El lead se guardó, pero no se pudieron adjuntar: ${failed.join(", ")}.`);
    }
    onClose();
    props.onSaved?.(result.id);
    router.refresh();
  }

  const restrictedErrors = COMMON_SENSITIVE.some((s) => errors[`sensitive.${s.key}`]);
  const dobAge = ageFromDob(common.dob);
  const err = (k: keyof CommonValues) => errors[`common.${k}`];
  const req = (k: keyof CommonValues) => COMMON_REQUIRED.includes(k);

  const textInput = (k: keyof CommonValues, opts: { type?: string; placeholder?: string; inputMode?: "numeric" | "tel" | "email" } = {}) => (
    <LeadField label={COMMON_LABELS[k]} required={req(k)} error={err(k)} htmlFor={`common-${k}`}>
      <input
        id={`common-${k}`}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        placeholder={opts.placeholder}
        value={common[k]}
        onChange={(e) => setCommonField(k, e.target.value)}
        className={inputClass(err(k))}
      />
    </LeadField>
  );

  return (
    <Drawer
      open={open}
      onClose={() => !submitting && onClose()}
      width="max-w-3xl"
      title={mode === "edit" ? "Editar lead" : "Crear lead"}
      subtitle={
        mode === "edit"
          ? `${initial?.leadCode ?? ""} · ${common.firstName} ${common.lastName}`
          : "Información del cliente → Línea de negocio → Información de la línea"
      }
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="hidden items-center gap-2 text-xs text-[var(--ink-muted)] sm:flex">
            <span>
              Cliente <strong className="text-[var(--ink-secondary)]">{commonDone}/{COMMON_REQUIRED.length}</strong>
            </span>
            {lineDef && (
              <span>
                · {lineDef.shortLabel}{" "}
                <strong className="text-[var(--ink-secondary)]">
                  {lineTotals.done}/{lineTotals.total}
                </strong>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear lead"}
            </Button>
          </div>
        </div>
      }
    >
      <div ref={bodyRef} className="space-y-4">
        {formError && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--status-critical)] bg-[var(--status-critical-bg)] px-3 py-2 text-sm text-[var(--status-critical)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* ─────────── 1. INFORMACIÓN DEL CLIENTE ─────────── */}
        <Block
          step={1}
          title="Información del cliente"
          subtitle="Datos comunes a todos los leads, sin importar la línea de negocio."
          right={<ProgressPill done={commonDone} total={COMMON_REQUIRED.length} hasErrors={Object.keys(errors).some((k) => k.startsWith("common.")) || restrictedErrors} />}
        >
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5 text-sm">
            <div>
              <p className="text-[11px] text-[var(--ink-muted)]">ID de cliente</p>
              <p className="font-mono font-semibold">{initial?.leadCode ?? "Se asigna al guardar"}</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--ink-muted)]">Fecha de creación</p>
              <p className="font-semibold">{formatToday(initial?.createdAt)}</p>
            </div>
          </div>

          <div>
            <SubHeading>Datos personales</SubHeading>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
              {textInput("firstName")}
              {textInput("lastName")}
              <LeadField
                label={COMMON_LABELS.dob}
                required
                error={err("dob")}
                hint={dobAge != null ? `${dobAge} años` : undefined}
                htmlFor="common-dob"
              >
                <input
                  id="common-dob"
                  type="date"
                  value={common.dob}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setCommonField("dob", e.target.value)}
                  className={inputClass(err("dob"))}
                />
              </LeadField>
              <LeadField label={COMMON_LABELS.preferredLanguage} required error={err("preferredLanguage")} htmlFor="common-lang">
                <Select id="common-lang" value={common.preferredLanguage} onChange={(e) => setCommonField("preferredLanguage", e.target.value)} className={err("preferredLanguage") ? "border-[var(--status-critical)]" : undefined}>
                  <option value="">Selecciona...</option>
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </LeadField>
            </div>
          </div>

          <div>
            <SubHeading>Contacto y dirección</SubHeading>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
              {textInput("phone", { type: "tel", placeholder: "(305) 555-0100", inputMode: "tel" })}
              {textInput("email", { type: "email", placeholder: "nombre@correo.com", inputMode: "email" })}
              <div className="sm:col-span-2">{textInput("address", { placeholder: "Calle, número, apto." })}</div>
              {textInput("zipCode", { placeholder: "33101", inputMode: "numeric" })}
              {textInput("county", { placeholder: "Miami-Dade" })}
              <LeadField label={COMMON_LABELS.state} required error={err("state")} htmlFor="common-state">
                <Select id="common-state" value={common.state} onChange={(e) => setCommonField("state", e.target.value)} className={err("state") ? "border-[var(--status-critical)]" : undefined}>
                  <option value="">Selecciona...</option>
                  {US_STATES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </LeadField>
            </div>
          </div>

          <div>
            <SubHeading icon={<Briefcase className="h-3.5 w-3.5" />}>Gestión comercial</SubHeading>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
              <LeadField label={COMMON_LABELS.sourceId} required error={err("sourceId")} full>
                <div className="flex flex-wrap gap-1.5">
                  {formOptions.sources.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={common.sourceId === s.id}
                      onClick={() => setCommonField("sourceId", common.sourceId === s.id ? "" : s.id)}
                      className={cn(
                        "h-8 rounded-full border px-3 text-sm transition-colors",
                        common.sourceId === s.id
                          ? "border-[var(--brand-500)] bg-[var(--brand-50)] font-medium text-[var(--brand-700)]"
                          : err("sourceId")
                            ? "border-[var(--status-critical)] text-[var(--ink-secondary)]"
                            : "border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                      )}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </LeadField>
              <LeadField label={COMMON_LABELS.agentId} required error={err("agentId")} htmlFor="common-agent">
                {canAssignOthers ? (
                  <PersonSelect
                    id="common-agent"
                    value={common.agentId}
                    onChange={(v) => setCommonField("agentId", v)}
                    options={agentOptions(formOptions.agents)}
                    placeholder="Selecciona..."
                    error={!!err("agentId")}
                  />
                ) : (
                  <div id="common-agent" className={cn(inputClass(), "flex items-center opacity-80")}>
                    <PersonChip name={currentUserName} person={{ agentId: props.currentAgentId }} />
                  </div>
                )}
              </LeadField>
              <LeadField label={COMMON_LABELS.aorId} error={err("aorId")} htmlFor="common-aor">
                <PersonSelect
                  id="common-aor"
                  value={common.aorId}
                  onChange={(v) => setCommonField("aorId", v)}
                  options={agentOptions(formOptions.aors)}
                  emptyLabel="Sin AOR"
                />
              </LeadField>
              {mode === "create" && (
                <LeadField label="Etapa inicial" htmlFor="common-stage">
                  <Select id="common-stage" value={stageId} onChange={(e) => setStageId(e.target.value)}>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </LeadField>
              )}
            </div>
          </div>

          {/* Información restringida — plegada por defecto */}
          <div className="rounded-lg border border-[var(--status-serious-bg)] bg-[var(--status-serious-bg)]/30">
            <button
              type="button"
              onClick={() => setRestrictedOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-primary)]">
                <Lock className="h-4 w-4 text-[var(--status-serious)]" /> Información restringida
                <span className="text-xs font-normal text-[var(--ink-muted)]">Social Security · Clave de seguridad</span>
              </span>
              <span className="flex items-center gap-2">
                {restrictedErrors && <AlertCircle className="h-4 w-4 text-[var(--status-critical)]" />}
                <ChevronDown className={cn("h-4 w-4 text-[var(--ink-muted)] transition-transform", restrictedOpen && "rotate-180")} />
              </span>
            </button>
            {restrictedOpen && (
              <div className="space-y-3 border-t border-[var(--status-serious-bg)] px-3 py-3">
                <p className="text-xs text-[var(--ink-muted)]">
                  Se guarda cifrado. Después de guardar solo se muestra enmascarado y ver el valor real queda registrado.
                </p>
                <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
                  {COMMON_SENSITIVE.map((s) => (
                    <LeadField
                      key={s.key}
                      label={<RestrictedLabel>{s.label}</RestrictedLabel>}
                      required={!s.optional}
                      error={errors[`sensitive.${s.key}`]}
                      htmlFor={`common-${s.key}`}
                    >
                      <SensitiveInput
                        id={`common-${s.key}`}
                        value={sensitiveInputs[s.key] ?? ""}
                        savedMask={savedMasks[s.key]}
                        onChange={(v) => {
                          setSensitive(s.key, v);
                          clearError(`sensitive.${s.key}`);
                        }}
                        error={errors[`sensitive.${s.key}`]}
                        placeholder={s.format === "ssn" ? "123-45-6789" : undefined}
                        inputMode={s.format === "ssn" ? "numeric" : "text"}
                      />
                    </LeadField>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <SubHeading icon={<FileText className="h-3.5 w-3.5" />}>Documentos y notas</SubHeading>
            <div className="space-y-3">
              <LeadField label="Documentos adjuntos" hint={`Hasta ${MAX_DOCUMENT_SIZE_MB}MB por archivo. Se adjuntan al guardar.`}>
                <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                <div className="space-y-1.5">
                  {files.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
                        <span className="truncate">{f.name}</span>
                        <span className="shrink-0 text-xs text-[var(--ink-muted)]">{formatBytes(f.size)}</span>
                      </span>
                      <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-[var(--ink-muted)] hover:text-[var(--status-critical)]" aria-label="Quitar archivo">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    <Paperclip className="h-4 w-4" /> Adjuntar documento
                  </Button>
                </div>
              </LeadField>
              <LeadField label={mode === "edit" ? "Agregar nota" : "Notas"} htmlFor="common-note" hint={mode === "edit" ? "Se agrega al historial de la pestaña Notas." : undefined}>
                <Textarea id="common-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalles adicionales del lead..." />
              </LeadField>
            </div>
          </div>

          {(extraFields.length > 0 || availableExtra.length > 0) && (
            <div>
              <SubHeading>Campos adicionales</SubHeading>
              <div className="space-y-3.5">
                {extraFields.map((f) => (
                  <DynamicField
                    key={f.key}
                    field={f}
                    value={customValues[f.key] ?? ""}
                    onChange={(v) => setCustomValues((p) => ({ ...p, [f.key]: v }))}
                    onRemove={() => {
                      setExtraFields((prev) => prev.filter((x) => x.key !== f.key));
                      setCustomValues((p) => ({ ...p, [f.key]: "" }));
                    }}
                  />
                ))}
                <AddFieldMenu catalog={availableExtra} onAdd={(f) => setExtraFields((prev) => [...prev, f])} />
              </div>
            </div>
          )}
        </Block>

        {/* ─────────── 2. LÍNEA DE NEGOCIO ─────────── */}
        <Block step={2} title="Línea de negocio" subtitle="Define qué información adicional se solicita para este lead." tone="brand">
          <div data-line-error={errors.lineId ? "true" : undefined} className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Línea de negocio">
            {formOptions.insuranceLines.map((l) => {
              const active = l.id === lineId;
              return (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => selectLine(l.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border-2 px-3 py-3 text-left transition-colors",
                    active
                      ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                      : errors.lineId
                        ? "border-[var(--status-critical)] hover:bg-[var(--surface-hover)]"
                        : "border-[var(--border-hairline)] hover:bg-[var(--surface-hover)]"
                  )}
                >
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", active ? "bg-[var(--brand-500)] text-white" : "bg-[var(--surface-sunken)] text-[var(--ink-secondary)]")}>
                    {LINE_ICONS[l.code] ?? <Briefcase className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{l.name}</span>
                    <span className="block text-[11px] text-[var(--ink-muted)]">{active ? "Seleccionada" : "Seleccionar"}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {errors.lineId && <p className="text-[11px] font-medium text-[var(--status-critical)]">{errors.lineId}</p>}
          {lineChanged && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--status-warning)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Estás cambiando la línea de negocio
                {savedLineCode ? ` de ${LINE_DEFS[savedLineCode].label}` : ""} a {line?.name}. La información del cliente se conserva;
                al guardar, los datos de la línea anterior se reemplazan por los de la nueva.
              </span>
            </div>
          )}
        </Block>

        {/* ─────────── 3. INFORMACIÓN DE LA LÍNEA ─────────── */}
        {line && (
          <Block
            step={3}
            title={`Información de ${line.name}`}
            subtitle={lineDef ? "Todos los campos visibles son obligatorios salvo los marcados como opcionales." : undefined}
            right={lineDef ? <ProgressPill done={lineTotals.done} total={lineTotals.total} hasErrors={sectionStats.some((s) => s.hasErrors)} /> : undefined}
          >
            {lineCode === "MEDICARE" && <Turning65Alert dob={common.dob} compact />}
            {lineDef && lineCode ? (
              <div className="space-y-2">
                {lineDef.sections.map((section, idx) => {
                  const stats = sectionStats.find((s) => s.id === section.id)!;
                  const isOpen = openSections[section.id] ?? idx === 0;
                  return (
                    <div
                      key={section.id}
                      className={cn(
                        "overflow-hidden rounded-lg border",
                        section.restricted ? "border-[var(--status-serious-bg)]" : "border-[var(--border-hairline)]",
                        stats.hasErrors && "border-[var(--status-critical)]"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenSections((p) => ({ ...p, [section.id]: !isOpen }))}
                        aria-expanded={isOpen}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-[var(--surface-hover)]",
                          section.restricted && "bg-[var(--status-serious-bg)]/30"
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {section.restricted && <Lock className="h-4 w-4 text-[var(--status-serious)]" />}
                          {section.title}
                        </span>
                        <span className="flex items-center gap-2">
                          <ProgressPill done={stats.done} total={stats.total} hasErrors={stats.hasErrors} />
                          <ChevronDown className={cn("h-4 w-4 text-[var(--ink-muted)] transition-transform", isOpen && "rotate-180")} />
                        </span>
                      </button>
                      {isOpen && (
                        <div className="border-t border-[var(--border-hairline)] px-3 py-3.5">
                          {section.description && <p className="mb-3 text-xs text-[var(--ink-muted)]">{section.description}</p>}
                          <LineFields
                            fields={section.fields}
                            ctx={{
                              code: lineCode,
                              values,
                              setValue: setLineValue,
                              errors,
                              clearError,
                              dob: common.dob,
                              carriers,
                              sensitiveInputs,
                              setSensitive,
                              savedMasks,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              lineCustomFields.length === 0 && (
                <p className="text-sm text-[var(--ink-muted)]">Esta línea no tiene campos adicionales configurados.</p>
              )
            )}

            {lineCustomFields.length > 0 && (
              <div>
                <SubHeading>Campos personalizados de {line.name}</SubHeading>
                <div className="space-y-3.5">
                  {lineCustomFields.map((f) => (
                    <DynamicField
                      key={f.key}
                      field={f}
                      value={customValues[f.key] ?? ""}
                      onChange={(v) => setCustomValues((p) => ({ ...p, [f.key]: v }))}
                    />
                  ))}
                </div>
              </div>
            )}
          </Block>
        )}
      </div>
    </Drawer>
  );
}
