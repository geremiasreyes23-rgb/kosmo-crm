"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, EyeOff, Lock, RotateCcw, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";

/** Envoltorio de campo del formulario de Leads: etiqueta + obligatorio +
 * error. Es un <div> (no <label>) a propósito: varios controles son grupos
 * de botones (Sí/No, 1-10) y un <label> activaría el primero al hacer clic
 * en el texto. */
export function LeadField({
  label,
  required,
  error,
  hint,
  full,
  children,
  htmlFor,
}: {
  label: ReactNode;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  full?: boolean;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className={cn("min-w-0", full && "sm:col-span-2")} data-field-error={error ? "true" : undefined}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-[var(--ink-secondary)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--status-critical)]">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] font-medium text-[var(--status-critical)]">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-[var(--ink-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass = (error?: string) =>
  cn(
    "h-9 w-full rounded-lg border bg-[var(--surface-card)] px-3 text-sm outline-none focus:border-[var(--brand-500)]",
    error ? "border-[var(--status-critical)]" : "border-[var(--border-hairline)]"
  );

/** Selector Sí / No como botones segmentados. */
export function YesNoToggle({
  value,
  onChange,
  error,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      role="radiogroup"
      className={cn(
        "inline-flex rounded-lg border p-0.5",
        error ? "border-[var(--status-critical)]" : "border-[var(--border-hairline)]"
      )}
    >
      {[
        { v: "yes", l: "Sí" },
        { v: "no", l: "No" },
      ].map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(value === o.v ? "" : o.v)}
          className={cn(
            "h-7 min-w-[56px] rounded-md px-3 text-sm font-medium transition-colors",
            value === o.v
              ? o.v === "yes"
                ? "bg-[var(--brand-500)] text-white"
                : "bg-[var(--ink-primary)] text-[var(--surface-card)]"
              : "text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

/** Escala 1–10. */
export function RatingScale({
  value,
  onChange,
  min = 1,
  max = 10,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  error?: string;
}) {
  const n = Number(value);
  return (
    <div className={cn("flex flex-wrap gap-1", error && "rounded-lg ring-1 ring-[var(--status-critical)] p-0.5")}>
      {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((k) => {
        const active = n === k;
        const toneClass =
          k <= 3
            ? "bg-[var(--status-critical-bg)] text-[var(--status-critical)] ring-[var(--status-critical)]"
            : k <= 6
              ? "bg-[var(--status-warning-bg)] text-[var(--status-warning)] ring-[var(--status-warning)]"
              : "bg-[var(--status-good-bg)] text-[var(--status-good)] ring-[var(--status-good)]";
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(active ? "" : String(k))}
            className={cn(
              "h-8 w-8 rounded-md border text-sm font-medium transition-colors",
              active
                ? `border-transparent ring-2 ${toneClass}`
                : "border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
            )}
          >
            {k}
          </button>
        );
      })}
    </div>
  );
}

/** Opciones múltiples como chips. */
export function ChipMulti({
  options,
  value,
  onChange,
  exclusive,
  error,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  exclusive?: string;
  error?: string;
}) {
  function toggle(v: string) {
    if (value.includes(v)) return onChange(value.filter((x) => x !== v));
    if (exclusive && v === exclusive) return onChange([v]);
    onChange([...value.filter((x) => x !== exclusive), v]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(o.value)}
            className={cn(
              "h-8 rounded-full border px-3 text-sm transition-colors",
              active
                ? "border-[var(--brand-500)] bg-[var(--brand-50)] font-medium text-[var(--brand-700)]"
                : error
                  ? "border-[var(--status-critical)] text-[var(--ink-secondary)]"
                  : "border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Campo restringido (SSN, banco, clave de seguridad): se escribe enmascarado
 * y, si ya hay un valor guardado, nunca se muestra — solo su máscara, con la
 * opción de reemplazarlo. El valor real solo viaja al servidor una vez, al
 * guardar, y allí se cifra.
 */
export function SensitiveInput({
  id,
  value,
  onChange,
  savedMask,
  error,
  placeholder,
  inputMode,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  savedMask?: string;
  error?: string;
  placeholder?: string;
  inputMode?: "numeric" | "text";
}) {
  const [show, setShow] = useState(false);
  const [replacing, setReplacing] = useState(false);

  if (savedMask && !replacing && !value) {
    return (
      <div className="flex h-9 items-center justify-between gap-2 rounded-lg border border-dashed border-[var(--border-grid)] bg-[var(--surface-sunken)] px-3 text-sm">
        <span className="flex min-w-0 items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" />
          <span className="truncate font-mono">{savedMask}</span>
        </span>
        <button
          type="button"
          onClick={() => setReplacing(true)}
          className="shrink-0 text-xs font-medium text-[var(--brand-600)] hover:underline"
        >
          Reemplazar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-muted)]" />
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete="off"
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputClass(error), "pl-8 pr-16 font-mono")}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {savedMask && (
          <button
            type="button"
            title="Conservar el valor guardado"
            onClick={() => {
              onChange("");
              setReplacing(false);
            }}
            className="rounded p-1 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          title={show ? "Ocultar" : "Mostrar lo que escribo"}
          onClick={() => setShow((s) => !s)}
          className="rounded p-1 text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

/** Firma con el dedo / mouse sobre un canvas; guarda un PNG (data URL). */
export function SignaturePad({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  error?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = value;
    }
    // Solo al montar: el valor inicial se pinta una vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    dirty.current = true;
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    if (dirty.current && canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    dirty.current = false;
    onChange("");
  }

  return (
    <div>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border bg-white",
          error ? "border-[var(--status-critical)]" : "border-[var(--border-hairline)]"
        )}
      >
        <canvas
          ref={canvasRef}
          aria-label="Área de firma"
          className="block h-32 w-full touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {!value && (
          <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-gray-400">
            Firme aquí
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-gray-300" />
      </div>
      <div className="mt-1 flex justify-end">
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 text-xs text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
        >
          <Eraser className="h-3.5 w-3.5" /> Borrar firma
        </button>
      </div>
    </div>
  );
}
