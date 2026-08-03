"use client";

import { useState, useTransition } from "react";

import { signPatientConsentViaTokenAction } from "@/src/lib/actions/fi-consent-public-actions";
import { isDraftConsentBody } from "@/src/lib/consents/consentAccessTokenCore";

export function PatientConsentSignForm({
  token,
  formTitle,
  formVersion,
  bodyHtml,
  bodyMd,
  clinicDevice,
}: {
  token: string;
  formTitle: string;
  formVersion: string;
  bodyHtml: string;
  bodyMd: string;
  clinicDevice: boolean;
}) {
  const [signedName, setSignedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const isDraft = isDraftConsentBody(bodyMd);

  if (done) {
    return (
      <div
        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-6 text-center"
        role="status"
      >
        <h2 className="text-lg font-semibold text-emerald-100">Thank you</h2>
        <p className="mt-2 text-sm text-emerald-100/90">
          This consent is recorded. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Digital consent
        </p>
        <h1 className="text-xl font-semibold text-slate-100">{formTitle}</h1>
        <p className="text-sm text-slate-400">Version {formVersion}</p>
      </header>

      {isDraft ? (
        <p
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
          role="status"
        >
          This form text is <strong>DRAFT — not legal-final</strong>. It has not been approved by
          legal counsel as final language.
        </p>
      ) : null}

      <article
        className="rounded-lg border border-white/[0.08] bg-[#0F1629]/80 p-4 text-sm text-slate-200 shadow-lg shadow-black/30"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      <form
        className="space-y-4 rounded-lg border border-white/[0.08] bg-[#0F1629]/60 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await signPatientConsentViaTokenAction({
              token,
              signedName,
              agreed,
              clinicDevice,
            });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setDone(true);
          });
        }}
      >
        <label className="block text-sm font-medium text-slate-200">
          Full legal name
          <input
            type="text"
            name="signedName"
            autoComplete="name"
            required
            maxLength={200}
            value={signedName}
            onChange={(e) => setSignedName(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-[#020617] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder="Type your full name"
            disabled={pending}
          />
        </label>

        <label className="flex items-start gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={pending}
            className="mt-1 h-4 w-4 rounded border-slate-600"
          />
          <span>I have read and agree to this consent form.</span>
        </label>

        {error ? (
          <p className="text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {pending ? "Recording…" : "Sign consent"}
        </button>
      </form>
    </div>
  );
}
