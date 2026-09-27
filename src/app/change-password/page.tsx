import { requireUser } from "@/lib/auth";
import { Starfield } from "@/components/brand/Starfield";
import { HolographicSphere } from "@/components/brand/HolographicSphere";
import { KosmoTextMark } from "@/components/brand/KosmoLogo";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChangePending: true });

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060f]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, #1b1440 0%, #0a0a1f 45%, #05060f 100%)",
        }}
      />
      <Starfield className="absolute inset-0" />

      <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="flex items-center gap-3">
          <HolographicSphere size={40} enableHover={false} />
          <KosmoTextMark fontSize={26} />
        </div>

        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="mb-5">
              <h1 className="text-lg font-semibold text-white">Crea tu contraseña</h1>
              <p className="text-sm text-white/60">
                Es tu primer ingreso: elige una contraseña nueva para tu cuenta.
              </p>
            </div>
            <ChangePasswordForm email={user.email} />
          </div>
        </div>
      </div>
    </div>
  );
}
