import Link from "next/link";

import { fiOsPasswordSignInAction } from "@/lib/actions/fi-os-auth-actions";

function loginErrorMessage(code: string | undefined): string | null {
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

function accessNoticeMessage(code: string | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "no_fi_access":
      return "This account is not provisioned for Follicle Intelligence OS. Contact your administrator.";
    case "no_tenant_access":
      return "You do not have access to that clinic workspace.";
    case "no_audit_access":
      return "You do not have HairAudit administrator access.";
    default:
      return null;
  }
}

export function FiOsLoginScreen({
  errorCode,
  noticeCode,
  safeNextPath,
}: {
  errorCode?: string;
  noticeCode?: string;
  safeNextPath: string;
}) {
  const err = loginErrorMessage(errorCode);
  const notice = accessNoticeMessage(noticeCode);

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
        <div className="mb-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-400/90">Follicle Intelligence</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Operating System</h1>
          <p className="mt-2 text-sm text-slate-400 sm:text-base">Hair Restoration Operating System</p>
        </div>

        <div className="rounded-2xl border border-cyan-500/15 bg-slate-900/70 p-8 shadow-2xl shadow-cyan-950/40 backdrop-blur-md">
          <p className="mb-6 text-center text-sm text-slate-400">
            Clinical staff and platform operators: sign in with your Follicle Intelligence OS credentials.
          </p>

          {err ? (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100"
            >
              {err}
            </div>
          ) : null}

          {notice ? (
            <div
              role="status"
              className="mb-6 rounded-lg border border-amber-500/25 bg-amber-950/35 px-4 py-3 text-sm text-amber-100"
            >
              {notice}
            </div>
          ) : null}

          <form action={fiOsPasswordSignInAction} className="space-y-5">
            {safeNextPath ? <input type="hidden" name="next" value={safeNextPath} /> : null}
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
                className="w-full rounded-lg border border-slate-600/80 bg-slate-950/80 px-3 py-2.5 text-slate-100 outline-none ring-cyan-500/40 placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-2"
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
                className="w-full rounded-lg border border-slate-600/80 bg-slate-950/80 px-3 py-2.5 text-slate-100 outline-none ring-cyan-500/40 placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-2"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:from-cyan-500 hover:to-sky-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            >
              Sign in to OS
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3 border-t border-slate-700/60 pt-6 text-center text-sm text-slate-400">
            <Link href="/follicle-intelligence/forgot-password" className="text-cyan-400/90 hover:text-cyan-300 hover:underline">
              Forgot password?
            </Link>
            <p className="text-xs text-slate-500">
              Patient portals and marketing pages use separate sign-in flows. This page is for FI OS staff only.
            </p>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} Follicle Intelligence — secure clinical infrastructure.
        </p>
      </div>
    </div>
  );
}
