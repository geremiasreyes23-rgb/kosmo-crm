import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function StatusCard({ online, lastActiveLabel }: { online: boolean; lastActiveLabel: string }) {
  return (
    <Card className="animate-kosmo-fade-in-up">
      <CardHeader className="pb-2">
        <CardTitle>Estado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {online && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--status-good)] opacity-60" />
            )}
            <span
              className="relative inline-flex h-2.5 w-2.5 rounded-full transition-colors duration-300"
              style={{ background: online ? "var(--status-good)" : "var(--ink-muted)" }}
            />
          </span>
          <span className="text-sm font-medium text-[var(--ink-primary)]">
            {online ? "En línea" : "Desconectado"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
          <Clock className="h-3.5 w-3.5" />
          <span>Última actividad: {lastActiveLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}
