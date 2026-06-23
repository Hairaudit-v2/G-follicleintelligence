import Link from "next/link";
import { ArrowRight, CheckCircle2, Stethoscope } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { DoctorPrescriptionWorkspace } from "@/src/components/fi-admin/doctor-workspace/DoctorPrescriptionWorkspace";
import { DoctorSystemDiagnostics } from "@/src/components/fi-admin/doctor-workspace/DoctorSystemDiagnostics";
import type { DoctorWorkspaceBundle } from "@/src/lib/doctorOs/doctorWorkspaceLoader.server";
import {
  buildDoctorClinicalTimeline,
  buildDoctorPatientReviewQueue,
  buildDoctorPrescriptionWorkspace,
  buildDoctorPriorities,
  buildDoctorSnapshotCards,
  buildDoctorTreatmentApprovals,
  doctorAttentionSeverityClass,
  doctorWorkspaceLinkButtonClass,
} from "@/src/lib/fiAdmin/doctorWorkspacePresentation";
import type { FiPatientPrescriptionRow } from "@/src/lib/prescribing/fiPrescribingTypes";

function DoctorWorkspacePrimaryActions({ base }: { base: string }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Link href={`${base}/patients`} className={doctorWorkspaceLinkButtonClass}>
        Open PatientOS
      </Link>
      <Link href={`${base}/consultations`} className={doctorWorkspaceLinkButtonClass}>
        Open Consultations
      </Link>
      <Link href={`${base}/surgery-os`} className={doctorWorkspaceLinkButtonClass}>
        Open SurgeryOS
      </Link>
      <Link href={`${base}/prescriptions/new`} className={doctorWorkspaceLinkButtonClass}>
        New Prescription
      </Link>
      <Link href={`${base}/calendar`} className={doctorWorkspaceLinkButtonClass}>
        Open Calendar
      </Link>
    </div>
  );
}

/**
 * Doctor Workspace — physician clinical decision cockpit.
 */
export function DoctorWorkspaceDashboard(props: {
  bundle: DoctorWorkspaceBundle;
  recentPrescriptions: readonly FiPatientPrescriptionRow[];
  patientLabels: ReadonlyMap<string, string>;
  showDiagnosticsExpanded?: boolean;
}) {
  const { bundle, recentPrescriptions, patientLabels, showDiagnosticsExpanded = false } = props;
  const base = `/fi-admin/${bundle.tenantId}`;

  const snapshotCards = buildDoctorSnapshotCards(base, bundle);
  const priorityItems = buildDoctorPriorities(base, bundle, 5);
  const patientQueue = buildDoctorPatientReviewQueue(base, bundle);
  const prescriptionModel = buildDoctorPrescriptionWorkspace(base, bundle, recentPrescriptions, patientLabels);
  const treatmentApprovals = buildDoctorTreatmentApprovals(base, bundle);
  const timeline = buildDoctorClinicalTimeline(base, bundle, recentPrescriptions, patientLabels);

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-6 pb-10 sm:space-y-8 sm:pb-12">
      <DashboardCard elevated className="relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_260px_at_0%_0%,rgba(16,185,129,0.11),transparent_55%),radial-gradient(420px_200px_at_100%_100%,rgba(52,211,153,0.06),transparent_50%)]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4">
          <div className="border-l-4 border-emerald-400/80 pl-5 sm:pl-6">
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/95">
              <Stethoscope className="h-4 w-4" aria-hidden />
              FI OS
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F8FAFC] sm:text-4xl">Doctor Workspace</h1>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-[#94A3B8]">
              Clinical review, patient approvals, prescriptions, consultations, and physician decision-making.
            </p>
            <DoctorWorkspacePrimaryActions base={base} />
          </div>
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="doctor-snapshot-heading">
        <SectionHeader
          id="doctor-snapshot-heading"
          kicker="Today"
          title="Clinical workload snapshot"
          description="Physician-facing signals — no admin or system metrics."
          className="mb-4"
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {snapshotCards.map((card) => {
            const inner = (
              <>
                <p className="text-sm font-semibold text-[#F8FAFC]">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-[#F8FAFC]">{card.value}</p>
                <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{card.detail}</p>
              </>
            );
            if (card.href) {
              return (
                <Link
                  key={card.id}
                  href={card.href}
                  className="group flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4 transition hover:border-emerald-400/25"
                >
                  {inner}
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-400/80 opacity-0 transition group-hover:opacity-100">
                    Open <ArrowRight className="h-3 w-3" aria-hidden />
                  </span>
                </Link>
              );
            }
            return (
              <div
                key={card.id}
                className="flex min-w-0 flex-col rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4"
              >
                {inner}
              </div>
            );
          })}
        </div>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="doctor-priorities-heading">
        <SectionHeader
          id="doctor-priorities-heading"
          kicker="Priorities"
          title="What needs physician attention"
          description="Top clinical decisions — act here first."
          className="mb-4"
        />
        {priorityItems.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
            <p className="text-sm leading-relaxed text-[#CBD5E1]">
              No urgent physician actions detected. Clinical workflow is currently under control.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {priorityItems.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-4 transition hover:border-emerald-400/30 ${doctorAttentionSeverityClass(item.severity)}`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                      {item.detail ? <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p> : null}
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-emerald-400/70" aria-hidden />
                  </Link>
                ) : (
                  <div className={`rounded-xl border px-4 py-4 ${doctorAttentionSeverityClass(item.severity)}`}>
                    <p className="font-semibold text-[#F8FAFC]">{item.headline}</p>
                    {item.detail ? <p className="mt-1 text-sm text-[#94A3B8]">{item.detail}</p> : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="doctor-patient-queue-heading">
        <SectionHeader
          id="doctor-patient-queue-heading"
          kicker="Queue"
          title="Patients requiring review"
          description="Main physician queue — open records and complete clinical actions."
          className="mb-4"
        />
        {patientQueue.length === 0 ? (
          <p className="rounded-xl border border-white/[0.06] bg-[#0c1220]/60 px-4 py-4 text-sm text-[#94A3B8]">
            No patients currently require physician review.
          </p>
        ) : (
          <ul className="space-y-3">
            {patientQueue.map((patient) => (
              <li
                key={patient.id}
                className="rounded-xl border border-white/[0.08] bg-[#0c1220]/75 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#F8FAFC]">{patient.patientName}</p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      {patient.visitType} · {patient.clinicalStatus}
                    </p>
                    <p className="mt-1 text-xs text-[#94A3B8]">
                      Treatment plan: {patient.treatmentPlanStatus}
                      {patient.followUpDue ? ` · Follow-up: ${patient.followUpDue}` : ""}
                    </p>
                    <p className="mt-2 text-sm text-emerald-200/80">{patient.nextAction}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      href={patient.patientHref}
                      className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs font-medium text-[#E2E8F0] transition hover:border-emerald-400/30 hover:text-emerald-300"
                    >
                      Open patient
                    </Link>
                    {patient.consultationHref ? (
                      <Link
                        href={patient.consultationHref}
                        className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs font-medium text-[#E2E8F0] transition hover:border-emerald-400/30 hover:text-emerald-300"
                      >
                        Review consultation
                      </Link>
                    ) : null}
                    {patient.prescriptionHref ? (
                      <Link
                        href={patient.prescriptionHref}
                        className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs font-medium text-[#E2E8F0] transition hover:border-emerald-400/30 hover:text-emerald-300"
                      >
                        Review prescription
                      </Link>
                    ) : null}
                    {patient.procedureHref ? (
                      <Link
                        href={patient.procedureHref}
                        className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs font-medium text-[#E2E8F0] transition hover:border-emerald-400/30 hover:text-emerald-300"
                      >
                        Open procedure record
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="doctor-prescriptions-heading">
        <SectionHeader
          id="doctor-prescriptions-heading"
          kicker="Medication"
          title="Prescription workspace"
          description="Approvals, active orders, renewals, and recent prescribing activity."
          className="mb-4"
        />
        <DoctorPrescriptionWorkspace base={base} model={prescriptionModel} />
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="doctor-approvals-heading">
        <SectionHeader
          id="doctor-approvals-heading"
          kicker="Approvals"
          title="Treatment approvals"
          description="Physician sign-off tasks — not a full patient chart."
          className="mb-4"
        />
        {treatmentApprovals.length === 0 ? (
          <p className="rounded-xl border border-white/[0.06] bg-[#0c1220]/60 px-4 py-4 text-sm text-[#94A3B8]">
            Treatment approvals will appear here when clinical decisions require physician sign-off.
          </p>
        ) : (
          <ul className="space-y-2">
            {treatmentApprovals.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#0c1220]/60 px-4 py-3 transition hover:border-emerald-400/30"
                >
                  <span className="text-sm font-medium text-[#F8FAFC]">{item.label}</span>
                  <span className="shrink-0 rounded-lg bg-white/[0.04] px-3 py-1 text-sm font-semibold tabular-nums text-[#94A3B8]">
                    {item.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      {timeline.length > 0 ? (
        <DashboardCard className="p-5 sm:p-6" role="region" aria-labelledby="doctor-timeline-heading">
          <SectionHeader
            id="doctor-timeline-heading"
            kicker="Activity"
            title="Clinical timeline"
            description="Compact physician activity — open Calendar for full scheduling."
            className="mb-4"
          />
          <ul className="divide-y divide-white/[0.06]">
            {timeline.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-xs font-medium tabular-nums text-emerald-400/80">{item.timeLabel}</p>
                  <p className="mt-0.5 truncate text-sm text-[#CBD5E1]">{item.label}</p>
                </div>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="shrink-0 text-xs font-semibold text-emerald-400/80 hover:text-emerald-300"
                  >
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}

      <DoctorSystemDiagnostics
        bundle={bundle}
        recentPrescriptions={recentPrescriptions}
        showDiagnosticsExpanded={showDiagnosticsExpanded}
      />
    </div>
  );
}
