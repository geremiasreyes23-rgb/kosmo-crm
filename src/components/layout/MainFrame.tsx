"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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

  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto", !isMessenger && "p-4 md:p-6")}>
      {children}
    </div>
  );
}
