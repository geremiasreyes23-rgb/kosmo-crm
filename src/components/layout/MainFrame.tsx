"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EyeOff } from "lucide-react";
import { keysForPath } from "@/lib/visibility";
import { useHiddenKeys } from "@/components/visibility/VisibilityProvider";

/**
 * Envoltorio del contenido dentro de <main> (ver AppShell). La mayoría de
 * las páginas necesitan el padding estándar (p-4/md:p-6) para separarse
 * del borde del panel — pero Mensajería ya arma su propio panel de chat
 * de borde a borde (ConversationList + ChatPanel ocupando el 100% del
 * alto), así que ese padding le agregaba un marco blanco extra alrededor
 * que no pertenece al diseño de chat. Acá, según la ruta activa, se le
 * quita el padding solo a Mensajería para que cubra el <main> completo —
 * el resto de las páginas no cambia.
 */
export function MainFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isMessenger = pathname === "/messages" || pathname?.startsWith("/messages/");
  // Visibilidad por persona: si el módulo (o la pestaña del CRM) está oculto
  // para este usuario, tampoco se puede entrar escribiendo la URL.
  const hidden = useHiddenKeys();
  const blocked = !!pathname && keysForPath(pathname).some((k) => hidden.has(k));
  if (blocked) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--ink-muted)]">
            <EyeOff className="h-6 w-6" />
          </span>
          <h2 className="text-base font-semibold text-[var(--ink-primary)]">Esta sección no está disponible</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Tu usuario no tiene acceso a este apartado. Si lo necesitas, pídeselo a un administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto", !isMessenger && "p-4 md:p-6")}>
      {children}
    </div>
  );
}
