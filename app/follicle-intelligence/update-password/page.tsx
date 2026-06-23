import type { Metadata } from "next";
import { Suspense } from "react";

import { FiOsUpdatePasswordForm } from "@/src/components/fi/os/FiOsUpdatePasswordForm";

export const metadata: Metadata = {
  title: "Set new password | Follicle Intelligence OS",
  robots: { index: false, follow: false },
};

export default function FollicleIntelligenceUpdatePasswordPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% 0%, rgba(34, 211, 238, 0.12), transparent 55%), radial-gradient(900px 500px at 100% 20%, rgba(56, 189, 248, 0.08), transparent 50%), linear-gradient(180deg, #020617 0%, #0f172a 45%, #020617 100%)",
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16 sm:px-8">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-400/90">Follicle Intelligence OS</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Choose a new password</h1>
        </div>
        <div className="rounded-2xl border border-cyan-500/15 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-md">
          <Suspense fallback={<p className="text-center text-sm text-slate-400">Verifying reset link…</p>}>
            <FiOsUpdatePasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
