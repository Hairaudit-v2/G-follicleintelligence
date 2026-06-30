"use client";

import { useFormStatus } from "react-dom";
import Link from "next/link";

import { fiOsPasswordSignInAction } from "@/lib/actions/fi-os-auth-actions";

function PatientPortalSignInFields({ clinicName }: { clinicName: string | null }) {
  const { pending } = useFormStatus();
  const fieldClass =
    "w-full rounded-lg border border-slate-600/80 bg-slate-950/80 px-3 py-2.5 text-slate-100 outline-none ring-cyan-500/40 placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <>
      <p className="text-sm text-slate-400">
        {clinicName ? (
          <>
            Sign in to access your medications at <span className="font-medium text-slate-200">{clinicName}</span>.
          </>
        ) : (
          "Sign in with the email address your clinic provided."
        )}
      </p>
      <div>
        <label htmlFor="patient-portal-email" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
          Email
        </label>
        <input
          id="patient-portal-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          className={fieldClass}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="patient-portal-password" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
          Password
        </label>
        <input
          id="patient-portal-password"
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
        className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:from-cyan-500 hover:to-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-slate-400">
        <Link href="/follicle-intelligence/forgot-password" className="text-cyan-400/90 hover:text-cyan-300 hover:underline">
          Forgot password?
        </Link>
      </p>
    </>
  );
}

function patientPortalLoginErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "invalid_credentials":
      return "Invalid email or password. Check your credentials and try again.";
    case "missing_credentials":
      return "Enter both email and password.";
    case "server_misconfigured":
      return "Sign-in is temporarily unavailable. Please try again later.";
    default:
      return "Sign-in failed. Check your credentials and try again.";
  }
}

export function PatientPortalSignInForm({
  tenantId,
  clinicName,
  returnPath,
  errorCode,
}: {
  tenantId: string;
  clinicName: string | null;
  returnPath: string;
  errorCode?: string;
}) {
  const err = patientPortalLoginErrorMessage(errorCode);

  return (
    <form action={fiOsPasswordSignInAction} className="space-y-5">
      <input type="hidden" name="next" value={returnPath} />
      <input type="hidden" name="errorReturn" value={`/patient/${tenantId}/sign-in`} />
      {err ? (
        <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {err}
        </div>
      ) : null}
      <PatientPortalSignInFields clinicName={clinicName} />
      <p className="border-t border-slate-700/60 pt-4 text-center text-xs text-slate-500">
        Clinic staff should use the{" "}
        <Link href="/follicle-intelligence/login" className="text-slate-400 hover:text-slate-300 hover:underline">
          FI OS sign-in page
        </Link>
        .
      </p>
      <p className="text-center text-xs text-slate-500">
        <Link href={`/patient/${tenantId}/medications`} className="text-slate-400 hover:text-slate-300 hover:underline">
          Back to medications
        </Link>
      </p>
    </form>
  );
}