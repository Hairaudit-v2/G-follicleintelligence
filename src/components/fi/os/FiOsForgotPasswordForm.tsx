"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { fiOsRequestPasswordResetAction } from "@/lib/actions/fi-os-auth-actions";

export function FiOsForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setMessage(null);
        setError(null);
        startTransition(() => {
          void (async () => {
            try {
              const r = await fiOsRequestPasswordResetAction(fd);
              if (r.ok) {
                setMessage(
                  "If an account exists for that email, we sent a reset link. Check your inbox and spam folder."
                );
              } else {
                setError(r.error);
              }
            } catch {
              setError("Could not start password recovery. Try again or contact support.");
            }
          })();
        });
      }}
    >
      <div>
        <label
          htmlFor="reset-email"
          className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400"
        >
          Work email
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          className="w-full rounded-lg border border-slate-600/80 bg-slate-950/80 px-3 py-2.5 text-slate-100 outline-none ring-cyan-500/40 focus:border-cyan-500/50 focus:ring-2 disabled:opacity-70"
          placeholder="you@clinic.com"
        />
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/25 bg-emerald-950/35 px-4 py-3 text-sm text-emerald-100"
        >
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:from-cyan-500 hover:to-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>

      <p className="text-center text-sm text-slate-400">
        <Link
          href="/follicle-intelligence/login"
          className="text-cyan-400/90 hover:text-cyan-300 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
