"use client";

import { AlertTriangle, CalendarClock, Plus, Trash2 } from "lucide-react";
import { Select, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import {
  ageFromDob,
  isFieldVisible,
  newItemId,
  noneKey,
  sensitiveKeyFor,
  turning65,
  type FieldDef,
  type FieldErrors,
  type LineCode,
  type LineValues,
  type ListItem,
} from "@/lib/leads/lineSchema";
import {
  ChipMulti,
  LeadField,
  RatingScale,
  SensitiveInput,
  SignaturePad,
  YesNoToggle,
  inputClass,
} from "./primitives";

export interface LineFieldsContext {
  code: LineCode;
  values: LineValues;
  setValue: (key: string, value: LineValues[string]) => void;
  errors: FieldErrors;
  clearError: (path: string) => void;
  dob: string;
  carriers: { id: string; name: string }[];
  sensitiveInputs: Record<string, string>;
  setSensitive: (key: string, value: string) => void;
  savedMasks: Record<string, string>;
}

function formatYmdLong(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

export function Turning65Alert({ dob, compact }: { dob: string; compact?: boolean }) {
  const info = turning65(dob);
  if (!info) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border-grid)] px-3 py-2.5 text-sm text-[var(--ink-muted)]">
        Se calcula automáticamente al ingresar la fecha de nacimiento del cliente.
      </div>
    );
  }
  const tone =
    info.status === "soon"
      ? "border-[var(--status-warning)] bg-[var(--status-warning-bg)] text-[var(--status-warning)]"
      : info.status === "turned"
        ? "border-[var(--border-grid)] bg-[var(--surface-sunken)] text-[var(--ink-secondary)]"
        : "border-[var(--status-info)] bg-[var(--status-info-bg)] text-[var(--status-info)]";
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm", tone, compact && "py-1.5")}>
      {info.status === "soon" ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div>
        <p className="font-semibold">{info.message}</p>
        <p className="text-xs opacity-90">Fecha en que cumple 65: {formatYmdLong(info.date)}</p>
      </div>
    </div>
  );
}

function ComputedAge({ dob }: { dob: string }) {
  const age = ageFromDob(dob);
  return (
    <div className="flex h-9 items-center rounded-lg border border-[var(--border-grid)] bg-[var(--surface-sunken)] px-3 text-sm">
      {age == null ? <span className="text-[var(--ink-muted)]">Automática</span> : <span className="font-medium">{age} años</span>}
    </div>
  );
}

/** Un campo escalar (fuera o dentro de una lista). */
function ScalarControl({
  f,
  id,
  value,
  onChange,
  error,
  carriers,
}: {
  f: FieldDef;
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  carriers: { id: string; name: string }[];
}) {
  switch (f.kind) {
    case "yesno":
      return <YesNoToggle id={id} value={value} onChange={onChange} error={error} />;
    case "select":
      return (
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={error ? "border-[var(--status-critical)]" : undefined}>
          <option value="">Selecciona...</option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    case "carrier":
      return (
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={error ? "border-[var(--status-critical)]" : undefined}>
          <option value="">Selecciona un carrier...</option>
          {carriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      );
    case "textarea":
      return (
        <Textarea
          id={id}
          value={value}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={error ? "border-[var(--status-critical)]" : undefined}
        />
      );
    case "rating":
      return <RatingScale value={value} onChange={onChange} min={f.min} max={f.max} error={error} />;
    case "money":
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--ink-muted)]">$</span>
          <input
            id={id}
            type="number"
            inputMode="decimal"
            step="0.01"
            min={f.min}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(inputClass(error), "pl-6")}
          />
        </div>
      );
    default:
      return (
        <input
          id={id}
          type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : f.kind === "email" ? "email" : f.kind === "phone" ? "tel" : "text"}
          inputMode={f.kind === "number" ? "numeric" : undefined}
          min={f.kind === "number" ? f.min : undefined}
          max={f.kind === "number" ? f.max : f.kind === "date" && f.key === "dob" ? new Date().toISOString().slice(0, 10) : undefined}
          value={value}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(error)}
        />
      );
  }
}

function ListControl({ f, ctx }: { f: FieldDef; ctx: LineFieldsContext }) {
  const items = (ctx.values[f.key] as ListItem[]) ?? [];
  const none = ctx.values[noneKey(f.key)] === true;
  const listError = ctx.errors[`line.${f.key}`];

  function update(next: ListItem[]) {
    ctx.setValue(f.key, next);
    ctx.clearError(`line.${f.key}`);
  }
  function add() {
    const item: ListItem = { _id: newItemId() };
    for (const sub of f.itemFields ?? []) {
      if (sub.kind !== "sensitive" && sub.kind !== "computed-age") item[sub.key] = "";
    }
    update([...items, item]);
    if (none) ctx.setValue(noneKey(f.key), false);
  }

  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={it._id} className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-sunken)]/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink-secondary)]">
              {f.itemLabel} {idx + 1}
            </span>
            <button
              type="button"
              onClick={() => update(items.filter((x) => x._id !== it._id))}
              className="inline-flex items-center gap-1 text-xs text-[var(--status-critical)] hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" /> Quitar
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(f.itemFields ?? []).map((sub) => {
              const path = `line.${f.key}.${it._id}.${sub.key}`;
              const id = `lf-${f.key}-${it._id}-${sub.key}`;
              if (sub.kind === "computed-age") {
                return (
                  <LeadField key={sub.key} label={`${sub.label} (automática)`}>
                    <ComputedAge dob={it[sub.fromKey ?? "dob"] ?? ""} />
                  </LeadField>
                );
              }
              if (sub.kind === "sensitive") {
                const key = sensitiveKeyFor(ctx.code, sub.key, { listKey: f.key, itemId: it._id });
                const err = ctx.errors[`sensitive.${key}`];
                return (
                  <LeadField key={sub.key} label={<RestrictedLabel>{sub.label}</RestrictedLabel>} required={!sub.optional} error={err} htmlFor={id}>
                    <SensitiveInput
                      id={id}
                      value={ctx.sensitiveInputs[key] ?? ""}
                      savedMask={ctx.savedMasks[key]}
                      onChange={(v) => {
                        ctx.setSensitive(key, v);
                        ctx.clearError(`sensitive.${key}`);
                      }}
                      error={err}
                      placeholder={sub.format === "ssn" ? "123-45-6789" : undefined}
                      inputMode={sub.format === "ssn" ? "numeric" : undefined}
                    />
                  </LeadField>
                );
              }
              return (
                <LeadField key={sub.key} label={sub.label} required={!sub.optional} error={ctx.errors[path]} full={sub.full} htmlFor={id}>
                  <ScalarControl
                    f={sub}
                    id={id}
                    value={it[sub.key] ?? ""}
                    error={ctx.errors[path]}
                    carriers={ctx.carriers}
                    onChange={(v) => {
                      update(items.map((x) => (x._id === it._id ? { ...x, [sub.key]: v } : x)));
                      ctx.clearError(path);
                    }}
                  />
                </LeadField>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={add}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-[var(--brand-500)] px-3 text-sm font-medium text-[var(--brand-600)] hover:bg-[var(--brand-50)]"
        >
          <Plus className="h-4 w-4" /> {f.addLabel ?? "Agregar"}
        </button>
        {f.noneLabel && items.length === 0 && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--ink-secondary)]">
            <input
              type="checkbox"
              checked={none}
              onChange={(e) => {
                ctx.setValue(noneKey(f.key), e.target.checked);
                ctx.clearError(`line.${f.key}`);
              }}
              className="h-4 w-4 accent-[var(--brand-500)]"
            />
            {f.noneLabel}
          </label>
        )}
      </div>
      {listError && <p className="text-[11px] font-medium text-[var(--status-critical)]">{listError}</p>}
    </div>
  );
}

export function RestrictedLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <span className="rounded bg-[var(--status-serious-bg)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-[var(--status-serious)]">
        Restringido
      </span>
    </span>
  );
}

/** Renderiza los campos visibles de una sección de la línea de negocio. */
export function LineFields({ fields, ctx }: { fields: FieldDef[]; ctx: LineFieldsContext }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
      {fields.map((f) => {
        if (!isFieldVisible(f, ctx.values)) return null;
        const path = `line.${f.key}`;
        const id = `lf-${f.key}`;
        const error = ctx.errors[path];

        if (f.kind === "turning65") {
          return (
            <LeadField key={f.key} label={`${f.label} (automática)`} full error={error}>
              <Turning65Alert dob={ctx.dob} />
            </LeadField>
          );
        }
        if (f.kind === "computed-age") {
          return (
            <LeadField key={f.key} label={`${f.label} (automática)`} error={error} hint={f.hint} full={f.full}>
              <ComputedAge dob={ctx.dob} />
            </LeadField>
          );
        }
        if (f.kind === "list") {
          return (
            <LeadField key={f.key} label={f.label} required={!f.optional} full>
              <ListControl f={f} ctx={ctx} />
            </LeadField>
          );
        }
        if (f.kind === "sensitive") {
          const key = sensitiveKeyFor(ctx.code, f.key);
          const err = ctx.errors[`sensitive.${key}`];
          const numeric = f.format === "routing" || f.format === "account" || f.format === "day";
          return (
            <LeadField key={f.key} label={<RestrictedLabel>{f.label}</RestrictedLabel>} required={!f.optional} error={err} full={f.full} htmlFor={id}>
              <SensitiveInput
                id={id}
                value={ctx.sensitiveInputs[key] ?? ""}
                savedMask={ctx.savedMasks[key]}
                onChange={(v) => {
                  ctx.setSensitive(key, v);
                  ctx.clearError(`sensitive.${key}`);
                }}
                error={err}
                inputMode={numeric ? "numeric" : "text"}
                placeholder={f.format === "day" ? "1 a 31" : f.format === "routing" ? "9 dígitos" : undefined}
              />
            </LeadField>
          );
        }
        if (f.kind === "multicheck") {
          return (
            <LeadField key={f.key} label={f.label} required={!f.optional} error={error} full={f.full}>
              <ChipMulti
                options={f.options ?? []}
                value={(ctx.values[f.key] as string[]) ?? []}
                exclusive={f.exclusiveOption}
                error={error}
                onChange={(v) => {
                  ctx.setValue(f.key, v);
                  ctx.clearError(path);
                }}
              />
            </LeadField>
          );
        }
        if (f.kind === "signature") {
          return (
            <LeadField key={f.key} label={f.label} required={!f.optional} error={error} full>
              <SignaturePad
                value={String(ctx.values[f.key] ?? "")}
                error={error}
                onChange={(v) => {
                  ctx.setValue(f.key, v);
                  ctx.clearError(path);
                }}
              />
            </LeadField>
          );
        }
        return (
          <LeadField key={f.key} label={f.label} required={!f.optional} error={error} hint={f.hint} full={f.full} htmlFor={id}>
            <ScalarControl
              f={f}
              id={id}
              value={String(ctx.values[f.key] ?? "")}
              error={error}
              carriers={ctx.carriers}
              onChange={(v) => {
                ctx.setValue(f.key, v);
                ctx.clearError(path);
              }}
            />
          </LeadField>
        );
      })}
    </div>
  );
}
