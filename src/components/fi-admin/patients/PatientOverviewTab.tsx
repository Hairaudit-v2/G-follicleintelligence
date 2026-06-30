"use client";

import Link from "next/link";
import { CreditCard, Users, Activity } from "lucide-react";

import type { PatientDetailPayload } from "@/src/lib/patients/patientDetailLoader";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import type { PatientTimelineItem } from "@/src/lib/patients/timeline/patientTimelineTypes";
import type { PaymentRecordRow } from "@/src/lib/payments/paymentRecordModel";
import type { PatientJourneyStatus } from "@/src/lib/fiAdmin/patientJourneyStatus";
import { PatientIntelligenceSummary } from "./PatientIntelligenceSummary";

import { PatientBookNextAppointmentCard } from "@/src/components/fi/patients/shared/PatientBookNextAppointmentCard";
import { PatientConsultationsCard } from "@/src/components/fi/patients/shared/PatientConsultationsCard";
import { PatientPersonLeadHistoryCard } from "@/src/components/fi/patients/shared/PatientPersonLeadHistoryCard";
import { PatientPersonDetailsCard } from "@/src/components/fi/patients/PatientPersonDetailsCard";
import { PatientCasesCard } from "@/src/components/fi/patients/PatientCasesCard";
import { PaymentRecordPanel } from "@/src/components/fi-admin/payments/PaymentRecordPanel";

import {
  pwsCard,
  pwsCardFull,
  pwsCardPad,
  pwsLegacyCard,
  pwsTitle,
  pwsMeta,
  pwsLabel,
  pwsValue,
  pwsDivider,
  pwsEmpty,
  pwsCta,
} from "./patientWorkspaceStyles";

// ─── Workspace card header ───────────────────────────────────────────────────

function CardHeader({
  icon,
  title,
  meta,
  cta,
}: {
  icon?: React.ReactNode;
  title: string;
  meta?: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {icon && (
          <div className="mb-1 flex items-center gap-1.5">
            {icon}
            <span className={pwsLabel}>{title}</span>
          </div>
        )}
        {!icon && <h2 className={pwsTitle}>{title}</h2>}
        {meta && <p className={pwsMeta}>{meta}</p>}
      </div>
      {cta}
    </div>
  );
}

// ─── Treatment plan card ─────────────────────────────────────────────────────

function TreatmentPlanCard({
  tenantId,
  treatmentPlanSummary,
  consultations,
}: {
  tenantId: string;
  treatmentPlanSummary: string | null;
  consultations: PatientDetailPayload["consultations"];
}) {
  const latest = consultations[0] ?? null;

  return (
    <section className={pwsCardFull}>
      <CardHeader
        title="Treatment plan"
        meta="Current clinical direction and consultation status."
        cta={
          <Link href={`/fi-admin/${tenantId}/consultations/new`} className={pwsCta}>
            New consultation
          </Link>
        }
      />

      <dl className={`mt-4 grid gap-4 text-sm sm:grid-cols-2 ${pwsDivider} pt-4`}>
        <div>
          <dt className={pwsLabel}>Plan summary</dt>
          <dd className={`mt-1 ${pwsValue}`}>{treatmentPlanSummary ?? "Not documented yet."}</dd>
        </div>
        <div>
          <dt className={pwsLabel}>Latest consultation</dt>
          <dd className="mt-1">
            {latest ? (
              <Link
                href={`/fi-admin/${tenantId}/consultations/${latest.id}`}
                className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
              >
                {latest.consultation_type_label}
              </Link>
            ) : (
              <span className={pwsEmpty}>No consultations recorded.</span>
            )}
            {latest?.status && (
              <span className="ml-1.5 text-xs text-slate-500">· {latest.status}</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// ─── Timeline preview card ────────────────────────────────────────────────────

function timelineIcon(type: PatientTimelineItem["item_type"]): string {
  switch (type) {
    case "booking_scheduled":
    case "booking_completed":
      return "📅";
    case "lead_created":
    case "lead_converted":
      return "🔗";
    case "crm_activity":
      return "💬";
    case "clinical_details_updated":
      return "🩺";
    case "image_uploaded":
      return "📷";
    default:
      return "·";
  }
}

function TimelinePreviewCard({ items }: { items: PatientTimelineItem[] }) {
  const preview = items.slice(0, 5);

  return (
    <section className={pwsCardFull}>
      <h2 className={pwsTitle}>Recent activity</h2>
      {preview.length === 0 ? (
        <p className={`mt-3 ${pwsEmpty}`}>No activity recorded yet.</p>
      ) : (
        <ul className={`mt-3 divide-y ${pwsDivider.replace("border-t ", "divide-")}`}>
          {preview.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5 py-2.5">
              <span className="mt-0.5 shrink-0 text-sm leading-none" aria-hidden>
                {timelineIcon(item.item_type)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <span className={`text-sm font-medium ${pwsValue}`}>{item.title}</span>
                  )}
                  <time className="shrink-0 text-xs text-slate-500" dateTime={item.occurred_at}>
                    {item.occurred_at.slice(0, 10)}
                  </time>
                </div>
                {item.subtitle && (
                  <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Lead history compact card ────────────────────────────────────────────────

function LeadHistoryCompactCard({
  tenantId,
  patientId,
  items,
  activity,
}: {
  tenantId: string;
  patientId: string;
  items: PatientDetailPayload["personLeadHistory"];
  activity: PatientDetailPayload["personCrmActivity"];
}) {
  const linked = items.filter((i) => i.linkedToThisPatient).length;
  const prior = items.filter((i) => !i.linkedToThisPatient).length;

  return (
    <section className={pwsCard}>
      <div className={`${pwsCardPad} pb-0`}>
        <CardHeader
          icon={<Users className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
          title="Enquiries"
          meta={
            items.length === 0
              ? "No enquiries linked yet."
              : `${linked} linked · ${prior} prior enquir${prior !== 1 ? "ies" : "y"}`
          }
          cta={
            <Link href={`/fi-admin/${tenantId}/crm`} className="text-xs text-cyan-400 hover:text-cyan-300">
              CRM →
            </Link>
          }
        />
      </div>

      {items.length === 0 ? (
        <p className={`${pwsCardPad} pt-2 ${pwsEmpty}`}>No enquiries recorded yet.</p>
      ) : (
        <div className="mt-2">
          {/* Legacy white card — contained within the dark shell */}
          <PatientPersonLeadHistoryCard
            tenantId={tenantId}
            currentPatientId={patientId}
            items={items}
            activity={activity}
            compact
          />
        </div>
      )}
    </section>
  );
}

// ─── Payment snapshot card ────────────────────────────────────────────────────

function PaymentSnapshotCard({
  tenantId,
  patientId,
  operationalTodayYmd,
  initialPaymentRecords,
  canMutatePaymentRecords,
}: {
  tenantId: string;
  patientId: string;
  operationalTodayYmd: string;
  initialPaymentRecords: PaymentRecordRow[];
  canMutatePaymentRecords: boolean;
}) {
  return (
    <section className={pwsCard}>
      <div className={`${pwsCardPad} pb-0`}>
        <CardHeader
          icon={<CreditCard className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
          title="Payment records"
        />
      </div>
      <div className="mt-2">
        <PaymentRecordPanel
          tenantId={tenantId}
          todayYmd={operationalTodayYmd}
          paymentContext="other"
          patientId={patientId}
          initialRows={initialPaymentRecords}
          canMutate={canMutatePaymentRecords}
          noManualPaymentRecordsCopy="No payment records added yet."
        />
      </div>
    </section>
  );
}

// ─── Technical details accordion ─────────────────────────────────────────────

function TechnicalDetailsAccordion({
  tenantId,
  profile,
}: {
  tenantId: string;
  profile: PatientProfileFoundationData;
}) {
  return (
    <details className={`group ${pwsLegacyCard}`}>
      <summary
        className={`flex cursor-pointer select-none items-center justify-between gap-2 ${pwsCardPad} py-3 text-sm font-medium text-slate-400 outline-none transition-colors hover:text-slate-200`}
      >
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" aria-hidden />
          More records
        </div>
        <span className="text-xs text-slate-400">Person record · Clinical patients</span>
      </summary>
      <div className={`space-y-4 border-t border-white/[0.05] px-4 pb-4 pt-3`}>
        <p className="text-xs text-slate-400">
          Raw person and clinical patient records — for diagnostics and data reconciliation.
        </p>
        <PatientPersonDetailsCard data={profile} />
        <PatientCasesCard tenantId={tenantId} data={profile} />
      </div>
    </details>
  );
}

// ─── Legacy card wrapper (for embedded white components in left column) ───────

function LegacyCardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`overflow-hidden ${pwsLegacyCard}`}>
      {children}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PatientOverviewTab({
  tenantId,
  patientId,
  payload,
  profile,
  journeyStatus,
  operationalTodayYmd,
  initialPaymentRecords,
  canMutatePaymentRecords,
}: {
  tenantId: string;
  patientId: string;
  payload: PatientDetailPayload;
  profile: PatientProfileFoundationData;
  journeyStatus: PatientJourneyStatus;
  operationalTodayYmd: string;
  initialPaymentRecords: PaymentRecordRow[];
  canMutatePaymentRecords: boolean;
}) {
  const { treatmentPlanSummary, consultations, personLeadHistory, personCrmActivity } = payload;
  const timelineItems = profile.patientTimeline.items;

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* ── Left: Active patient journey ─────────────────────────── */}
      <div className="space-y-4 lg:col-span-7">
        {/* 1. Book next appointment — legacy white component, contained */}
        <LegacyCardShell>
          <PatientBookNextAppointmentCard
            tenantId={tenantId}
            patientId={patientId}
            personId={payload.personId}
            displayName={payload.displayName}
            primaryLead={payload.primaryLead}
            bookings={payload.bookingRows}
            groupingNowIso={payload.groupingNowIso}
          />
        </LegacyCardShell>

        {/* 2. Treatment plan */}
        <TreatmentPlanCard
          tenantId={tenantId}
          treatmentPlanSummary={treatmentPlanSummary}
          consultations={consultations}
        />

        {/* 3. Consultations — legacy white component, contained */}
        <LegacyCardShell>
          <PatientConsultationsCard tenantId={tenantId} consultations={consultations} compact />
        </LegacyCardShell>

        {/* 4. Recent activity */}
        <TimelinePreviewCard items={timelineItems} />
      </div>

      {/* ── Right: Intelligence & admin ───────────────────────────── */}
      <div className="space-y-4 lg:col-span-5">
        {/* 1. Patient intelligence */}
        <PatientIntelligenceSummary
          tenantId={tenantId}
          patientId={patientId}
          journeyStatus={journeyStatus}
          clinical={profile.clinicalDetails.row}
          consultations={consultations}
          totalLeads={profile.summary.totalLeads}
          upcomingBookings={profile.summary.upcomingBookings}
          completedBookings={profile.summary.completedBookings}
          imageCount={profile.patientImages.counts.total}
        />

        {/* 2. Enquiry history */}
        <LeadHistoryCompactCard
          tenantId={tenantId}
          patientId={patientId}
          items={personLeadHistory}
          activity={personCrmActivity}
        />

        {/* 3. Payment snapshot */}
        <PaymentSnapshotCard
          tenantId={tenantId}
          patientId={patientId}
          operationalTodayYmd={operationalTodayYmd}
          initialPaymentRecords={initialPaymentRecords}
          canMutatePaymentRecords={canMutatePaymentRecords}
        />

        {/* 4. Technical details — collapsed by default */}
        <TechnicalDetailsAccordion tenantId={tenantId} profile={profile} />
      </div>
    </div>
  );
}
