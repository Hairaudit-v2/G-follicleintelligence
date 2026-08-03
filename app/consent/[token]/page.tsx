import type { Metadata } from "next";

import { PatientConsentSignForm } from "@/src/components/fi/consents/PatientConsentSignForm";
import {
  isDraftConsentBody,
  patientSafeMessageForTokenOutcome,
  renderConsentBodyMarkdownSafe,
} from "@/src/lib/consents/consentAccessTokenCore";
import { resolveConsentToken } from "@/src/lib/consents/consentAccessToken.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign consent",
  robots: { index: false, follow: false },
};

function ConsentShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#020617] text-slate-100">
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
        <p className="mb-8 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
          Follicle Intelligence
        </p>
        {children}
      </div>
    </div>
  );
}

export default async function PublicConsentSignPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token: rawParam } = await params;
  const sp = (await searchParams) ?? {};
  const deviceRaw = Array.isArray(sp.device) ? sp.device[0] : sp.device;
  const clinicDevice = String(deviceRaw ?? "").trim().toLowerCase() === "clinic";

  // Token may be URL-encoded in the path segment.
  let token = rawParam?.trim() ?? "";
  try {
    token = decodeURIComponent(token);
  } catch {
    // keep raw
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <ConsentShell>
        <div className="text-center">
          <h1 className="text-lg font-semibold">Link unavailable</h1>
          <p className="mt-2 text-sm text-slate-400">
            {patientSafeMessageForTokenOutcome("not_found")}
          </p>
        </div>
      </ConsentShell>
    );
  }

  const resolved = await resolveConsentToken(token);

  if (!resolved.ok) {
    return (
      <ConsentShell>
        <div className="rounded-lg border border-white/[0.08] bg-[#0F1629]/80 px-4 py-8 text-center">
          <h1 className="text-lg font-semibold text-slate-100">
            {resolved.outcome === "already_signed"
              ? "Already signed"
              : resolved.outcome === "expired"
                ? "Link expired"
                : "Link unavailable"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">{resolved.message}</p>
        </div>
      </ConsentShell>
    );
  }

  const bodyHtml = renderConsentBodyMarkdownSafe(resolved.bodyMd);
  // Touch draft check for SSR consistency (banner is also in client form).
  void isDraftConsentBody(resolved.bodyMd);

  return (
    <ConsentShell>
      <PatientConsentSignForm
        token={token}
        formTitle={resolved.formTitle}
        formVersion={resolved.formVersion}
        bodyHtml={bodyHtml}
        bodyMd={resolved.bodyMd}
        clinicDevice={clinicDevice}
      />
    </ConsentShell>
  );
}
