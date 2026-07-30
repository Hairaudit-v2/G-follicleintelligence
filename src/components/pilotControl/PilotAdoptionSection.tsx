"use client";

import { SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { PilotAdoptionResponse } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import {
  formatCountOrDash,
  formatRateOrDash,
} from "@/src/lib/pilotControl/ui/pilotControlFormatters";
import { ADOPTION_EMPTY_COHORT_MESSAGE } from "@/src/lib/pilotControl/ui/pilotControlUiConstants";

function confidenceLabel(c: string): string {
  switch (c) {
    case "live_verified":
      return "Live verified";
    case "live_partial":
      return "Live partial";
    case "synthetic_only":
      return "Synthetic only";
    case "snapshot_derived":
      return "Snapshot-derived";
    case "source_unavailable":
      return "Source unavailable";
    default:
      return "Insufficient evidence";
  }
}

export function PilotAdoptionSection({
  adoption,
}: {
  adoption: PilotAdoptionResponse | null;
}) {
  if (!adoption || adoption.confidence.overall === "insufficient_evidence") {
    return (
      <section className="space-y-3" aria-labelledby="pilot-adoption-heading">
        <SectionHeader
          id="pilot-adoption-heading"
          title="Adoption and engagement"
          description="Workflow adoption metrics from operational events — not page views."
        />
        <p className="whitespace-pre-line rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
          {ADOPTION_EMPTY_COHORT_MESSAGE}
        </p>
      </section>
    );
  }

  const cards: Array<{ key: string; label: string; value: string; note?: string }> = [
    {
      key: "invited",
      label: "Invited",
      value: formatCountOrDash(adoption.cohort.invitedPatients.value),
    },
    {
      key: "activated",
      label: "Activated",
      value: formatCountOrDash(adoption.cohort.activatedPatients.value),
    },
    {
      key: "activationRate",
      label: "Activation rate",
      value: formatRateOrDash(adoption.cohort.activationRate.value),
      note: "activated ÷ invited",
    },
    {
      key: "patientActions",
      label: "Patient actions completed",
      value: formatCountOrDash(adoption.patient.patientActionsCompleted.value),
    },
    {
      key: "clinicActions",
      label: "Clinic actions completed",
      value: formatCountOrDash(adoption.staff.clinicActionsCompleted.value),
    },
    {
      key: "stalled",
      label: "Patients stalled",
      value: formatCountOrDash(adoption.journey.patientsStalled.value),
    },
    {
      key: "blockerResolution",
      label: "Blocker resolution rate",
      value: formatRateOrDash(adoption.blockers.resolutionRate.value),
    },
    {
      key: "notifDelivery",
      label: "Notification delivery",
      value: formatRateOrDash(adoption.patient.notificationDeliveryRate.value),
      note: "delivered ÷ outcomes",
    },
    {
      key: "manualFallback",
      label: "Manual channel fallbacks",
      value: formatCountOrDash(adoption.staff.manualFallbackCount.value),
    },
    {
      key: "staffOpeners",
      label: "Staff Control Centre use",
      value: formatCountOrDash(adoption.staff.controlCentreOpeners.value),
    },
  ];

  return (
    <section className="space-y-3" aria-labelledby="pilot-adoption-heading">
      <SectionHeader
        id="pilot-adoption-heading"
        title="Adoption and engagement"
        description="Operational workflow metrics. Synthetic activity is excluded from live rates."
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded border border-white/10 px-2 py-1 text-slate-300">
          Evidence: {confidenceLabel(adoption.confidence.overall)}
        </span>
        <span className="text-slate-500">
          Live events {adoption.confidence.liveEventCount} · Synthetic{" "}
          {adoption.confidence.syntheticEventCount}
        </span>
      </div>
      {adoption.confidence.overall === "synthetic_only" ? (
        <p className="text-xs text-amber-200/80">
          Synthetic-only metrics are labelled and do not satisfy live pilot evidence.
        </p>
      ) : null}
      {adoption.confidence.missingEvents.length > 0 ? (
        <p className="text-xs text-slate-500">
          Missing event coverage: {adoption.confidence.missingEvents.slice(0, 6).join(", ")}
          {adoption.confidence.missingEvents.length > 6 ? "…" : ""}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.key}
            className="rounded-lg border border-white/[0.06] bg-[#141C33]/45 px-3 py-2"
          >
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{c.label}</div>
            <div className="text-lg font-semibold tabular-nums text-slate-100">{c.value}</div>
            {c.note ? <div className="text-[10px] text-slate-500">{c.note}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
