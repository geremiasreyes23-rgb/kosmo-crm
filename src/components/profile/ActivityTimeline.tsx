import { Award, LogIn, Pencil, Camera, Activity as ActivityIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { ProfileActivityItem } from "@/app/(app)/profile/data";

const KIND_CONFIG: Record<
  ProfileActivityItem["kind"],
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  login: { icon: LogIn, color: "#2a78d6" },
  avatar: { icon: Camera, color: "#4a3aa7" },
  profile: { icon: Pencil, color: "#1baf7a" },
  recognition_sent: { icon: Award, color: "#eda100" },
  other: { icon: ActivityIcon, color: "#898781" },
};

export function ActivityTimeline({ items }: { items: ProfileActivityItem[] }) {
  return (
    <Card className="animate-kosmo-fade-in-up">
      <CardHeader className="pb-2">
        <CardTitle>Actividad reciente</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">Aún no hay actividad reciente.</p>
        ) : (
          <ul className="space-y-0">
            {items.map((item, i) => {
              const { icon: Icon, color } = KIND_CONFIG[item.kind];
              const isLast = i === items.length - 1;
              return (
                <li key={`${item.kind}-${item.when}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
                  {!isLast && (
                    <span
                      className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-[var(--border-grid)]"
                      aria-hidden="true"
                    />
                  )}
                  <div
                    className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `${color}1a`, color }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="text-sm text-[var(--ink-primary)]">{item.description}</p>
                    <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{item.when}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
