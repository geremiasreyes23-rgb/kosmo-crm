/** Genera texto CSV (RFC 4180 básico) a partir de un arreglo de filas y una
 * lista de columnas — usado por las exportaciones de Reportes (Fase 11).
 * Deliberadamente simple: comillas dobles alrededor de cualquier valor que
 * contenga coma, comilla o salto de línea, sin dependencias externas. */
export function buildCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[]
): string {
  const escape = (value: unknown): string => {
    const s = value == null ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  return [header, ...lines].join("\n");
}
