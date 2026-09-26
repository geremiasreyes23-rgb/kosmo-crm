"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useNotifications } from "./NotificationProvider";
import { notificationHref, notificationTypeMeta } from "@/lib/notificationMeta";

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-white/70 hover:bg-white/10"
        aria-label="Notificaciones"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--status-critical)] px-0.5 text-[9px] font-semibold leading-none text-white ring-2 ring-[#140b34]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <div
        aria-hidden={!open}
        className={cn(
          "absolute right-0 top-full z-30 mt-2 w-96 origin-top-right overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] shadow-xl transition-[opacity,transform] duration-150 ease-out",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-95 opacity-0"
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-3.5 py-3">
          <p className="text-sm font-semibold text-[var(--ink-primary)]">Notificaciones</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)] hover:text-[var(--brand-500)]"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="px-3.5 py-8 text-center text-sm text-[var(--ink-muted)]">
              No tenés notificaciones todavía.
            </p>
          )}
          {notifications.map((n) => {
            const Icon = notificationTypeMeta(n.type).icon;
            const href = notificationHref(n);
            return (
              <Link
                key={n.id}
                href={href}
                onClick={() => {
                  markRead(n.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-start gap-2.5 border-b border-[var(--border-hairline)] px-3.5 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--surface-hover)]",
                  !n.isRead && "bg-[var(--brand-50)]/50"
                )}
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-100)] text-[var(--brand-700)]">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-[var(--ink-primary)]">{n.title}</span>
                    {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-500)]" />}
                  </span>
                  <span className="block truncate text-xs text-[var(--ink-secondary)]">{n.message}</span>
                  <span className="mt-0.5 block text-[11px] text-[var(--ink-muted)]">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
