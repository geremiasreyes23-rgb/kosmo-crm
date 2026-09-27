"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setNotificationSettingAction } from "@/app/(app)/settings/catalogs-actions";
import type { NotificationSettingDef } from "@/lib/notificationSettings";

export interface NotificationSettingRow {
  type: string;
  enabled: boolean;
  thresholdValue: number | null;
}

const UNIT_LABEL: Record<"hours" | "days", string> = {
  hours: "horas antes",
  days: "días de margen",
};

export function NotificationSettingsPanel({
  defs,
  initialValues,
  canManage,
}: {
  defs: NotificationSettingDef[];
  initialValues: Record<string, NotificationSettingRow>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busyType, setBusyType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, number>>({});

  async function persist(def: NotificationSettingDef, enabled: boolean, thresholdValue: number | null) {
    setBusyType(def.type);
    setError(null);
    const result = await setNotificationSettingAction({ type: def.type, enabled, thresholdValue });
    setBusyType(null);
    if (!result.ok) {
      setError(result.error ?? "No se pudo actualizar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-[var(--status-critical-bg)] bg-[var(--status-critical-bg)] px-3 py-2 text-xs text-[var(--status-critical)]">
          {error}
        </p>
      )}

      <div className="space-y-2">
        {defs.map((def) => {
          const current = initialValues[def.type];
          const draft = drafts[def.type] ?? current?.thresholdValue ?? def.defaultThreshold ?? 0;
          return (
            <div key={def.type} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-hairline)] px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{def.label}</p>
                <p className="text-xs text-[var(--ink-muted)]">{def.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {def.unit && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      disabled={!canManage || !current?.enabled || busyType === def.type}
                      value={draft}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [def.type]: Number(e.target.value) }))}
                      onBlur={() => persist(def, current?.enabled ?? def.defaultEnabled, draft)}
                      className="h-8 w-16 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-2 text-center text-sm outline-none focus:border-[var(--brand-500)] disabled:opacity-50"
                    />
                    <span className="text-xs text-[var(--ink-muted)]">{UNIT_LABEL[def.unit]}</span>
                  </div>
                )}
                <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={current?.enabled ?? def.defaultEnabled}
                    disabled={!canManage || busyType === def.type}
                    onChange={(e) => persist(def, e.target.checked, current?.thresholdValue ?? def.defaultThreshold)}
                  />
                  <span className="absolute inset-0 rounded-full bg-[var(--surface-sunken)] transition-colors peer-checked:bg-[var(--brand-500)] peer-disabled:opacity-50" />
                  <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {!canManage && (
        <p className="text-xs text-[var(--ink-muted)]">Solo Admin y Super Admin pueden editar esta configuración.</p>
      )}
    </div>
  );
}
