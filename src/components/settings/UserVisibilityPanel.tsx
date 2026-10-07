"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Copy, Eye, EyeOff, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PersonSelect, userOptions } from "@/components/ui/PersonSelect";
import { PersonAvatar } from "@/components/ui/PersonAvatar";
import { cn } from "@/lib/utils";
import { VISIBILITY_TREE, computeHiddenKeys, roleDefault, type VisibilityNode } from "@/lib/visibility";
import {
  copyUserVisibilityAction,
  resetUserVisibilityAction,
  setUserVisibilityAction,
} from "@/app/(app)/settings/visibility-actions";

export interface VisibilityUserRow {
  id: string;
  name: string;
  roleId: string;
  roleName: string;
}

type Choice = "inherit" | "show" | "hide";

/**
 * Configuración → Visibilidad por usuario. Para cada persona, qué módulos,
 * pestañas, secciones y campos ve — por encima de lo que dicta su rol.
 * Cada fila tiene tres opciones: "Según rol" (sin excepción), "Ver" y
 * "Ocultar". Ocultar algo oculta también todo lo que cuelga de ello.
 */
export function UserVisibilityPanel({
  users,
  roleModuleVisibility,
  overrides: initialOverrides,
  currentRoleName,
}: {
  users: VisibilityUserRow[];
  /** roleId → hrefs de módulos visibles para ese rol. */
  roleModuleVisibility: Record<string, string[]>;
  /** userId → { clave: visible } */
  overrides: Record<string, Record<string, boolean>>;
  currentRoleName: string;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState(users.find((u) => u.roleName !== "Super Admin")?.id ?? "");
  const [overrides, setOverrides] = useState(initialOverrides);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({ "group:modules": true, "module:/leads": true });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyFrom, setCopyFrom] = useState("");

  const user = users.find((u) => u.id === userId) ?? null;
  const isSuperAdmin = user?.roleName === "Super Admin";
  const locked = !user || isSuperAdmin || (user.roleName === "Admin" && currentRoleName !== "Super Admin");
  const roleModules = useMemo(() => new Set(user ? roleModuleVisibility[user.roleId] ?? [] : []), [user, roleModuleVisibility]);
  const userOverrides = useMemo(() => (user ? overrides[user.id] ?? {} : {}), [user, overrides]);
  const hidden = useMemo(
    () => new Set(user ? computeHiddenKeys(roleModules, userOverrides, isSuperAdmin) : []),
    [user, roleModules, userOverrides, isSuperAdmin]
  );
  const exceptionCount = Object.keys(userOverrides).length;

  async function choose(key: string, value: Choice) {
    if (!user || locked) return;
    const before = overrides;
    const nextForUser = { ...userOverrides };
    if (value === "inherit") delete nextForUser[key];
    else nextForUser[key] = value === "show";
    setOverrides({ ...overrides, [user.id]: nextForUser });
    setBusyKey(key);
    setError(null);
    const r = await setUserVisibilityAction({ userId: user.id, key, value });
    setBusyKey(null);
    if (!r.ok) {
      setOverrides(before);
      setError(r.error ?? "No se pudo guardar.");
    }
  }

  async function reset() {
    if (!user || locked) return;
    if (!window.confirm(`¿Quitar todas las excepciones de ${user.name}? Volverá a ver lo que dicta su rol.`)) return;
    const r = await resetUserVisibilityAction(user.id);
    if (!r.ok) return setError(r.error ?? "No se pudo restablecer.");
    setOverrides({ ...overrides, [user.id]: {} });
    router.refresh();
  }

  async function copy() {
    if (!user || locked || !copyFrom) return;
    const from = users.find((u) => u.id === copyFrom);
    if (!window.confirm(`¿Copiar la configuración de ${from?.name} a ${user.name}? Se reemplazan sus excepciones actuales.`)) return;
    const r = await copyUserVisibilityAction(copyFrom, user.id);
    if (!r.ok) return setError(r.error ?? "No se pudo copiar.");
    setOverrides({ ...overrides, [user.id]: { ...(overrides[copyFrom] ?? {}) } });
    setCopyFrom("");
    router.refresh();
  }

  const q = query.trim().toLowerCase();
  function matches(n: VisibilityNode): boolean {
    if (!q) return true;
    return n.label.toLowerCase().includes(q) || (n.children ?? []).some(matches);
  }

  function renderNode(n: VisibilityNode, depth: number): React.ReactNode {
    if (!matches(n)) return null;
    const hasChildren = !!n.children?.length;
    const expanded = !!q || !!open[n.key];
    const own = userOverrides[n.key];
    const choice: Choice = own === undefined ? "inherit" : own ? "show" : "hide";
    const isHidden = hidden.has(n.key);
    const roleValue = roleDefault(n.key, roleModules, isSuperAdmin);
    const hiddenByParent = isHidden && own !== false && (own === true || roleValue);

    return (
      <div key={n.key}>
        <div
          className={cn(
            "flex items-center gap-2 border-b border-[var(--border-hairline)] py-2 pr-3",
            isHidden && "bg-[var(--surface-sunken)]/60"
          )}
          style={{ paddingLeft: 12 + depth * 20 }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setOpen((p) => ({ ...p, [n.key]: !expanded }))}
              className="rounded p-0.5 text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]"
              aria-label={expanded ? "Contraer" : "Expandir"}
            >
              <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
            </button>
          ) : (
            <span className="w-5" />
          )}
          {isHidden ? (
            <EyeOff className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" />
          ) : (
            <Eye className="h-3.5 w-3.5 shrink-0 text-[var(--status-good)]" />
          )}
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-sm", n.kind === "field" ? "" : "font-medium", isHidden && "text-[var(--ink-muted)]")}>
              {n.label}
            </p>
            {(hiddenByParent || (choice === "inherit" && !roleValue)) && (
              <p className="text-[11px] text-[var(--ink-muted)]">
                {hiddenByParent ? "Oculto porque la sección superior está oculta" : "Oculto por su rol"}
              </p>
            )}
          </div>
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-[var(--border-hairline)] text-xs">
            {(
              [
                { v: "inherit", l: n.kind === "module" ? "Según rol" : "Predeterminado" },
                { v: "show", l: "Ver" },
                { v: "hide", l: "Ocultar" },
              ] as { v: Choice; l: string }[]
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                disabled={locked || busyKey === n.key}
                onClick={() => choice !== o.v && choose(n.key, o.v)}
                className={cn(
                  "px-2.5 py-1 font-medium transition-colors disabled:cursor-not-allowed",
                  choice === o.v
                    ? o.v === "hide"
                      ? "bg-[var(--status-critical)] text-white"
                      : o.v === "show"
                        ? "bg-[var(--status-good)] text-white"
                        : "bg-[var(--ink-primary)] text-[var(--surface-card)]"
                    : "bg-[var(--surface-card)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]"
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        {hasChildren && expanded && n.children!.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-4">
        <p className="mb-3 text-sm text-[var(--ink-secondary)]">
          Configura qué ve cada persona dentro del CRM, sin importar su rol: módulos del menú, pestañas, secciones y
          campos. Lo que se oculta tampoco se le exige al llenar formularios.
        </p>
        <div className="grid gap-3 md:grid-cols-[minmax(0,320px)_1fr] md:items-end">
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--ink-secondary)]">Usuario</p>
            <PersonSelect value={userId} onChange={setUserId} options={userOptions(users)} placeholder="Elige un usuario..." />
          </div>
          {user && (
            <div className="flex flex-wrap items-center gap-2">
              <PersonAvatar name={user.name} person={{ userId: user.id }} size={28} />
              <span className="text-sm font-medium">{user.name}</span>
              <Badge status="info">{user.roleName}</Badge>
              <Badge status={exceptionCount ? "warning" : "neutral"}>
                {exceptionCount ? `${exceptionCount} excepciones` : "Sin excepciones"}
              </Badge>
            </div>
          )}
        </div>

        {user && !locked && (
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--border-hairline)] pt-4">
            <div className="w-64">
              <p className="mb-1 text-xs font-medium text-[var(--ink-secondary)]">Copiar configuración de…</p>
              <PersonSelect
                size="sm"
                value={copyFrom}
                onChange={setCopyFrom}
                options={userOptions(users.filter((u) => u.id !== user.id && Object.keys(overrides[u.id] ?? {}).length > 0))}
                placeholder="Otra persona"
              />
            </div>
            <Button size="sm" variant="secondary" onClick={copy} disabled={!copyFrom}>
              <Copy className="h-4 w-4" /> Copiar
            </Button>
            <Button size="sm" variant="secondary" onClick={reset} disabled={!exceptionCount} className="ml-auto">
              <RotateCcw className="h-4 w-4" /> Restablecer a su rol
            </Button>
          </div>
        )}
        {user && locked && (
          <p className="mt-3 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--ink-muted)]">
            {isSuperAdmin
              ? "El Super Admin siempre ve todo; no se le pueden ocultar elementos."
              : "Solo un Super Admin puede configurar la visibilidad de un Admin."}
          </p>
        )}
        {error && <p className="mt-3 text-xs text-[var(--status-critical)]">{error}</p>}
      </div>

      {user && (
        <>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar módulo, sección o campo..."
              className="h-9 w-full rounded-full border border-[var(--border-hairline)] bg-[var(--surface-card)] pl-9 pr-3 text-sm outline-none focus:border-[var(--brand-500)]"
            />
          </div>

          {VISIBILITY_TREE.map((group) =>
            matches(group) ? (
              <div key={group.key} className="overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)]">
                <div className="border-b border-[var(--border-hairline)] bg-[var(--surface-sunken)] px-4 py-3">
                  <h3 className="text-sm font-semibold">{group.label}</h3>
                  {group.hint && <p className="text-xs text-[var(--ink-muted)]">{group.hint}</p>}
                </div>
                {group.children?.map((n) => renderNode(n, 0))}
              </div>
            ) : null
          )}
        </>
      )}
    </div>
  );
}
