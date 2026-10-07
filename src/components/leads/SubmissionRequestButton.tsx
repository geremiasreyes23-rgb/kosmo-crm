"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { requestSubmissionAction } from "@/app/(app)/submissions/actions";

/** Ficha del lead → "Enviar a Envíos": lo pone en la cola del panel Envíos. */
export function SubmissionRequestButton({ leadId, resend }: { leadId: string; resend?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const r = await requestSubmissionAction(leadId);
    setBusy(false);
    if (!r.ok) {
      window.alert(r.error ?? "No se pudo enviar.");
      return;
    }
    router.refresh();
  }
  return (
    <Button size="sm" variant="secondary" onClick={go} disabled={busy}>
      <Send className="h-4 w-4" /> {busy ? "Enviando..." : resend ? "Reenviar a Envíos" : "Enviar a Envíos"}
    </Button>
  );
}
