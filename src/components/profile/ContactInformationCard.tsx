import {
  Briefcase,
  Building2,
  Cake,
  Globe,
  Laptop,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  UserCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { ProfileContactField } from "@/app/(app)/profile/data";

const FIELD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Nombre: User,
  Apellido: User,
  Cargo: Briefcase,
  Departamento: Building2,
  Supervisor: UserCheck,
  "Fecha de nacimiento": Cake,
  "Teléfono interno": Phone,
  Ciudad: MapPin,
  "Idioma de las notificaciones": Globe,
  "Formato de trabajo": Laptop,
  "Correo electrónico": Mail,
  "Rol del sistema": ShieldCheck,
};

function ContactField({ field }: { field: ProfileContactField }) {
  const Icon = FIELD_ICONS[field.label] ?? User;
  return (
    <div className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--surface-hover)]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-[var(--ink-muted)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
          {field.label}
        </p>
        <p
          className={
            field.value
              ? "truncate text-sm font-medium text-[var(--ink-primary)]"
              : "truncate text-sm text-[var(--ink-muted)]"
          }
        >
          {field.value || "No especificado"}
        </p>
      </div>
    </div>
  );
}

/**
 * Ficha de información de contacto — grid de dos columnas en pantallas
 * anchas (no una tabla: cada campo es su propia "celda" con ícono, así se
 * lee más como una ficha de empleado que como una hoja de cálculo).
 */
export function ContactInformationCard({ fields }: { fields: ProfileContactField[] }) {
  return (
    <Card className="animate-kosmo-fade-in-up overflow-hidden">
      <CardHeader className="border-b border-[var(--border-hairline)]">
        <CardTitle>Información de contacto</CardTitle>
      </CardHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {fields.map((field, i) => (
          <div
            key={field.label}
            className={`border-b border-[var(--border-hairline)] last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 ${
              i % 2 === 0 ? "sm:border-r" : ""
            }`}
          >
            <ContactField field={field} />
          </div>
        ))}
      </div>
    </Card>
  );
}
