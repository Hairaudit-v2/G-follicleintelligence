"use client";

import { useFormStatus } from "react-dom";

import { fiOsPasswordSignInAction } from "@/lib/actions/fi-os-auth-actions";

function FiOsLoginFields() {
  const { pending } = useFormStatus();
  const fieldClass =
    "w-full rounded-lg border border-slate-600/80 bg-slate-950/80 px-3 py-2.5 text-slate-100 outline-none ring-cyan-500/40 placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <>
      <div>
        <label htmlFor="fi-os-email" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
          Work email
        </label>
        <input
          id="fi-os-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          className={fieldClass}
          placeholder="you@clinic.com"
        />
      </div>
      <div>
        <label htmlFor="fi-os-password" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
          Password
        </label>
        <input
          id="fi-os-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className={fieldClass}
          placeholder="••••••••"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:from-cyan-500 hover:to-sky-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Signing in…" : "Sign in to OS"}
      </button>
    </>
  );
}

export function FiOsLoginForm({ safeNextPath }: { safeNextPath: string }) {
  return (
    <form action={fiOsPasswordSignInAction} className="space-y-5">
      {safeNextPath ? <input type="hidden" name="next" value={safeNextPath} /> : null}
      <FiOsLoginFields />
    </form>
  );
}