"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { leadTitleFromRow, personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import { isCrmMutationRole } from "@/src/lib/crm/crmGatePolicy";
import type { CrmLeadShellSlideOverPayload } from "@/src/lib/crm/crmShellLoaders";
import type { FiCrmPipelineStageRow } from "@/src/lib/crm/types";

const card = "rounded border border-gray-200 bg-white p-3 shadow-sm";

function stageLabel(stageId: string | null, stages: FiCrmPipelineStageRow[]): string {
  if (!stageId) return "—";
  return stages.find((s) => s.id === stageId)?.label ?? `${stageId.slice(0, 8)}…`;
}

function statusSelectOptions(current: string): string[] {
  const s = new Set<string>(CRM_LEAD_DETAIL_STATUS_VALUES);
  const c = current.trim();
  if (c) s.add(c);
  return Array.from(s);
}

function prioritySelectOptions(current: string | null): string[] {
  const s = new Set<string>(CRM_LEAD_DETAIL_PRIORITY_VALUES);
  const c = (current ?? "").trim();
  if (c) s.add(c);
  return Array.from(s);
}

type SlideOverCtx = {
  openLead: (leadId: string) => void;
  close: () => void;
};

const CrmLeadSlideOverContext = createContext<SlideOverCtx | null>(null);

export function useCrmLeadSlideOver(): SlideOverCtx {
  const v = useContext(CrmLeadSlideOverContext);
  if (!v) throw new Error("useCrmLeadSlideOver must be used within CrmLeadSlideOverProvider");
  return v;
}

export function useCrmLeadSlideOverOptional(): SlideOverCtx | null {
  return useContext(CrmLeadSlideOverContext);
}

export function CrmLeadSlideOverProvider({
  tenantId,
  operatorFiUserId,
  userRole,
  children,
}: {
  tenantId: string;
  operatorFiUserId: string;
  userRole: string;
  children: ReactNode;
}) {
  const [leadId, setLeadId] = useState<string | null>(null);
  const openLead = useCallback((id: string) => setLeadId(id.trim()), []);
  const close = useCallback(() => setLeadId(null), []);

  const value = useMemo(() => ({ openLead, close }), [openLead, close]);

  return (
    <CrmLeadSlideOverContext.Provider value={value}>
      {children}
      <LeadSlideOverPanel
        tenantId={tenantId}
        leadId={leadId}
        open={leadId != null}
        onClose={close}
        operatorFiUserId={operatorFiUserId}
        userRole={userRole}
      />
    </CrmLeadSlideOverContext.Provider>
  );
}

/** Right-hand slide-over panel (use {@link CrmLeadSlideOverProvider} + {@link useCrmLeadSlideOver} or render directly). */
export function LeadSlideOverPanel({
  tenantId,
  leadId,
  open,
  onClose,
  operatorFiUserId,
  userRole,
}: {
  tenantId: string;
  leadId: string | null;
  open: boolean;
  onClose: () => void;
  operatorFiUserId: string;
  userRole: string;
}) {
  const router = useRouter();
  const canMutate = isCrmMutationRole(userRole);
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
  }, [open, leadId, tenantId]);

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

  const openTasks = useMemo(() => {
    const tasks = payload?.detail.tasks ?? [];
    return tasks.filter((t) => t.completed_at == null);
  }, [payload?.detail.tasks]);

  const activityPreview = useMemo(() => (payload?.detail.events ?? []).slice(0, 8), [payload?.detail.events]);

  const notesPreview = useMemo(() => {
    const general = (payload?.detail.notes ?? []).map((n) => ({
      id: n.id,
      kind: "note" as const,
      at: n.created_at,
      text: n.body,
    }));
    const ln = (payload?.detail.leadNotes ?? [])
      .filter((x) => x.archived_at == null)
      .map((n) => ({ id: n.id, kind: "lead_note" as const, at: n.created_at, text: n.note_body }));
    return [...general, ...ln].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6);
  }, [payload?.detail.leadNotes, payload?.detail.notes]);

  const upcomingReminders = useMemo(() => {
    const jobs = payload?.reminderJobs ?? [];
    const now = Date.now();
    return jobs
      .filter((j) => j.status === "pending" && new Date(j.scheduled_at).getTime() >= now - 120_000)
      .slice(0, 10);
  }, [payload?.reminderJobs]);

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

  async function onSaveBasics(e: React.FormEvent) {
    e.preventDefault();
    if (!lead || !canMutate) return;
    setDetailErr(null);
    if (!summary.trim()) {
      setDetailErr("Lead title / summary is required.");
      return;
    }
    if (!CRM_LEAD_DETAIL_STATUS_VALUES.includes(status as (typeof CRM_LEAD_DETAIL_STATUS_VALUES)[number])) {
      setDetailErr("Pick a standard status from the list.");
      return;
    }
    if (
      priority.trim() !== "" &&
      !CRM_LEAD_DETAIL_PRIORITY_VALUES.includes(priority as (typeof CRM_LEAD_DETAIL_PRIORITY_VALUES)[number])
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
    setPayload((p) => (p && p.detail.lead ? { ...p, detail: { ...p.detail, lead: optimistic } } : p));
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
        setPayload((p) => (p ? { ...p, detail: { ...p.detail, lead: snapLead }, stageHistory: snapHist } : p));
        setStageErr(r.error);
        return;
      }
      await refreshPayload();
      router.refresh();
    } finally {
      setStageBusy(false);
    }
  }

  async function onAddTask(e: React.FormEvent) {
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
      setPayload((p) => (p ? { ...p, detail: { ...p.detail, tasks: [r.task, ...p.detail.tasks] } } : p));
      router.refresh();
    } finally {
      setTaskBusy(false);
    }
  }

  async function onAddGeneralNote(e: React.FormEvent) {
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
      setPayload((p) => (p ? { ...p, detail: { ...p.detail, notes: [r.note, ...p.detail.notes] } } : p));
      router.refresh();
    } finally {
      setNoteBusy(false);
    }
  }

  async function onAddLeadNote(e: React.FormEvent) {
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
      setPayload((p) => (p ? { ...p, detail: { ...p.detail, leadNotes: [r.note, ...p.detail.leadNotes] } } : p));
      router.refresh();
    } finally {
      setLeadNoteBusy(false);
    }
  }

  async function onCompleteTask(taskId: string) {
    if (!lead || !canMutate) return;
    const snap = payload?.detail.tasks ?? [];
    const optimistic = snap.map((t) =>
      t.id === taskId ? { ...t, status: "done" as const, completed_at: new Date().toISOString() } : t
    );
    setPayload((p) => (p ? { ...p, detail: { ...p.detail, tasks: optimistic } } : p));
    const r = await completeCrmTaskAction(tenantId, lead.id, taskId, {});
    if (!r.ok) {
      setPayload((p) => (p ? { ...p, detail: { ...p.detail, tasks: snap } } : p));
      return;
    }
    setPayload((p) => (p ? { ...p, detail: { ...p.detail, tasks: p.detail.tasks.map((t) => (t.id === taskId ? r.task : t)) } } : p));
    router.refresh();
  }

  async function onConvert(e: React.FormEvent) {
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
        className="flex h-full max-h-[100dvh] w-full flex-col overflow-hidden border-l border-gray-200 bg-white shadow-xl sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Lead preview"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-gray-900">Lead preview</h2>
            {lead ? (
              <Link href={href} className="text-xs text-blue-600 hover:underline" onClick={() => onClose()}>
                Open full page →
              </Link>
            ) : null}
          </div>
          <button type="button" className="shrink-0 text-sm text-gray-600 hover:text-gray-900" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {loading ? <p className="text-gray-600">Loading…</p> : null}
          {loadError ? (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
              {loadError}
            </div>
          ) : null}

          {!loading && lead && payload ? (
            <div className="space-y-4">
              <section className={card}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Person</h3>
                <p className="font-medium text-gray-900">{personName}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Lead: {leadTitleFromRow(lead.summary, lead.id)}
                </p>
                {payload.clinicalScalesSummary ? (
                  <p className="mt-2 text-xs text-gray-800">{payload.clinicalScalesSummary}</p>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">No linked patient clinical summary yet.</p>
                )}
                <dl className="mt-3 grid gap-1 text-xs text-gray-700">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Status</dt>
                    <dd>{lead.status}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Stage</dt>
                    <dd>{stageLabel(lead.current_stage_id, stages)}</dd>
                  </div>
                </dl>
              </section>

              {canMutate ? (
                <section className={card}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Change stage</h3>
                  <select
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    value={lead.current_stage_id ?? ""}
                    disabled={stageBusy}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      void onStageChange(v);
                    }}
                  >
                    <option value="">Select stage…</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  {stageErr ? <p className="mt-1 text-xs text-red-700">{stageErr}</p> : null}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-gray-600">Recent stage history</summary>
                    <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs text-gray-700">
                      {(payload.stageHistory ?? []).slice(0, 12).map((h) => (
                        <li key={h.id} className="border-l-2 border-gray-200 pl-2">
                          <time className="text-gray-500">{h.changed_at}</time>
                          <p>
                            {stageLabel(h.from_stage_id, stages)} → {stageLabel(h.to_stage_id, stages)}
                          </p>
                          <p className="text-gray-500">{h.source}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                </section>
              ) : (
                <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Your role can view this lead but not change CRM data here.
                </p>
              )}

              {canMutate ? (
                <section className={card}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Quick edit</h3>
                  <form className="space-y-2" onSubmit={onSaveBasics}>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-700">Summary</span>
                      <textarea
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        rows={2}
                        className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-medium text-gray-700">Status</span>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          {statusSelectOptions(lead.status).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-gray-700">Priority</span>
                        <select
                          value={priority}
                          onChange={(e) => setPriority(e.target.value)}
                          className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">None</option>
                          {prioritySelectOptions(lead.priority).map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-700">Primary owner</span>
                      <select
                        value={ownerId}
                        onChange={(e) => setOwnerId(e.target.value)}
                        className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {payload.detail.owners.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.email ?? o.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    {detailErr ? <p className="text-xs text-red-700">{detailErr}</p> : null}
                    <button
                      type="submit"
                      disabled={detailBusy}
                      className="rounded bg-blue-700 px-3 py-1.5 text-white hover:bg-blue-800 disabled:opacity-50"
                    >
                      {detailBusy ? "Saving…" : "Save basics"}
                    </button>
                  </form>
                </section>
              ) : null}

              <section className={card}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Activity</h3>
                {activityPreview.length === 0 ? (
                  <p className="text-xs text-gray-600">No timeline events yet.</p>
                ) : (
                  <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
                    {activityPreview.map((ev) => (
                      <li key={ev.id} className="border-l-2 border-gray-100 pl-2">
                        <span className="text-gray-500">{ev.occurred_at}</span>{" "}
                        <span className="font-mono text-gray-600">{ev.activity_kind}</span>
                        {ev.title ? <p className="font-medium text-gray-900">{ev.title}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={card}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Open tasks</h3>
                {openTasks.length === 0 ? (
                  <p className="text-xs text-gray-600">No open tasks.</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {openTasks.map((t) => (
                      <li key={t.id} className="flex items-start justify-between gap-2 rounded border border-gray-100 p-2">
                        <div>
                          <p className="font-medium text-gray-900">{t.title}</p>
                          <p className="text-gray-500">
                            {t.task_type} · {t.status}
                            {t.due_at ? ` · due ${t.due_at}` : ""}
                          </p>
                        </div>
                        {canMutate ? (
                          <button
                            type="button"
                            className="shrink-0 text-blue-700 hover:underline"
                            onClick={() => void onCompleteTask(t.id)}
                          >
                            Done
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {canMutate ? (
                  <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={onAddTask}>
                    <input
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="New task title"
                      className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={taskBusy}
                      className="rounded border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </form>
                ) : null}
                {taskErr ? <p className="mt-1 text-xs text-red-700">{taskErr}</p> : null}
              </section>

              <section className={card}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</h3>
                {notesPreview.length === 0 ? (
                  <p className="text-xs text-gray-600">No notes yet.</p>
                ) : (
                  <ul className="mb-3 max-h-40 space-y-2 overflow-y-auto text-xs">
                    {notesPreview.map((n) => (
                      <li key={`${n.kind}-${n.id}`} className="rounded bg-gray-50 p-2">
                        <span className="text-gray-500">{n.at}</span>{" "}
                        <span className="text-gray-500">({n.kind})</span>
                        <p className="whitespace-pre-wrap text-gray-800">{n.text}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {canMutate ? (
                  <div className="space-y-3">
                    <form onSubmit={onAddGeneralNote}>
                      <p className="mb-1 text-xs font-medium text-gray-700">General CRM note</p>
                      <textarea
                        value={noteBody}
                        onChange={(e) => setNoteBody(e.target.value)}
                        rows={2}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        placeholder="Visible on lead (general notes)"
                      />
                      <button
                        type="submit"
                        disabled={noteBusy}
                        className="mt-1 rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                      >
                        Add general note
                      </button>
                    </form>
                    <form onSubmit={onAddLeadNote}>
                      <p className="mb-1 text-xs font-medium text-gray-700">Lead note</p>
                      <textarea
                        value={leadNoteBody}
                        onChange={(e) => setLeadNoteBody(e.target.value)}
                        rows={2}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        placeholder="Internal lead note"
                      />
                      <button
                        type="submit"
                        disabled={leadNoteBusy}
                        className="mt-1 rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                      >
                        Add lead note
                      </button>
                    </form>
                  </div>
                ) : null}
                {(noteErr || leadNoteErr) ? (
                  <p className="mt-1 text-xs text-red-700">{noteErr ?? leadNoteErr}</p>
                ) : null}
              </section>

              <section className={card}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Upcoming reminders</h3>
                {upcomingReminders.length === 0 ? (
                  <p className="text-xs text-gray-600">No pending reminder jobs scheduled ahead for this lead.</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {upcomingReminders.map((j) => (
                      <li key={j.id} className="flex flex-col rounded border border-gray-100 p-2">
                        <span className="font-medium text-gray-900">{j.template_name || "Reminder"}</span>
                        <span className="text-gray-600">
                          {j.scheduled_at} · {j.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {payload.detail.conversionState && !lead.converted_at ? (
                <section className={card}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Convert to patient</h3>
                  <p className="mb-2 text-xs text-gray-600">
                    Creates the patient foundation from this lead when not yet converted.
                  </p>
                  {canMutate ? (
                    <form className="space-y-2" onSubmit={onConvert}>
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={seedCase} onChange={(e) => setSeedCase(e.target.checked)} />
                        Seed a case when converting
                      </label>
                      {convErr ? <p className="text-xs text-red-700">{convErr}</p> : null}
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
