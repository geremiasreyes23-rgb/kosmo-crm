import { Card } from "./Card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Tone = "neutral" | "good" | "warning" | "critical";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[var(--brand-50)] text-[var(--brand-700)]",
  good: "bg-[var(--status-good-bg)] text-[var(--status-good)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  critical: "bg-[var(--status-critical-bg)] text-[var(--status-critical)]",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <Card className="group p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--ink-secondary)]">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--ink-primary)]">
            {value}
          </p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110",
            toneClasses[tone]
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </Card>
  );
}
