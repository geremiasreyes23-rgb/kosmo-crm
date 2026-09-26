import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { formatBytes, formatRelativeTime, formatTime } from "@/lib/utils";
import type { FeedSidebarDataVM } from "@/types";
import { AtSign, Activity, CalendarDays, Paperclip } from "lucide-react";

function WidgetLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mt-2 block text-xs font-medium text-[var(--brand-500)] hover:underline">
      {label}
    </Link>
  );
}

export function FeedSidebarColumn({ data }: { data: FeedSidebarDataVM }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <AtSign size={14} /> Menciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.mentions.length === 0 ? (
            <p className="text-xs text-[var(--ink-secondary)]">Sin menciones recientes.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.mentions.map((m) => (
                <li key={m.id}>
                  <Link href={m.href} className="block">
                    <p className="text-xs font-medium text-[var(--ink-primary)]">{m.fromName}</p>
                    <p className="truncate text-xs text-[var(--ink-secondary)]">{m.excerpt || "Te mencionó"}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <WidgetLink href="/feed?filter=mentions" label="Ver todas" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Activity size={14} /> Actividad reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length === 0 ? (
            <p className="text-xs text-[var(--ink-secondary)]">Sin actividad reciente.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.recentActivity.map((item) => (
                <li key={item.id}>
                  <Link href={item.href ?? "/feed"} className="block">
                    <p className="text-xs font-medium text-[var(--ink-primary)]">{item.label}</p>
                    <p className="text-xs text-[var(--ink-secondary)]">{formatRelativeTime(item.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <WidgetLink href="/feed?filter=system" label="Ver todas" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <CalendarDays size={14} /> Próximos eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.upcomingEvents.length === 0 ? (
            <p className="text-xs text-[var(--ink-secondary)]">Sin eventos próximos.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.upcomingEvents.map((ev) => (
                <li key={ev.id}>
                  <p className="text-xs font-medium text-[var(--ink-primary)]">{ev.title}</p>
                  <p className="text-xs text-[var(--ink-secondary)]">
                    {formatRelativeTime(ev.startsAt)} · {formatTime(ev.startsAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <WidgetLink href="/calendar" label="Ver calendario" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Paperclip size={14} /> Archivos compartidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.sharedFiles.length === 0 ? (
            <p className="text-xs text-[var(--ink-secondary)]">Sin archivos compartidos.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.sharedFiles.map((f) => (
                <li key={f.id}>
                  <Link href={`/feed#post-${f.postId}`} className="block">
                    <p className="truncate text-xs font-medium text-[var(--ink-primary)]">{f.fileName}</p>
                    <p className="text-xs text-[var(--ink-secondary)]">
                      {formatBytes(f.sizeBytes)} · {formatRelativeTime(f.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <WidgetLink href="/feed" label="Ver todos" />
        </CardContent>
      </Card>
    </div>
  );
}
