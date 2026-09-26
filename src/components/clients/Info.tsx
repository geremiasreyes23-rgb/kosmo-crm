/** Fila "etiqueta: valor" reutilizada por las pestañas del expediente del
 * cliente (Overview, Medicare, Obamacare...) — extraída de
 * clients/[id]/page.tsx para no duplicarla en cada pestaña nueva. */
export function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between border-b border-[var(--border-grid)] py-1.5 text-sm">
      <span className="text-[var(--ink-muted)]">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
