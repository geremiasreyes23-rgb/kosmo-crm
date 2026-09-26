"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, UserCheck, Handshake, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CrmTab = {
  href: string;
  label: string;
  icon: LucideIcon;
  color: string;
};

const CRM_TABS: CrmTab[] = [
  { href: "/leads", label: "Leads", icon: Users, color: "#eb6834" },
  { href: "/clients", label: "Clientes", icon: UserCheck, color: "#1baf7a" },
  { href: "/sales", label: "Ventas", icon: Handshake, color: "#eda100" },
  { href: "/policies", label: "Pólizas", icon: ShieldCheck, color: "#4a3aa7" },
];

/**
 * Barra de navegación interna del apartado "CRM". Leads, Clientes, Ventas
 * y Pólizas viven cada uno en su propia ruta (no se movieron para no
 * romper enlaces ni acciones de servidor existentes), pero visualmente
 * ahora se presentan como si se "entrara" a un único apartado CRM y estas
 * cuatro fueran sus secciones internas — tal como lo pidió el usuario.
 */
export function CrmSubNav() {
  const pathname = usePathname();

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-[var(--border-hairline)] pb-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        CRM
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {CRM_TABS.map(({ href, label, icon: Icon, color }) => {
          const active = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "text-white"
                  : "text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
              )}
              style={active ? { backgroundColor: color } : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
