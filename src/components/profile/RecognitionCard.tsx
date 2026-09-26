import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { RECOGNITION_TYPE_CONFIG } from "./recognitionTypes";
import type { RecognitionType } from "@prisma/client";

/**
 * "Enviar un reconocimiento" queda deshabilitado en el perfil PROPIO — no
 * tiene mucho sentido reconocerte a ti mismo — pero el server action
 * (recognition-actions.ts) y todo lo demás ya están listos para cuando
 * exista una vista de perfil de un compañero (p. ej. desde un futuro
 * directorio de equipo) y este botón pase a habilitarse ahí.
 */
export function RecognitionCard({
  counts,
}: {
  counts: { type: RecognitionType; count: number }[];
}) {
  return (
    <Card className="animate-kosmo-fade-in-up">
      <CardHeader className="pb-2">
        <CardTitle>Reconocimientos</CardTitle>
        <button
          type="button"
          disabled
          title="Podrás enviar reconocimientos desde el perfil de un compañero de equipo."
          className="text-xs font-medium text-[var(--brand-500)] transition-colors hover:text-[var(--brand-600)] disabled:cursor-not-allowed disabled:text-[var(--ink-muted)] disabled:hover:text-[var(--ink-muted)]"
        >
          Enviar un reconocimiento
        </button>
      </CardHeader>
      <CardContent>
        {counts.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">Aún no tiene reconocimientos.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {counts.map(({ type, count }) => {
              const config = RECOGNITION_TYPE_CONFIG[type];
              const Icon = config.icon;
              return (
                <div key={type} className="group relative">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-150 group-hover:-translate-y-0.5"
                    style={{ background: `${config.color}1a`, color: config.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {count > 1 && (
                    <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[var(--surface-card)] px-1 text-[10px] font-semibold text-[var(--ink-secondary)] shadow-sm ring-1 ring-[var(--border-hairline)]">
                      {count}
                    </span>
                  )}
                  {/* Tooltip minimal con CSS puro — sin JS, aparece en hover/focus */}
                  <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--ink-primary)] px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                    {config.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
