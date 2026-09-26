"use client";

import { useState, type FormEvent } from "react";
import { Lock, ArrowRight } from "lucide-react";
import { changePasswordAction } from "@/app/change-password/actions";

export function ChangePasswordForm({ email }: { email: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await changePasswordAction(newPassword, confirmPassword);
    // Si la acción tuvo éxito, ya redirigió al servidor y este componente se
    // desmonta — solo llegamos aquí cuando hubo un error de validación.
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-sm text-white/70">
        {email}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-white/70">Nueva contraseña</span>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoFocus
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
            className="h-10 w-full rounded-lg border border-white/15 bg-white/[0.06] pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/40 focus:bg-white/[0.1]"
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-white/70">Confirmar contraseña</span>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Repite la contraseña"
            className="h-10 w-full rounded-lg border border-white/15 bg-white/[0.06] pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/40 focus:bg-white/[0.1]"
          />
        </div>
      </label>

      {error && (
        <p className="animate-kosmo-fade-in rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-medium text-[#0a0a1f] transition-colors hover:bg-white/90 disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar y continuar"} <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
