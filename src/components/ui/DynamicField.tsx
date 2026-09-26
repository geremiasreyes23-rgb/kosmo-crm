import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/Field";
import type { FieldDef } from "@/data/customFields";

/** Renderiza un campo personalizado según su tipo — usado tanto para los
 * campos que aparecen automáticamente por línea de negocio como para los
 * que el usuario agrega manualmente con "+ Agregar campo". */
export function DynamicField({
  field,
  value,
  onChange,
  onRemove,
}: {
  field: FieldDef;
  value: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
}) {
  return (
    <FieldWrapper
      label={
        onRemove ? (
          <span className="flex items-center justify-between">
            {field.label}
            <button
              type="button"
              onClick={onRemove}
              className="text-[10px] font-normal text-[var(--status-critical)] hover:underline"
            >
              Quitar
            </button>
          </span>
        ) : (
          field.label
        )
      }
    >
      {field.type === "select" ? (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecciona...</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      ) : field.type === "boolean" ? (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecciona...</option>
          <option value="Sí">Sí</option>
          <option value="No">No</option>
        </Select>
      ) : field.type === "textarea" ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input
          type={field.type === "number" ? "number" : "text"}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </FieldWrapper>
  );
}
