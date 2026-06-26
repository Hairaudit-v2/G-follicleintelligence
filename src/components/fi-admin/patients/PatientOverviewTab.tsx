"use client";

import Link from "next/link";
import { Brain, CreditCard, Users, Activity } from "lucide-react";

import type { PatientDetailPayload } from "@/src/lib/patients/patientDetailLoader";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import type { PatientTimelineItem } from "@/src/lib/patients/timeline/patientTimelineTypes";
import type { PaymentRecordRow } from "@/src/lib/payments/paymentRecordModel";
import { formatClinicalScalesSummary } from "@/src/lib/patients/hairLossScales";

import { PatientBookNextAppointmentCard } from "@/src/components/fi/patients/shared/PatientBookNextAppointmentCard";
import { PatientConsultationsCard } from "@/src/components/fi/patients/shared/PatientConsultationsCard";
import { PatientPersonLeadHistoryCard } from "@/src/components/fi/patients/shared/PatientPersonLeadHistoryCard";
import { PatientPersonDetailsCard } from "@/src/components/fi/patients/PatientPersonDetailsCard";
import { PatientCasesCard } from "@/src/components/fi/patients/PatientCasesCard";
import { PaymentRecordPanel } from "@/src/components/fi-admin/payments/PaymentRecordPanel";

// ─── shared card shell ──────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${className ?? ""}`}>
      {children}
    </section>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-gray-900">{children}</h2>;
}

function CardMeta({ children }: { children: React.ReactNode }) {
  return <p className="mt-0.5 text-xs text-gray-500">{children}</p>;
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
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <CardTitle>Treatment plan</CardTitle>
          <CardMeta>Current clinical direction and consultation status</CardMeta>
        </div>
        <Link
          href={`/fi-admin/${tenantId}/consultations/new`}
          className="shrink-0 rounded border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          New consultation
        </Link>
      </div>

      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Plan summary</dt>
          <dd className="mt-1 font-medium text-gray-900">{treatmentPlanSummary ?? "Not documented yet"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">Latest consultation</dt>
          <dd className="mt-1 text-gray-800">
            {latest ? (
              <Link
                href={`/fi-admin/${tenantId}/consultations/${latest.id}`}
                className="font-medium text-blue-700 hover:underline"
              >
                {latest.consultation_type_label}
              </Link>
            ) : (
              "No consultations yet"
            )}
            {latest?.status ? (
              <span className="ml-1.5 text-xs text-gray-500">· {latest.status}</span>
            ) : null}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

// ─── Timeline preview card ────────────────────────────────────────────────────

function timelineItemIcon(type: PatientTimelineItem["item_type"]): string {
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
    <Card>
      <CardTitle>Recent activity</CardTitle>
      {preview.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No recent activity yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {preview.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5 py-2.5">
              <span className="mt-0.5 shrink-0 text-sm" aria-hidden>
                {timelineItemIcon(item.item_type)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  {item.href ? (
                    <Link href={item.href} className="text-sm font-medium text-blue-700 hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-gray-900">{item.title}</span>
                  )}
                  <time className="shrink-0 text-xs text-gray-400" dateTime={item.occurred_at}>
                    {item.occurred_at.slice(0, 10)}
                  </time>
                </div>
                {item.subtitle && <p className="text-xs text-gray-500">{item.subtitle}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Patient intelligence card ────────────────────────────────────────────────

function PatientIntelligenceCard({
  tenantId,
  patientId,
  profile,
}: {
  tenantId: string;
  patientId: string;
  profile: PatientProfileFoundationData;
}) {
  const s = profile.summary;
  const clinical = profile.clinicalDetails.row;
  const patternLine = clinical
    ? formatClinicalScalesSummary({
        norwood_scale: clinical.norwood_scale,
        ludwig_scale: clinical.ludwig_scale,
        hairline_pattern: clinical.hairline_pattern,
        primary_concern: clinical.primary_concern,
      })
    : null;

  const base = `/fi-admin/${tenantId}/patients/${patientId}`;

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-cyan-700" aria-hidden />
            <CardTitle>Patient intelligence</CardTitle>
          </div>
          <CardMeta>FI OS signals for this patient</CardMeta>
        </div>
        <Link
          href={`${base}/twin`}
          className="shrink-0 rounded border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-800 hover:bg-cyan-100"
        >
          Open Twin
        </Link>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2.5">
        <Metric label="Linked leads" value={String(s.totalLeads)} />
        <Metric label="Clinical patients" value={String(s.totalCases)} />
        <Metric label="Upcoming visits" value={String(s.upcomingBookings)} />
        <Metric label="Completed visits" value={String(s.completedBookings)} />
      </dl>

      {patternLine ? (
        <div className="mt-3 rounded-md border border-indigo-200 bg-indigo-50/80 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">Hair loss pattern</p>
          <p className="mt-0.5 text-sm font-medium text-indigo-950">{patternLine}</p>
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 p-2.5">
          <p className="text-xs text-gray-400">Hair loss assessment not documented yet.</p>
        </div>
      )}

      <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
        <Link
          href={`${base}/twin`}
          className="flex-1 rounded border border-gray-200 bg-gray-50 py-1.5 text-center text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Patient Twin
        </Link>
        <Link
          href={`/fi-admin/${tenantId}/surgery-readiness`}
          className="flex-1 rounded border border-gray-200 bg-gray-50 py-1.5 text-center text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Surgery readiness
        </Link>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-100 bg-gray-50 p-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{value}</dd>
    </div>
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
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-gray-500" aria-hidden />
            <CardTitle>Enquiries</CardTitle>
          </div>
          <CardMeta>
            {items.length === 0
              ? "No CRM enquiries linked yet."
              : `${linked} linked · ${prior} prior enquiry${prior !== 1 ? "s" : ""}`}
          </CardMeta>
        </div>
        <Link href={`/fi-admin/${tenantId}/crm`} className="text-xs text-blue-600 hover:underline">
          CRM →
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">No enquiries recorded yet.</p>
      ) : (
        <div className="mt-3">
          <PatientPersonLeadHistoryCard
            tenantId={tenantId}
            currentPatientId={patientId}
            items={items}
            activity={activity}
            compact
          />
        </div>
      )}
    </Card>
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
    <Card>
      <div className="flex items-center gap-1.5">
        <CreditCard className="h-3.5 w-3.5 text-gray-500" aria-hidden />
        <CardTitle>Payment records</CardTitle>
      </div>
      <div className="mt-3">
        <PaymentRecordPanel
          tenantId={tenantId}
          todayYmd={operationalTodayYmd}
          paymentContext="other"
          patientId={patientId}
          initialRows={initialPaymentRecords}
          canMutate={canMutatePaymentRecords}
          noManualPaymentRecordsCopy="No manual payment records linked to this patient yet."
        />
      </div>
    </Card>
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
    <details className="group rounded-lg border border-gray-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-gray-600 outline-none hover:bg-gray-50">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" aria-hidden />
          More records
        </div>
        <span className="text-xs text-gray-400">Person record · Clinical patients</span>
      </summary>
      <div className="space-y-4 border-t border-gray-100 px-4 pb-4 pt-3">
        <p className="text-xs text-gray-400">
          Raw person and clinical patient records. For diagnostics and data reconciliation.
        </p>
        <PatientPersonDetailsCard data={profile} />
        <PatientCasesCard tenantId={tenantId} data={profile} />
      </div>
    </details>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PatientOverviewTab({
  tenantId,
  patientId,
  payload,
  profile,
  operationalTodayYmd,
  initialPaymentRecords,
  canMutatePaymentRecords,
}: {
  tenantId: string;
  patientId: string;
  payload: PatientDetailPayload;
  profile: PatientProfileFoundationData;
  operationalTodayYmd: string;
  initialPaymentRecords: PaymentRecordRow[];
  canMutatePaymentRecords: boolean;
}) {
  const { treatmentPlanSummary, consultations, personLeadHistory, personCrmActivity } = payload;
  const timelineItems = profile.patientTimeline.items;

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* ── Left: Active patient journey ── */}
      <div className="space-y-4 lg:col-span-7">
        {/* 1. Book next appointment */}
        <PatientBookNextAppointmentCard
          tenantId={tenantId}
          patientId={patientId}
          personId={payload.personId}
          displayName={payload.displayName}
          primaryLead={payload.primaryLead}
          bookings={payload.bookingRows}
          groupingNowIso={payload.groupingNowIso}
        />

        {/* 2. Treatment plan */}
        <TreatmentPlanCard
          tenantId={tenantId}
          treatmentPlanSummary={treatmentPlanSummary}
          consultations={consultations}
        />

        {/* 3. Consultations */}
        <PatientConsultationsCard tenantId={tenantId} consultations={consultations} compact />

        {/* 4. Recent activity */}
        <TimelinePreviewCard items={timelineItems} />
      </div>

      {/* ── Right: Intelligence & admin ── */}
      <div className="space-y-4 lg:col-span-5">
        {/* 1. Patient intelligence */}
        <PatientIntelligenceCard tenantId={tenantId} patientId={patientId} profile={profile} />

        {/* 2. Enquiry & lead history */}
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

        {/* 4. Technical details (collapsed) */}
        <TechnicalDetailsAccordion tenantId={tenantId} profile={profile} />
      </div>
    </div>
  );
}
