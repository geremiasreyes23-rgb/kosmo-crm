import { cn } from "@/lib/utils";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function FieldWrapper({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--ink-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}

/** cn() no fusiona clases de Tailwind en conflicto, así que si quien usa el
 * campo pasa su propio ancho (w-40) o redondeo (rounded-full), la clase por
 * defecto (w-full / rounded-lg) se omite para que la suya sí se aplique. */
function baseField(className?: string) {
  const c = className ?? "";
  return cn(
    "h-9 border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 text-sm outline-none focus:border-[var(--brand-500)]",
    !/(^|\s)w-/.test(c) && "w-full",
    !/(^|\s)rounded(-|\s|$)/.test(c) && "rounded-lg"
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        baseField(className),
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        baseField(className),
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-2 text-sm outline-none focus:border-[var(--brand-500)]",
        className
      )}
      rows={3}
      {...props}
    />
  );
}
