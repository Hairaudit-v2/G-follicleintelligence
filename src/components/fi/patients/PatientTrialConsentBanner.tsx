"use client";

import Link from "next/link";

import type { PatientTrialConsentGateView } from "@/src/lib/patients/patientTrialConsentShared";
import {
  buildPatientDocumentsTabHref,
  PATIENT_TRIAL_CONSENT_REQUIRED_MESSAGE,
} from "@/src/lib/patients/patientTrialConsentShared";

export function PatientTrialConsentBanner({
  tenantId,
  patientId,
  trialConsentGate,
  className,
}: {
  tenantId: string;
  patientId: string | null | undefined;
  trialConsentGate: PatientTrialConsentGateView | null | undefined;
  className?: string;
}) {
  if (!trialConsentGate?.required || trialConsentGate.satisfied) return null;

  const pid = patientId?.trim();
  const href = pid ? buildPatientDocumentsTabHref(tenantId, pid) : null;

  return (
    <p
      className={
        className ??
        "rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
      }
      role="status"
    >
      {PATIENT_TRIAL_CONSENT_REQUIRED_MESSAGE}{" "}
      {href ? (
        <Link href={href} className="font-semibold text-amber-50 underline">
          Open Documents tab
        </Link>
      ) : (
        <span className="font-semibold">Link a patient first.</span>
      )}
    </p>
  );
}