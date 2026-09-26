"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Menu, Building2, LogOut, KeyRound, ChevronDown, UserCircle, Loader2, Users, UserPlus, FileCheck2, Building } from "lucide-react";
import { logoutAction } from "@/app/(app)/logout-action";
import { ClockWidget } from "./ClockWidget";
import { ProfileModal } from "@/components/profile/ProfileModal";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LiveClock } from "./LiveClock";
import { CHROME_GRADIENT_STYLE } from "./chromeGradient";
import { cn } from "@/lib/utils";
import { globalSearchAction, type GlobalSearchResult, type GlobalSearchHit } from "@/lib/globalSearch";
import type { LucideIcon } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import type { TimeEntryPayload } from "@/app/(app)/clock-actions";
import type { ProfileViewData } from "@/app/(app)/profile/data";

export function Header({
  user,
  initialTimeEntry,
  profileData,
}: {
  user: SessionUser;
  initialTimeEntry: TimeEntryPayload | null;
  profileData: ProfileViewData;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  const fullName = `${user.firstName} ${user.lastName}`;

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  // Buscador global — busca clientes (por nombre, teléfono, email o ID
  // visible), leads, pólizas y carriers, con debounce para no disparar una
  // consulta en cada tecla. El resultado se agrupa por categoría en un
  // dropdown, igual que el buscador de Gmail/Linear.
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResult | null>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSearchOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(() => {
      globalSearchAction(q)
        .then((r) => setResults(r))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const hasResults =
    !!results &&
    (results.clients.length > 0 ||
      results.leads.length > 0 ||
      results.policies.length > 0 ||
      results.carriers.length > 0);

  function goTo(href: string) {
    setSearchOpen(false);
    setQuery("");
    setResults(null);
    router.push(href);
  }

  return (
    <header
      className="grid h-16 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-4 px-4 md:px-6"
      style={CHROME_GRADIENT_STYLE}
    >
      <button className="col-start-1 rounded-md p-1.5 text-white/70 hover:bg-white/10 md:hidden">
        <Menu className="h-5 w-5" />
      </button>

      {/* Centrada de verdad en el ancho de la barra (no solo en el espacio
          que sobra a la izquierda) — mismo efecto de Gmail: pastilla sutil
          en reposo que "se eleva" (fondo sólido + sombra) al enfocarse.
          col-start-2 explícito: el botón hamburguesa de la izquierda tiene
          `md:hidden`, y un elemento en `display:none` sale por completo del
          flujo de Grid (no reserva su columna) — sin esta posición fija, en
          desktop el buscador y el grupo de la derecha se corrían una
          columna hacia la izquierda, dejando la 3ra columna vacía. */}
      <div className="col-start-2 flex justify-center">
        <div className="relative w-full max-w-xl" ref={searchRef}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Buscar cliente, lead, póliza, carrier..."
            className="h-10 w-full rounded-full border border-transparent bg-white/[0.08] pl-10 pr-9 text-sm text-white outline-none placeholder:text-white/40 transition-all duration-150 hover:bg-white/[0.12] focus:border-white/15 focus:bg-[#1c1030] focus:shadow-[0_4px_18px_rgba(0,0,0,0.45)]"
          />
          {searchLoading && (
            <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/50" />
          )}

          {searchOpen && query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[26rem] overflow-y-auto rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] shadow-xl">
              {!results && searchLoading && (
                <p className="px-4 py-6 text-center text-sm text-[var(--ink-muted)]">Buscando...</p>
              )}
              {results && !hasResults && !searchLoading && (
                <p className="px-4 py-6 text-center text-sm text-[var(--ink-muted)]">
                  Sin resultados para &quot;{query}&quot;.
                </p>
              )}
              {results && hasResults && (
                <div className="py-1.5">
                  <SearchGroup icon={Users} label="Clientes" hits={results.clients} onSelect={goTo} />
                  <SearchGroup icon={UserPlus} label="Leads" hits={results.leads} onSelect={goTo} />
                  <SearchGroup icon={FileCheck2} label="Pólizas" hits={results.policies} onSelect={goTo} />
                  <SearchGroup icon={Building} label="Carriers" hits={results.carriers} onSelect={goTo} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="col-start-3 flex items-center gap-4">
        <div className="hidden items-center gap-2 border-r border-white/15 pr-4 sm:flex">
          <Building2 className="h-4 w-4 text-white/50" />
          <span className="text-sm font-medium text-white/80">Alliance Insurance</span>
        </div>
        <NotificationBell />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-white/10"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-100)] text-xs font-semibold text-[var(--brand-700)]">
                {initials}
              </div>
            )}
            <LiveClock className="hidden text-sm font-medium tabular-nums text-white sm:block" />
            <ChevronDown className="hidden h-3.5 w-3.5 text-white/50 sm:block" />
          </button>

          {/* Antes este panel se montaba y desmontaba con `{menuOpen && (...)}`
              — cada vez que se cerraba, el ClockWidget de adentro perdía su
              estado (por eso el contador volvía a 00:00:00 al reabrir).
              Ahora queda SIEMPRE montado y solo se oculta con CSS (opacidad +
              escala + `pointer-events-none`), así el reloj sigue corriendo
              por dentro aunque el menú esté cerrado y no hace falta pedirle
              nada al servidor para que se vea bien al reabrir — instantáneo. */}
          <div
            aria-hidden={!menuOpen}
            className={cn(
              "absolute right-0 top-full z-30 mt-2 w-80 origin-top-right overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] shadow-xl transition-[opacity,transform] duration-150 ease-out",
              menuOpen
                ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                : "pointer-events-none -translate-y-1 scale-95 opacity-0"
            )}
          >
              <div className="flex items-center gap-2.5 border-b border-[var(--border-hairline)] px-3.5 py-3">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-100)] text-xs font-semibold text-[var(--brand-700)]">
                    {initials}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--ink-primary)]">{fullName}</p>
                  <p className="truncate text-xs text-[var(--ink-muted)]">{user.email}</p>
                </div>
              </div>
              <ClockWidget initialEntry={initialTimeEntry} />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setProfileOpen(true);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
              >
                <UserCircle className="h-4 w-4" /> Mi perfil
              </button>
              <a
                href="/change-password"
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink-primary)]"
              >
                <KeyRound className="h-4 w-4" /> Cambiar contraseña
              </a>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-[var(--status-critical)] transition-colors hover:bg-[var(--status-critical-bg)]"
                >
                  <LogOut className="h-4 w-4" /> Cerrar sesión
                </button>
              </form>
          </div>
        </div>
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} data={profileData} />
    </header>
  );
}

function SearchGroup({
  icon: Icon,
  label,
  hits,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  hits: GlobalSearchHit[];
  onSelect: (href: string) => void;
}) {
  if (hits.length === 0) return null;
  return (
    <div className="px-1.5 py-1">
      <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
        {label}
      </p>
      {hits.map((hit) => (
        <button
          key={hit.id}
          type="button"
          onClick={() => onSelect(hit.href)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
        >
          <Icon className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--ink-primary)]">{hit.label}</p>
            {hit.sublabel && (
              <p className="truncate text-xs text-[var(--ink-muted)]">{hit.sublabel}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
