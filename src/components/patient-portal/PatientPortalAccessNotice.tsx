import Link from "next/link";

import type { PatientPortalAccessState } from "@/src/lib/patientPortal/patientPortalAccess.server";

const SUPPORT_EMAIL = "support@follicleintelligence.ai";

export function PatientPortalAccessNotice({
  tenantId,
  access,
}: {
  tenantId: string;
  access: Exclude<PatientPortalAccessState, { status: "linked" }>;
}) {
  const clinicLabel = access.clinicName ?? "your clinic";
  const signInHref = `/patient/${tenantId}/sign-in`;

  if (access.status === "unauthenticated") {
    return (
      <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-5 text-sm text-slate-200">
        <p className="text-base font-semibold text-slate-100">Sign in to view your medications</p>
        <p className="mt-2 leading-relaxed text-slate-300">
          Use the email address {clinicLabel} gave you when your patient portal was set up.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={signInHref}
            className="inline-flex rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
          >
            Sign in
          </Link>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-white/25 hover:text-white"
          >
            Contact support
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-5 text-sm text-amber-100">
      <p className="text-base font-semibold text-amber-50">Your portal is not linked yet</p>
      <p className="mt-2 leading-relaxed text-amber-100/90">
        You are signed in, but {clinicLabel} has not connected your account to a patient record yet. Please contact the
        clinic reception team and ask them to link your portal access.
      </p>
      <p className="mt-3 text-amber-100/80">
        Need help? Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-amber-50 underline underline-offset-2">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
      <p className="mt-4">
        <Link href={signInHref} className="text-sm font-medium text-cyan-300 hover:text-cyan-200 hover:underline">
          Try a different account
        </Link>
      </p>
    </div>
  );
}