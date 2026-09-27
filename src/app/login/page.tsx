"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, Pencil } from "lucide-react";
import { Starfield } from "@/components/brand/Starfield";
import { KosmoTextMark } from "@/components/brand/KosmoLogo";
import { HolographicSphere } from "@/components/brand/HolographicSphere";
import { loginAction } from "./actions";

// Cuánto se queda visible el "Bienvenido {nombre}" antes de navegar — dale
// tiempo al usuario a leerlo pero sin sentirse una espera de verdad.
const WELCOME_DURATION_MS = 1500;

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "password" | "welcome">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [welcomeUser, setWelcomeUser] = useState<{ firstName: string; lastName: string } | null>(
    null
  );
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setError(null);
    setStep("password");
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await loginAction(email, password);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    // Login correcto — la sesión ya quedó creada server-side. En vez de que
    // la acción redirija de una vez, mostramos primero la pantalla de
    // bienvenida (esfera al centro + nombre) y navegamos nosotros al
    // terminar, ver el useEffect de abajo.
    setWelcomeUser({ firstName: result.firstName, lastName: result.lastName });
    setRedirectTo(result.redirectTo);
    setStep("welcome");
  }

  useEffect(() => {
    if (step !== "welcome" || !redirectTo) return;
    const timer = setTimeout(() => {
      router.push(redirectTo);
    }, WELCOME_DURATION_MS);
    return () => clearTimeout(timer);
  }, [step, redirectTo, router]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060f]">
      {/* Fondo — degradado espacial + halos de nebulosa + estrellas animadas */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, #1b1440 0%, #0a0a1f 45%, #05060f 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute -left-40 top-1/4 h-96 w-96 rounded-full opacity-30 blur-[100px]"
        style={{ background: "linear-gradient(135deg,#4d5bf9,#a855f7)" }}
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full opacity-20 blur-[110px]"
        style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}
      />
      <Starfield className="absolute inset-0" />

      {/* PLANTILLA DE PRUEBA — logo arriba, tarjeta de login debajo, los dos
          apilados y centrados en el medio de la pantalla (en vez del
          layout de dos columnas anterior). Fácil de revertir si no
          convence: era un flex-row de dos bloques, ahora es una sola
          columna centrada. */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-8 px-6 py-12">
        {step === "welcome" && welcomeUser ? (
          // Pantalla de bienvenida tras un login correcto — el resto
          // (wordmark, tarjeta, footer) desaparece de golpe al cambiar de
          // paso, y solo queda la esfera creciendo/asentándose en el centro
          // junto con el saludo, que entra un pelín después.
          <div className="flex flex-col items-center gap-5">
            <div className="animate-kosmo-welcome-in">
              <HolographicSphere size={140} enableHover={false} />
            </div>
            <div className="animate-kosmo-welcome-in-delay text-center">
              <p className="text-sm text-white/50">Bienvenido</p>
              <p className="text-2xl font-semibold text-white">
                {welcomeUser.firstName} {welcomeUser.lastName}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Logotipo KOSMO — esfera + wordmark apilados */}
            <div className="flex flex-col items-center gap-3.5">
              <HolographicSphere size={110} />
              <KosmoTextMark fontSize={34} />
            </div>

            {/* Tarjeta traslúcida con el formulario, en dos pasos */}
            <div className="w-full">
          <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="mb-5">
              <h1 className="text-lg font-semibold text-white">Bienvenido</h1>
              {step === "password" && (
                <p className="text-sm text-white/60">Ingresa tu contraseña para continuar</p>
              )}
            </div>

            {step === "email" ? (
              <form className="space-y-4" onSubmit={handleEmailSubmit}>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-white/70">
                    Correo o dirección interna
                  </span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                    <input
                      // No usamos type="email" con validación estricta —
                      // acepta lo mismo el correo real (nombre@gmail.com)
                      // que la dirección de correo interno
                      // (nombre.apellido@<dominio interno>), ver
                      // resolveLoginUser() en login/actions.ts.
                      type="text"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                      required
                      autoComplete="username"
                      placeholder="nombre@kosmocrm.com o nombre.apellido@alliance.internal"
                      className="h-10 w-full rounded-lg border border-white/15 bg-white/[0.06] pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/40 focus:bg-white/[0.1]"
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-medium text-[#0a0a1f] transition-colors hover:bg-white/90"
                >
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <form
                className="animate-kosmo-slide-down-in space-y-4"
                onSubmit={handlePasswordSubmit}
              >
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setError(null);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/[0.1]"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Mail className="h-4 w-4 shrink-0 text-white/50" />
                    <span className="truncate">{email}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-white/50">
                    <Pencil className="h-3 w-3" /> Cambiar
                  </span>
                </button>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-white/70">
                    Contraseña
                  </span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                    <input
                      type="password"
                      name="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="h-10 w-full rounded-lg border border-white/15 bg-white/[0.06] pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/40 focus:bg-white/[0.1]"
                    />
                  </div>
                </label>

                <div className="flex items-center text-sm">
                  <label className="flex items-center gap-2 text-white/70">
                    <input type="checkbox" className="rounded border-white/30 bg-white/10" />
                    Recordarme
                  </label>
                </div>

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
                  {pending ? "Ingresando..." : "Ingresar"}
                </button>

                <p className="text-center text-xs text-white/40">
                  ¿Olvidaste tu contraseña? Contacta a un administrador.
                </p>
              </form>
            )}
          </div>

          <p className="mt-5 text-center text-xs text-white/40">
            Autenticación real conectada a base de datos.
          </p>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
