import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  ClipboardList,
  Mic,
  Pill,
  Send,
  Stethoscope,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { DoctorWorkspaceBundle } from "@/src/lib/doctorOs/doctorWorkspaceLoader.server";
import { MEDICATION_REORDER_STATUS_LABELS } from "@/src/lib/medicationReorder/medicationReorderTypes";

function formatLocalTime(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "—";
  return new Date(d).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function CxPanel({
  title,
  icon,
  count,
  children,
  className,
}: {
  title: string;
  icon: ReactNode;
  count?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col rounded-xl border border-emerald-500/15 bg-gradient-to-br from-[#051a14]/95 via-[#061210]/92 to-[#030806]/95 p-4 shadow-[inset_0_1px_0_rgba(16,185,129,0.06)] backdrop-blur-md",
        className,
      )}
    >
      <header className="mb-3 flex shrink-0 items-center gap-2 border-b border-emerald-500/10 pb-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100/90">{title}</h2>
          {count != null ? (
            <p className="text-[11px] text-emerald-200/55">
              {count} {count === 1 ? "item" : "items"}
            </p>
          ) : null}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <p className="text-sm text-emerald-100/45">{message}</p>;
}

function RowLink({
  href,
  primary,
  secondary,
  meta,
  tone,
}: {
  href: string;
  primary: string;
  secondary?: string | null;
  meta?: string | null;
  tone?: "default" | "warn";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-lg border px-2.5 py-2 transition",
        tone === "warn"
          ? "border-amber-500/25 bg-amber-500/[0.07] hover:border-amber-400/40 hover:bg-amber-500/10"
          : "border-white/[0.06] bg-black/25 hover:border-emerald-400/30 hover:bg-emerald-500/[0.06]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-medium text-slate-100">{primary}</span>
        {meta ? <span className="shrink-0 text-[11px] text-slate-400">{meta}</span> : null}
      </div>
      {secondary ? <p className="mt-0.5 line-clamp-2 text-[12px] text-slate-400">{secondary}</p> : null}
    </Link>
  );
}

export function DoctorWorkspaceHome({ bundle, base }: { bundle: DoctorWorkspaceBundle; base: string }) {
  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
      <header className="space-y-2 border-b border-emerald-500/10 pb-5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
          <Stethoscope className="h-4 w-4" aria-hidden />
          DoctorOS · clinical command centre
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Doctor workspace</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
          Live queues for today&apos;s patients, documentation, prescribing, pharmacy hand-off, and voice notes — built for
          rounds, not pipelines.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <CxPanel title="Today’s patients" icon={<Calendar className="h-4 w-4" />} count={bundle.todayPatients.length}>
          <div className="space-y-2">
            {bundle.todayPatients.length === 0 ? (
              <EmptyRow message="No booked patients with patient records linked for today." />
            ) : (
              bundle.todayPatients.map((p) => (
                <RowLink
                  key={p.patientId}
                  href={`${base}/patients/${encodeURIComponent(p.patientId)}`}
                  primary={p.patientLabel}
                  secondary={[p.bookingType.replace(/_/g, " "), p.bookingTitle].filter(Boolean).join(" · ") || null}
                  meta={formatLocalTime(p.nextStartAt)}
                />
              ))
            )}
            <Link
              href={`${base}/calendar`}
              className="mt-2 inline-block text-[12px] font-medium text-emerald-400/90 underline-offset-2 hover:underline"
            >
              Open calendar →
            </Link>
          </div>
        </CxPanel>

        <CxPanel
          title="Pending consult notes"
          icon={<ClipboardList className="h-4 w-4" />}
          count={bundle.pendingConsultations.length}
        >
          <div className="space-y-2">
            {bundle.pendingConsultations.length === 0 ? (
              <EmptyRow message="No consultations in draft or in progress." />
            ) : (
              bundle.pendingConsultations.map((c) => (
                <RowLink
                  key={c.id}
                  href={`${base}/consultations/${encodeURIComponent(c.id)}`}
                  primary={c.subject_line}
                  secondary={`${c.consultation_type_label} · ${c.status.replace(/_/g, " ")}`}
                  meta={formatShortDate(c.updated_at)}
                />
              ))
            )}
          </div>
        </CxPanel>

        <CxPanel title="Draft prescriptions" icon={<Pill className="h-4 w-4" />} count={bundle.draftPrescriptionsInProgress.length}>
          <div className="space-y-2">
            {bundle.draftPrescriptionsInProgress.length === 0 ? (
              <EmptyRow message="No in-progress prescription drafts (add lines or confirm repeat rules)." />
            ) : (
              bundle.draftPrescriptionsInProgress.map((r) => (
                <RowLink
                  key={r.id}
                  href={`${base}/prescriptions/${encodeURIComponent(r.id)}`}
                  primary={r.patientLabel}
                  secondary="Draft — lines or repeat-rule confirmation outstanding"
                  meta={formatShortDate(r.updatedAt)}
                />
              ))
            )}
          </div>
        </CxPanel>

        <CxPanel
          title="Ready to sign"
          icon={<Pill className="h-4 w-4" />}
          count={bundle.prescriptionsAwaitingSignature.length}
        >
          <div className="space-y-2">
            {bundle.prescriptionsAwaitingSignature.length === 0 ? (
              <EmptyRow message="No prescriptions are waiting on prescriber signature right now." />
            ) : (
              bundle.prescriptionsAwaitingSignature.map((r) => (
                <RowLink
                  key={r.id}
                  href={`${base}/prescriptions/${encodeURIComponent(r.id)}`}
                  primary={r.patientLabel}
                  secondary="Draft complete — sign to proceed"
                  meta={formatShortDate(r.updatedAt)}
                  tone="warn"
                />
              ))
            )}
          </div>
        </CxPanel>

        <CxPanel title="Pharmacy send queue" icon={<Send className="h-4 w-4" />} count={bundle.pharmacyQueue.length}>
          <div className="space-y-2">
            {bundle.pharmacyQueue.length === 0 ? (
              <EmptyRow message="No pending or failed pharmacy transmissions." />
            ) : (
              bundle.pharmacyQueue.map((r) => (
                <RowLink
                  key={r.transmissionId}
                  href={`${base}/prescriptions/${encodeURIComponent(r.prescriptionId)}`}
                  primary={r.patientLabel}
                  secondary={
                    r.status === "failed"
                      ? r.errorMessage ?? "Transmission failed — open prescription to retry or export."
                      : "Awaiting send or manual confirmation"
                  }
                  meta={r.status === "failed" ? "Failed" : "Pending"}
                  tone={r.status === "failed" ? "warn" : "default"}
                />
              ))
            )}
          </div>
        </CxPanel>

        <CxPanel
          title="Medication reorders"
          icon={<UserRound className="h-4 w-4" />}
          count={bundle.medicationReorders.length}
        >
          <div className="space-y-2">
            {bundle.medicationReorders.length === 0 ? (
              <EmptyRow message="No medication reorder requests awaiting clinic review." />
            ) : (
              bundle.medicationReorders.map((r) => (
                <RowLink
                  key={r.id}
                  href={`${base}/medication-reorders`}
                  primary={r.patientLabel}
                  secondary={MEDICATION_REORDER_STATUS_LABELS[r.status]}
                  meta={formatShortDate(r.created_at)}
                />
              ))
            )}
          </div>
        </CxPanel>

        <CxPanel
          title="Follow-up tasks"
          icon={<ClipboardList className="h-4 w-4" />}
          count={bundle.includeCrmTasks ? bundle.followUpTasks.length : 0}
        >
          <div className="space-y-2">
            {!bundle.includeCrmTasks ? (
              <EmptyRow message="Follow-up tasks live in LeadFlow — CRM shell access is required to open them from here." />
            ) : bundle.followUpTasks.length === 0 ? (
              <EmptyRow message="No CRM tasks due in the next two weeks (assigned to you or unassigned)." />
            ) : (
              bundle.followUpTasks.map((t) => (
                <RowLink
                  key={t.id}
                  href={`${base}/crm/leads/${encodeURIComponent(t.leadId)}`}
                  primary={t.title}
                  secondary={t.isUnassigned ? "Unassigned · " + t.taskType.replace(/_/g, " ") : t.taskType.replace(/_/g, " ")}
                  meta={t.dueAt ? formatShortDate(t.dueAt) : "No due date"}
                />
              ))
            )}
          </div>
        </CxPanel>

        <CxPanel
          title="Voice notes — approval"
          icon={<Mic className="h-4 w-4" />}
          count={bundle.voiceNotesPendingApproval.length}
          className="xl:col-span-1"
        >
          <div className="space-y-2">
            {bundle.voiceNotesPendingApproval.length === 0 ? (
              <EmptyRow message="No AI voice drafts waiting for clinician approval." />
            ) : (
              bundle.voiceNotesPendingApproval.map((n) => (
                <RowLink
                  key={n.id}
                  href={
                    n.caseId
                      ? `${base}/cases/${encodeURIComponent(n.caseId)}`
                      : `${base}/patients/${encodeURIComponent(n.patientId)}`
                  }
                  primary={n.patientLabel}
                  secondary={n.preview}
                  meta={formatShortDate(n.createdAt)}
                  tone="warn"
                />
              ))
            )}
            <p className="flex items-start gap-1.5 pt-1 text-[11px] text-emerald-200/50">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/80" aria-hidden />
              Approve or edit from the patient or case workspace where the note was captured.
            </p>
          </div>
        </CxPanel>
      </div>
    </div>
  );
}
