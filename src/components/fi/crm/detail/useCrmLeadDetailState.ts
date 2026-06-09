"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  crmCreateNoteAction,
  crmCreateTaskAction,
  crmLoadLeadSlideOverBundleAction,
  crmMoveLeadStageAction,
  completeCrmTaskAction,
  createCrmLeadNoteAction,
  updateCrmLeadDetailsAction,
} from "@/lib/actions/fi-crm-actions";
import {
  CRM_LEAD_DETAIL_PRIORITY_VALUES,
  CRM_LEAD_DETAIL_STATUS_VALUES,
} from "@/src/lib/crm/crmLeadDetailsPolicy";
import { personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import { deriveCrmLeadNextAction } from "@/src/lib/crm/crmLeadNextAction";
import { parseCrmLeadOpportunitySnapshot } from "@/src/lib/crm/crmLeadOpportunityMeta";
import { canMutateClinicFromOperatorContext } from "@/src/lib/crm/crmGatePolicy";
import type { CrmLeadShellDetailPagePayload } from "@/src/lib/crm/crmShellLoaders";
import { useCrmLeadSlideOver } from "../LeadSlideOver";

const MUTATION_SOURCE = "fi_admin_lead_detail";

export function useCrmLeadDetailState(
  tenantId: string,
  leadId: string,
  initialPayload: CrmLeadShellDetailPagePayload
) {
  const router = useRouter();
  const { operatorFiUserId, userRole, canUseClinicFeatures } = useCrmLeadSlideOver();
  const canMutate = canMutateClinicFromOperatorContext({ userRole, canUseClinicFeatures });

  const [payload, setPayload] = useState(initialPayload);
  const lead = payload.detail.lead!;

  const [summary, setSummary] = useState(lead.summary ?? "");
  const [status, setStatus] = useState(lead.status);
  const [priority, setPriority] = useState(lead.priority ?? "");
  const [ownerId, setOwnerId] = useState(lead.primary_owner_user_id ?? "");
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

  const personName = useMemo(() => {
    const p = payload.detail.conversionState?.person;
    if (!p) return "—";
    return personMetadataDisplayLabel(p.metadata);
  }, [payload.detail.conversionState?.person]);

  const opportunity = useMemo(
    () => parseCrmLeadOpportunitySnapshot(lead, payload.stages),
    [lead, payload.stages]
  );

  const nextAction = useMemo(
    () =>
      deriveCrmLeadNextAction(
        payload.detail.tasks,
        payload.reminderJobs,
        payload.detail.leadBookings
      ),
    [payload.detail.tasks, payload.reminderJobs, payload.detail.leadBookings]
  );

  const openTaskCount = useMemo(
    () => payload.detail.tasks.filter((t) => t.completed_at == null).length,
    [payload.detail.tasks]
  );

  const pendingReminderCount = useMemo(() => {
    const now = Date.now();
    return payload.reminderJobs.filter(
      (j) => j.status === "pending" && new Date(j.scheduled_at).getTime() >= now - 120_000
    ).length;
  }, [payload.reminderJobs]);

  const refreshPayload = useCallback(async () => {
    const r = await crmLoadLeadSlideOverBundleAction(tenantId, leadId);
    if (!r.ok) return;
    setPayload((prev) => ({
      ...prev,
      ...r.data,
      relatedLeads: prev.relatedLeads,
      clinicalDetails: prev.clinicalDetails,
      patientImages: prev.patientImages,
    }));
    const L = r.data.detail.lead!;
    setSummary(L.summary ?? "");
    setStatus(L.status);
    setPriority(L.priority ?? "");
    setOwnerId(L.primary_owner_user_id ?? "");
    router.refresh();
  }, [tenantId, leadId, router]);

  const onSaveBasics = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canMutate) return;
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
      setPayload((p) => ({ ...p, detail: { ...p.detail, lead: optimistic } }));
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
          setPayload((p) => ({ ...p, detail: { ...p.detail, lead: snap } }));
          setDetailErr(r.error);
          return;
        }
        setPayload((p) => ({ ...p, detail: { ...p.detail, lead: r.lead } }));
        router.refresh();
      } finally {
        setDetailBusy(false);
      }
    },
    [canMutate, summary, status, priority, ownerId, lead, tenantId, router]
  );

  const onStageChange = useCallback(
    async (toStageId: string) => {
      if (!canMutate || toStageId === lead.current_stage_id) return;
      setStageErr(null);
      const snapLead = lead;
      const snapHist = payload.stageHistory;
      const optimisticLead = { ...lead, current_stage_id: toStageId };
      setPayload((p) => ({
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
            source: MUTATION_SOURCE,
            fi_timeline_event_id: null,
            metadata: {},
          },
          ...snapHist,
        ],
      }));
      setStageBusy(true);
      try {
        const r = await crmMoveLeadStageAction(tenantId, lead.id, {
          toStageId,
          changedBy: operatorFiUserId,
          source: MUTATION_SOURCE,
        });
        if (!r.ok) {
          setPayload((p) => ({ ...p, detail: { ...p.detail, lead: snapLead }, stageHistory: snapHist }));
          setStageErr(r.error);
          return;
        }
        await refreshPayload();
      } finally {
        setStageBusy(false);
      }
    },
    [canMutate, lead, payload.stageHistory, tenantId, operatorFiUserId, refreshPayload]
  );

  const onAddTask = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canMutate) return;
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
        setPayload((p) => ({ ...p, detail: { ...p.detail, tasks: [r.task, ...p.detail.tasks] } }));
        router.refresh();
      } finally {
        setTaskBusy(false);
      }
    },
    [canMutate, taskTitle, tenantId, lead.id, router]
  );

  const onCompleteTask = useCallback(
    async (taskId: string) => {
      if (!canMutate) return;
      const snap = payload.detail.tasks;
      const optimistic = snap.map((t) =>
        t.id === taskId ? { ...t, status: "done" as const, completed_at: new Date().toISOString() } : t
      );
      setPayload((p) => ({ ...p, detail: { ...p.detail, tasks: optimistic } }));
      const r = await completeCrmTaskAction(tenantId, lead.id, taskId, {});
      if (!r.ok) {
        setPayload((p) => ({ ...p, detail: { ...p.detail, tasks: snap } }));
        return;
      }
      setPayload((p) => ({
        ...p,
        detail: { ...p.detail, tasks: p.detail.tasks.map((t) => (t.id === taskId ? r.task : t)) },
      }));
      router.refresh();
    },
    [canMutate, payload.detail.tasks, tenantId, lead.id, router]
  );

  const onAddGeneralNote = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canMutate) return;
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
        setPayload((p) => ({ ...p, detail: { ...p.detail, notes: [r.note, ...p.detail.notes] } }));
        router.refresh();
      } finally {
        setNoteBusy(false);
      }
    },
    [canMutate, noteBody, tenantId, lead.id, router]
  );

  const onAddLeadNote = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canMutate) return;
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
        setPayload((p) => ({ ...p, detail: { ...p.detail, leadNotes: [r.note, ...p.detail.leadNotes] } }));
        router.refresh();
      } finally {
        setLeadNoteBusy(false);
      }
    },
    [canMutate, leadNoteBody, tenantId, lead.id, router]
  );

  return {
    payload,
    lead,
    personName,
    canMutate,
    opportunity,
    nextAction,
    openTaskCount,
    pendingReminderCount,
    summary,
    setSummary,
    status,
    setStatus,
    priority,
    setPriority,
    ownerId,
    setOwnerId,
    detailBusy,
    detailErr,
    stageBusy,
    stageErr,
    taskTitle,
    setTaskTitle,
    taskBusy,
    taskErr,
    noteBody,
    setNoteBody,
    noteBusy,
    noteErr,
    leadNoteBody,
    setLeadNoteBody,
    leadNoteBusy,
    leadNoteErr,
    onSaveBasics,
    onStageChange,
    onAddTask,
    onCompleteTask,
    onAddGeneralNote,
    onAddLeadNote,
  };
}
