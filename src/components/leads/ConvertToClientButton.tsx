"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { convertLeadToClientAction } from "@/app/(app)/leads/actions";

/** Botón "Convertir a cliente" del detalle de un lead (Fase 4, sección 6.B
 * del brief) — componente cliente porque necesita estado de carga/error y
 * redirigir al cliente recién creado, cosas que un Server Component no
 * puede hacer directamente. */
export function ConvertToClientButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const result = await convertLeadToClientAction(leadId);
    if (!result.ok || !result.clientId) {
      setError(result.error ?? "No se pudo convertir el lead.");
      setPending(false);
      return;
    }
    router.push(`/clients/${result.clientId}`);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={handleClick} disabled={pending}>
        <ArrowRightCircle className="h-4 w-4" /> {pending ? "Convirtiendo..." : "Convertir a cliente"}
      </Button>
      {error && <p className="text-xs text-[var(--status-critical)]">{error}</p>}
    </div>
  );
}
