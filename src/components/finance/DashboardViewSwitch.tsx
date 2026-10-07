"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Loader2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "general", label: "Dashboard General", short: "General", icon: LayoutDashboard, href: "/dashboard" },
  { key: "finance", label: "Control Financiero", short: "Finanzas", icon: Wallet, href: "/dashboard?vista=finanzas" },
] as const;

/**
 * Selector entre las dos perspectivas del Dashboard. Cambia la vista sin
 * salir de la página (misma ruta, mismo layout, sin mover el scroll); solo
 * lo ve quien tiene acceso al Control Financiero.
 */
export function DashboardViewSwitch({ active }: { active: "general" | "finance" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="mb-5 flex items-center gap-3">
      <div
        role="tablist"
        aria-label="Vista del dashboard"
        className="relative inline-flex rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-1 shadow-sm"
      >
        <span
          aria-hidden
          className="absolute bottom-1 top-1 rounded-xl bg-[var(--brand-500)] shadow-md transition-[left,width] duration-300 ease-out"
          style={{ left: active === "general" ? 4 : "50%", width: "calc(50% - 4px)" }}
        />
        {VIEWS.map((v) => {
          const isActive = v.key === active;
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => !isActive && startTransition(() => router.push(v.href, { scroll: false }))}
              className={cn(
                "relative z-10 flex min-w-[9.5rem] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors sm:min-w-[12rem]",
                isActive ? "text-white" : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
              )}
            >
              <v.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{v.label}</span>
              <span className="sm:hidden">{v.short}</span>
            </button>
          );
        })}
      </div>
      {pending && <Loader2 className="h-4 w-4 animate-spin text-[var(--ink-muted)]" />}
    </div>
  );
}
