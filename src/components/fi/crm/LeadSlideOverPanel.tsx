"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  crmCreateNoteAction,
  crmCreateTaskAction,
  crmLoadLeadSlideOverBundleAction,
  crmMoveLeadStageAction,
  completeCrmTaskAction,
  convertCrmLeadAction,
  createCrmLeadNoteAction,
  updateCrmLeadDetailsAction,
} from "@/lib/actions/fi-crm-actions";
import {
  CRM_LEAD_DETAIL_PRIORITY_VALUES,
  CRM_LEAD_DETAIL_STATUS_VALUES,
} from "@/src/lib/crm/crmLeadDetailsPolicy";
import { personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import { canMutateClinicFromOperatorContext } from "@/src/lib/crm/crmGatePolicy";
import type { CrmLeadShellSlideOverPayload } from "@/src/lib/crm/crmShellLoaders";
import {
  LeadActivityFeed,
  LeadNotesSection,
  LeadPersonHeader,
  LeadQuickEditPanel,
  LeadRemindersSection,
  LeadStageSection,
  LeadTasksSection,
  crmLeadCardClass,
} from "./shared";
import type { WorkspacePanelSignalRefresh } from "@/src/components/fi-os/workspace/useWorkspacePanelSignalRefresh";
import { WorkspaceSignalHeaderHint } from "@/src/components/fi-os/workspace/panels/WorkspaceShellPanelFrame";

/** Right-hand slide-over panel (use {@link CrmLeadSlideOverProvider} + {@link useCrmLeadSlideOver} or render directly). */
export function LeadSlideOverPanel({
  tenantId,
  leadId,
  open,
  onClose,
  operatorFiUserId,
  userRole,
  canUseClinicFeatures,
  signalRefreshToken = 0,
  lastSignalReason,
  lastSignalAt,
}: {
  tenantId: string;
  leadId: string | null;
  open: boolean;
  onClose: () => void;
  operatorFiUserId: string;
  userRole: string;
  canUseClinicFeatures?: boolean;
} & WorkspacePanelSignalRefresh) {
  const router = useRouter();
  const canMutate = canMutateClinicFromOperatorContext({ userRole, canUseClinicFeatures });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payload, setPayload] = useState<CrmLeadShellSlideOverPayload | null>(null);

  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  const [stageBusy, setStageBusy] = useState(false);
  const [stageErr, setStageErr] = useState<string | null>(null);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskErr, setTaskErr] = useState<string | null>(null);

  const [noteBody, setNoteBody] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteErr, setNoteErr] = useState<string | null>(null);

  const [leadNoteBody, setLeadNoteBody] = useState("");
  const [leadNoteBusy, setLeadNoteBusy] = useState(false);
  const [leadNoteErr, setLeadNoteErr] = useState<string | null>(null);

  const [convBusy, setConvBusy] = useState(false);
  const [convErr, setConvErr] = useState<string | null>(null);
  const [seedCase, setSeedCase] = useState(false);

  useEffect(() => {
    if (!open || !leadId) {
      setPayload(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      const r = await crmLoadLeadSlideOverBundleAction(tenantId, leadId);
      if (cancelled) return;
      setLoading(false);
      if (!r.ok) {
        setLoadError(r.error);
        setPayload(null);
        return;
      }
      setPayload(r.data);
      const L = r.data.detail.lead!;
      setSummary(L.summary ?? "");
      setStatus(L.status);
      setPriority(L.priority ?? "");
      setOwnerId(L.primary_owner_user_id ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [open, leadId, tenantId, signalRefreshToken]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const lead = payload?.detail.lead ?? null;
  const stages = payload?.stages ?? [];
  const href = lead ? `/fi-admin/${tenantId}/crm/leads/${lead.id}` : "#";

  const personName = useMemo(() => {
    const p = payload?.detail.conversionState?.person;
    if (!p) return "—";
    return personMetadataDisplayLabel(p.metadata);
  }, [payload?.detail.conversionState?.person]);

  async function refreshPayload() {
    if (!leadId) return;
    const r = await crmLoadLeadSlideOverBundleAction(tenantId, leadId);
    if (r.ok) {
      setPayload(r.data);
      const L = r.data.detail.lead!;
      setSummary(L.summary ?? "");
      setStatus(L.status);
      setPriority(L.priority ?? "");
      setOwnerId(L.primary_owner_user_id ?? "");
    }
  }

  async function onSaveBasics(e: FormEvent) {
    e.preventDefault();
    if (!lead || !canMutate) return;
    setDetailErr(null);
    if (!summary.trim()) {
      setDetailErr("Lead title / summary is required.");
      return;
    }
    if (
      !CRM_LEAD_DETAIL_STATUS_VALUES.includes(
        status as (typeof CRM_LEAD_DETAIL_STATUS_VALUES)[number]
      )
    ) {
      setDetailErr("Pick a standard status from the list.");
      return;
    }
    if (
      priority.trim() !== "" &&
      !CRM_LEAD_DETAIL_PRIORITY_VALUES.includes(
        priority as (typeof CRM_LEAD_DETAIL_PRIORITY_VALUES)[number]
      )
    ) {
      setDetailErr("Pick a standard priority or None.");
      return;
    }
    const snap = { ...lead };
    const optimistic = {
      ...lead,
      summary: summary.trim(),
      status,
      priority: priority.trim() === "" ? null : priority.trim(),
      primary_owner_user_id: ownerId.trim() === "" ? null : ownerId.trim(),
    };
    setPayload((p) =>
      p && p.detail.lead ? { ...p, detail: { ...p.detail, lead: optimistic } } : p
    );
    setDetailBusy(true);
    try {
      const r = await updateCrmLeadDetailsAction(tenantId, lead.id, {
        summary: summary.trim(),
        status,
        priority: priority.trim() === "" ? null : priority.trim(),
        primaryOwnerUserId: ownerId.trim() === "" ? null : ownerId.trim(),
        organisationId: lead.organisation_id,
        clinicId: lead.clinic_id,
        metadata: lead.metadata ?? {},
      });
      if (!r.ok) {
        setPayload((p) => (p && p.detail.lead ? { ...p, detail: { ...p.detail, lead: snap } } : p));
        setDetailErr(r.error);
        return;
      }
      setPayload((p) => (p ? { ...p, detail: { ...p.detail, lead: r.lead } } : p));
      router.refresh();
    } finally {
      setDetailBusy(false);
    }
  }

  async function onStageChange(toStageId: string) {
    if (!lead || !canMutate || toStageId === lead.current_stage_id) return;
    setStageErr(null);
    const snapLead = lead;
    const snapHist = payload?.stageHistory ?? [];
    const optimisticLead = { ...lead, current_stage_id: toStageId };
    setPayload((p) =>
      p
        ? {
            ...p,
            detail: { ...p.detail, lead: optimisticLead },
            stageHistory: [
              {
                id: `temp-${Date.now()}`,
                tenant_id: tenantId,
                lead_id: lead.id,
                from_stage_id: snapLead.current_stage_id,
                to_stage_id: toStageId,
                changed_at: new Date().toISOString(),
                changed_by: operatorFiUserId,
                reason: null,
                source: "fi_admin_lead_slideover",
                fi_timeline_event_id: null,
                metadata: {},
              },
              ...snapHist,
            ],
          }
        : p
    );
    setStageBusy(true);
    try {
      const r = await crmMoveLeadStageAction(tenantId, lead.id, {
        toStageId,
        changedBy: operatorFiUserId,
        source: "fi_admin_lead_slideover",
      });
      if (!r.ok) {
        setPayload((p) =>
          p ? { ...p, detail: { ...p.detail, lead: snapLead }, stageHistory: snapHist } : p
        );
        setStageErr(r.error);
        return;
      }
      await refreshPayload();
      router.refresh();
    } finally {
      setStageBusy(false);
    }
  }

  async function onAddTask(e: FormEvent) {
    e.preventDefault();
    if (!lead || !canMutate) return;
    const title = taskTitle.trim();
    if (!title) return;
    setTaskErr(null);
    setTaskBusy(true);
    try {
      const r = await crmCreateTaskAction(tenantId, lead.id, {
        title,
        taskType: "follow_up",
        status: "open",
        dueAt: null,
      });
      if (!r.ok) {
        setTaskErr(r.error);
        return;
      }
      setTaskTitle("");
      setPayload((p) =>
        p ? { ...p, detail: { ...p.detail, tasks: [r.task, ...p.detail.tasks] } } : p
      );
      router.refresh();
    } finally {
      setTaskBusy(false);
    }
  }

  async function onAddGeneralNote(e: FormEvent) {
    e.preventDefault();
    if (!lead || !canMutate) return;
    const body = noteBody.trim();
    if (!body) return;
    setNoteErr(null);
    setNoteBusy(true);
    try {
      const r = await crmCreateNoteAction(tenantId, lead.id, { body, visibility: "internal" });
      if (!r.ok) {
        setNoteErr(r.error);
        return;
      }
      setNoteBody("");
      setPayload((p) =>
        p ? { ...p, detail: { ...p.detail, notes: [r.note, ...p.detail.notes] } } : p
      );
      router.refresh();
    } finally {
      setNoteBusy(false);
    }
  }

  async function onAddLeadNote(e: FormEvent) {
    e.preventDefault();
    if (!lead || !canMutate) return;
    const body = leadNoteBody.trim();
    if (!body) return;
    setLeadNoteErr(null);
    setLeadNoteBusy(true);
    try {
      const r = await createCrmLeadNoteAction(tenantId, lead.id, {
        noteBody: body,
        noteVisibility: "internal",
        isPinned: false,
      });
      if (!r.ok) {
        setLeadNoteErr(r.error);
        return;
      }
      setLeadNoteBody("");
      setPayload((p) =>
        p ? { ...p, detail: { ...p.detail, leadNotes: [r.note, ...p.detail.leadNotes] } } : p
      );
      router.refresh();
    } finally {
      setLeadNoteBusy(false);
    }
  }

  async function onCompleteTask(taskId: string) {
    if (!lead || !canMutate) return;
    const snap = payload?.detail.tasks ?? [];
    const optimistic = snap.map((t) =>
      t.id === taskId
        ? { ...t, status: "done" as const, completed_at: new Date().toISOString() }
        : t
    );
    setPayload((p) => (p ? { ...p, detail: { ...p.detail, tasks: optimistic } } : p));
    const r = await completeCrmTaskAction(tenantId, lead.id, taskId, {});
    if (!r.ok) {
      setPayload((p) => (p ? { ...p, detail: { ...p.detail, tasks: snap } } : p));
      return;
    }
    setPayload((p) =>
      p
        ? {
            ...p,
            detail: {
              ...p.detail,
              tasks: p.detail.tasks.map((t) => (t.id === taskId ? r.task : t)),
            },
          }
        : p
    );
    router.refresh();
  }

  async function onConvert(e: FormEvent) {
    e.preventDefault();
    if (!lead || !canMutate) return;
    setConvErr(null);
    setConvBusy(true);
    try {
      const r = await convertCrmLeadAction(tenantId, lead.id, { seedCase });
      if (!r.ok) {
        setConvErr(r.error);
        return;
      }
      setSeedCase(false);
      await refreshPayload();
      router.refresh();
    } finally {
      setConvBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/30 sm:items-stretch"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="flex h-full max-h-[100dvh] w-full flex-col overflow-hidden border-l border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-xl sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Lead preview"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-100">Lead preview</h2>
            <WorkspaceSignalHeaderHint
              lastSignalReason={lastSignalReason}
              lastSignalAt={lastSignalAt}
              signalRefreshToken={signalRefreshToken}
            />
            {lead ? (
              <Link
                href={href}
                className="text-xs text-blue-300 hover:underline"
                onClick={() => onClose()}
              >
                Open full page →
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 text-sm text-slate-400 hover:text-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {loading ? <p className="text-slate-400">Loading…</p> : null}
          {loadError ? (
            <div
              className="rounded border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300"
              role="alert"
            >
              {loadError}
            </div>
          ) : null}

          {!loading && lead && payload ? (
            <div className="space-y-4">
              <LeadPersonHeader
                tenantId={tenantId}
                patientId={lead.patient_id}
                personName={personName}
                leadId={lead.id}
                leadSummary={lead.summary}
                clinicalScalesSummary={payload.clinicalScalesSummary}
              />

              <LeadStageSection
                lead={lead}
                stages={stages}
                stageHistory={payload.stageHistory ?? []}
                canMutate={canMutate}
                stageBusy={stageBusy}
                stageErr={stageErr}
                onStageChange={onStageChange}
              />

              <LeadQuickEditPanel
                lead={lead}
                owners={payload.detail.owners}
                summary={summary}
                status={status}
                priority={priority}
                ownerId={ownerId}
                canMutate={canMutate}
                busy={detailBusy}
                error={detailErr}
                onSummaryChange={setSummary}
                onStatusChange={setStatus}
                onPriorityChange={setPriority}
                onOwnerIdChange={setOwnerId}
                onSubmit={onSaveBasics}
              />

              <LeadActivityFeed events={payload.detail.events ?? []} limit={8} />

              <LeadTasksSection
                tasks={payload.detail.tasks ?? []}
                canMutate={canMutate}
                taskTitle={taskTitle}
                taskBusy={taskBusy}
                taskErr={taskErr}
                onTaskTitleChange={setTaskTitle}
                onAddTask={onAddTask}
                onCompleteTask={onCompleteTask}
              />

              <LeadNotesSection
                notes={payload.detail.notes ?? []}
                leadNotes={payload.detail.leadNotes ?? []}
                canMutate={canMutate}
                noteBody={noteBody}
                leadNoteBody={leadNoteBody}
                noteBusy={noteBusy}
                leadNoteBusy={leadNoteBusy}
                noteErr={noteErr}
                leadNoteErr={leadNoteErr}
                onNoteBodyChange={setNoteBody}
                onLeadNoteBodyChange={setLeadNoteBody}
                onAddGeneralNote={onAddGeneralNote}
                onAddLeadNote={onAddLeadNote}
              />

              <LeadRemindersSection reminderJobs={payload.reminderJobs ?? []} />

              {payload.detail.conversionState && !lead.converted_at ? (
                <section className={crmLeadCardClass}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Convert to patient
                  </h3>
                  <p className="mb-2 text-xs text-slate-400">
                    Creates the patient foundation from this lead when not yet converted.
                  </p>
                  {canMutate ? (
                    <form className="space-y-2" onSubmit={onConvert}>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={seedCase}
                          onChange={(e) => setSeedCase(e.target.checked)}
                        />
                        Seed a case when converting
                      </label>
                      {convErr ? <p className="text-xs text-rose-300">{convErr}</p> : null}
                      <button
                        type="submit"
                        disabled={convBusy}
                        className="rounded bg-emerald-700 px-3 py-1.5 text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {convBusy ? "Converting…" : "Convert"}
                      </button>
                    </form>
                  ) : null}
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

/** Alias for {@link LeadSlideOverPanel} — main slide-over UI entry point when not using the provider-only panel name. */
export { LeadSlideOverPanel as LeadSlideOver };
