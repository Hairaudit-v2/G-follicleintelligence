import type { Metadata } from "next";
import Link from "next/link";

import { FiOsForgotPasswordForm } from "@/src/components/fi/os/FiOsForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password | Follicle Intelligence OS",
  robots: { index: false, follow: false },
};

export default function FollicleIntelligenceForgotPasswordPage() {
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
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-400/90">
            Follicle Intelligence OS
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Reset password</h1>
          <p className="mt-2 text-sm text-slate-400">
            We will email you a secure link to choose a new password.
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-500/15 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-md">
          <FiOsForgotPasswordForm />
        </div>
        <p className="mt-8 text-center text-xs text-slate-600">
          <Link href="/" className="text-slate-500 hover:text-slate-400 hover:underline">
            Follicle Intelligence home
          </Link>
        </p>
      </div>
    </div>
  );
}
