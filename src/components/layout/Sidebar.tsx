"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { KosmoTextMark } from "@/components/brand/KosmoLogo";
import { HolographicSphere } from "@/components/brand/HolographicSphere";
import { CHROME_GRADIENT_STYLE } from "./chromeGradient";
import { useMessenger } from "@/components/messenger/MessengerProvider";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  CheckSquare,
  CalendarDays,
  DollarSign,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  MessageCircle,
  Mail,
  FolderOpen,
  Newspaper,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  color: string;
  badge: number;
  /** Rutas adicionales bajo las que este item debe verse activo (ej. CRM). */
  matchRoutes?: string[];
};

// Leads, Clientes, Ventas y Pólizas viven cada uno en su propia ruta
// (/leads, /clients, /sales, /policies) para no romper enlaces ni acciones
// de servidor ya existentes, pero en la barra lateral aparecen como un
// único apartado "CRM": al entrar a cualquiera de esas rutas, el item se
// resalta como activo, y dentro de la página (ver CrmSubNav.tsx) se
// muestran los 4 apartados como secciones internas del CRM.
const CRM_ROUTES = ["/leads", "/clients", "/sales", "/policies"];

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "#3987e5", badge: 0 },
  { href: "/messages", label: "Mensajes", icon: MessageCircle, color: "#20b6ac", badge: 0 },
  { href: "/mail", label: "Correo", icon: Mail, color: "#5b6bd6", badge: 0 },
  { href: "/leads", label: "CRM", icon: Users, color: "#eb6834", badge: 0, matchRoutes: CRM_ROUTES },
  { href: "/activities", label: "Actividades", icon: ListChecks, color: "#e87ba4", badge: 0 },
  { href: "/tasks", label: "Tareas", icon: CheckSquare, color: "#3987e5", badge: 0 },
  { href: "/calendar", label: "Calendario", icon: CalendarDays, color: "#1baf7a", badge: 0 },
  { href: "/commissions", label: "Comisiones", icon: DollarSign, color: "#eda100", badge: 0 },
  { href: "/documents", label: "Documentos", icon: FolderOpen, color: "#8b5cf6", badge: 0 },
  { href: "/feed", label: "Feed", icon: Newspaper, color: "#9061f9", badge: 0 },
  { href: "/reports", label: "Reportes", icon: BarChart3, color: "#eb6834", badge: 0 },
  { href: "/settings", label: "Configuración", icon: Settings, color: "#898781", badge: 0 },
];

const RAIL_WIDTH = 72; // ancho recogido — solo íconos
const FULL_WIDTH = 240; // ancho expandido — íconos + etiquetas
const STORAGE_KEY = "kosmo:sidebar-collapsed";

export function Sidebar({ showReports }: { showReports: boolean }) {
  const pathname = usePathname();
  const { totalUnread } = useMessenger();
  const visibleNavItems = showReports ? navItems : navItems.filter((item) => item.href !== "/reports");
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      // localStorage no disponible (modo privado, etc.) — se ignora.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // no-op
      }
      return next;
    });
  }

  // Expandido "de verdad" (modo fijo) o temporalmente al pasar el mouse
  // por encima estando recogido — igual que el comportamiento de Bitrix24.
  const expanded = !collapsed || hovering;
  const flyout = collapsed && hovering;

  return (
    <aside
      className="relative hidden shrink-0 md:block"
      style={{ width: collapsed ? RAIL_WIDTH : FULL_WIDTH }}
      onMouseEnter={() => collapsed && setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Logo + "KOSMO" — franja de ancho fijo SIEMPRE completo y SIEMPRE
          visible, sin importar si el riel de abajo está recogido o
          expandido. Antes vivía adentro del mismo div que se angosta a
          RAIL_WIDTH junto con la nav, así que el texto desaparecía
          (`{expanded && <KosmoTextMark/>}`) en cuanto se recogía la barra
          sin el mouse encima. Ahora es su propia franja aparte, superpuesta
          (z-40, por encima del riel y del Header) — cuando el riel está
          recogido, esta franja sobresale un poco hacia la derecha, sobre el
          Header, en vez de cortar el logo. Una sola instancia de la esfera,
          siempre montada — antes había dos (`expanded` renderizaba una y
          `!expanded` otra), así que cada vez que el mouse entraba/salía del
          riel recogido, React desmontaba una y montaba la otra: eso
          recreaba el contexto WebGL y el reloj de Three.js desde cero en
          cada hover, de ahí el spam en consola ("THREE.Clock: This module
          has been deprecated..."), repetido una vez por cada paso del
          mouse. Con una sola instancia que no se destruye nunca (ya no
          depende de `expanded` en absoluto), el efecto de montaje corre una
          sola vez, para siempre. */}
      <div
        className="absolute left-0 top-0 z-40 flex h-16 w-60 shrink-0 items-center gap-2.5 px-5"
        style={CHROME_GRADIENT_STYLE}
      >
        <HolographicSphere size={30} enableHover={false} className="shrink-0" />
        <KosmoTextMark fontSize={21} />
      </div>

      <div
        className={cn(
          "absolute bottom-0 left-0 top-16 z-30 flex flex-col overflow-hidden transition-[width] duration-200 ease-out",
          flyout && "shadow-[8px_0_40px_rgba(0,0,0,0.35)]"
        )}
        style={{
          width: expanded ? FULL_WIDTH : RAIL_WIDTH,
          ...CHROME_GRADIENT_STYLE,
        }}
      >
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {visibleNavItems.map(({ href, label, icon: Icon, color, badge: staticBadge, matchRoutes }) => {
            const active = matchRoutes
              ? matchRoutes.some((route) => pathname === route || pathname?.startsWith(route + "/"))
              : pathname === href || pathname?.startsWith(href + "/");
            const badge = href === "/messages" ? totalUnread : staticBadge;
            return (
              <Link
                key={href}
                href={href}
                title={expanded ? undefined : label}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  !expanded && "justify-center px-0",
                  active ? "bg-white/10 text-white" : "text-[#a4aecb] hover:bg-white/5 hover:text-white"
                )}
              >
                <span
                  className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: active ? color : "transparent" }}
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: active ? "#fff" : color }} />
                  {!expanded && !!badge && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#e04f4f] ring-2 ring-[#0a0a1f]" />
                  )}
                </span>
                {expanded && <span className="whitespace-nowrap">{label}</span>}
                {expanded && !!badge && (
                  <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#e04f4f] px-1.5 text-[11px] font-semibold text-white">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir barra lateral" : "Recoger barra lateral"}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#a4aecb] transition-colors hover:bg-white/5 hover:text-white",
              !expanded && "justify-center px-0"
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" />
            ) : (
              <PanelLeftClose className="h-4 w-4 shrink-0" />
            )}
            {expanded && <span className="whitespace-nowrap">Recoger</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
