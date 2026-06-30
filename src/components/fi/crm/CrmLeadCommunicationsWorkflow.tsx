"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  archiveCrmLeadCommunicationAction,
  createCrmLeadCommunicationAction,
  updateCrmLeadCommunicationAction,
} from "@/lib/actions/fi-crm-actions";
import type { FiCrmLeadCommunicationRow } from "@/src/lib/crm";
import {
  CRM_LEAD_COMMUNICATION_DIRECTION_VALUES,
  CRM_LEAD_COMMUNICATION_OUTCOME_VALUES,
  CRM_LEAD_COMMUNICATION_TYPE_VALUES,
  sortCrmLeadCommunicationsForDisplay,
} from "@/src/lib/crm";

const card = "rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40";

const OUTCOME_OPTIONS: (string | "")[] = ["", ...CRM_LEAD_COMMUNICATION_OUTCOME_VALUES];

function parseMetadataJson(raw: string): Record<string, unknown> | null {
  const t = raw.trim();
  if (!t) return {};
  try {
    const v = JSON.parse(t) as unknown;
    if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
    return v as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function CrmLeadCommunicationsWorkflow({
  tenantId,
  leadId,
  leadCommunications,
}: {
  tenantId: string;
  leadId: string;
  leadCommunications: FiCrmLeadCommunicationRow[];
}) {
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [createType, setCreateType] = useState<string>("phone");
  const [createDir, setCreateDir] = useState<string>("outbound");
  const [createOutcome, setCreateOutcome] = useState<string>("");
  const [createSubject, setCreateSubject] = useState("");
  const [createPreview, setCreatePreview] = useState("");
  const [createContactAt, setCreateContactAt] = useState("");
  const [createNextFollowUp, setCreateNextFollowUp] = useState("");
  const [createExtMsg, setCreateExtMsg] = useState("");
  const [createExtThread, setCreateExtThread] = useState("");
  const [createMetadataJson, setCreateMetadataJson] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState("");
  const [editDir, setEditDir] = useState("");
  const [editOutcome, setEditOutcome] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editPreview, setEditPreview] = useState("");
  const [editContactAt, setEditContactAt] = useState("");
  const [editNextFollowUp, setEditNextFollowUp] = useState("");
  const [editMetadataJson, setEditMetadataJson] = useState("");

  const active = useMemo(() => leadCommunications.filter((c) => !c.archived_at), [leadCommunications]);
  const archived = useMemo(() => leadCommunications.filter((c) => !!c.archived_at), [leadCommunications]);

  const filteredActive = useMemo(() => {
    const base = typeFilter === "all" ? active : active.filter((c) => c.communication_type === typeFilter);
    return sortCrmLeadCommunicationsForDisplay(base);
  }, [active, typeFilter]);

  const sortedArchived = useMemo(() => sortCrmLeadCommunicationsForDisplay(archived), [archived]);

  function withAdmin<T extends Record<string, unknown>>(body: T): T & { adminKey?: string } {
    if (adminKey.trim()) return { ...body, adminKey: adminKey.trim() };
    return body;
  }

  function startEdit(c: FiCrmLeadCommunicationRow) {
    setEditingId(c.id);
    setEditType(c.communication_type);
    setEditDir(c.direction);
    setEditOutcome(c.outcome ?? "");
    setEditSubject(c.subject ?? "");
    setEditPreview(c.preview ?? "");
    setEditContactAt(c.contact_at);
    setEditNextFollowUp(c.next_follow_up_at ?? "");
    setEditMetadataJson(c.metadata && Object.keys(c.metadata).length ? JSON.stringify(c.metadata, null, 0) : "");
    setFeedback(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const meta = parseMetadataJson(createMetadataJson);
    if (meta === null) {
      setFeedback("Metadata must be valid JSON object.");
      return;
    }
    setBusy(true);
    try {
      const r = await createCrmLeadCommunicationAction(
        tenantId,
        leadId,
        withAdmin({
          communicationType: createType,
          direction: createDir,
          outcome: createOutcome.trim() ? createOutcome : null,
          subject: createSubject.trim() || null,
          preview: createPreview.trim() || null,
          externalMessageId: createExtMsg.trim() || null,
          externalThreadId: createExtThread.trim() || null,
          contactAt: createContactAt.trim() || null,
          nextFollowUpAt: createNextFollowUp.trim() || null,
          metadata: meta,
        })
      );
      setFeedback(r.ok ? "Contact log entry saved." : r.error);
      if (r.ok) {
        setCreateType("phone");
        setCreateDir("outbound");
        setCreateOutcome("");
        setCreateSubject("");
        setCreatePreview("");
        setCreateContactAt("");
        setCreateNextFollowUp("");
        setCreateExtMsg("");
        setCreateExtThread("");
        setCreateMetadataJson("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(communicationId: string) {
    setFeedback(null);
    const meta = parseMetadataJson(editMetadataJson);
    if (meta === null) {
      setFeedback("Metadata must be valid JSON object.");
      return;
    }
    setBusy(true);
    try {
      const r = await updateCrmLeadCommunicationAction(
        tenantId,
        leadId,
        communicationId,
        withAdmin({
          communicationType: editType,
          direction: editDir,
          outcome: editOutcome.trim() ? editOutcome : null,
          subject: editSubject.trim() || null,
          preview: editPreview.trim() || null,
          contactAt: editContactAt.trim(),
          nextFollowUpAt: editNextFollowUp.trim() ? editNextFollowUp.trim() : null,
          metadata: meta,
        })
      );
      setFeedback(r.ok ? "Entry updated." : r.error);
      if (r.ok) {
        setEditingId(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onArchive(communicationId: string) {
    setFeedback(null);
    setBusy(true);
    try {
      const r = await archiveCrmLeadCommunicationAction(tenantId, leadId, communicationId, withAdmin({}));
      setFeedback(r.ok ? "Entry archived." : r.error);
      if (r.ok) {
        setEditingId(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card}>
      <h2 className="mb-1 text-sm font-semibold text-slate-100">Contact log</h2>
      <p className="mb-2 text-xs text-slate-400">
        This is a contact log. Full message storage will be added in a later communications phase.
      </p>

      <label className="mb-3 block max-w-md text-xs">
        <span className="text-slate-400">FI admin key (optional)</span>
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1"
        />
      </label>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">Filter by type</span>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border border-slate-700 px-2 py-1"
        >
          <option value="all">All types</option>
          {CRM_LEAD_COMMUNICATION_TYPE_VALUES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={onCreate} className="mb-6 space-y-2 rounded border border-white/[0.06] bg-white/[0.03] p-3 text-sm">
        <h3 className="font-medium text-slate-100">New entry</h3>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs text-slate-400">
            Type
            <select value={createType} onChange={(e) => setCreateType(e.target.value)} className="ml-1 rounded border border-slate-700 px-2 py-1 text-xs">
              {CRM_LEAD_COMMUNICATION_TYPE_VALUES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Direction
            <select value={createDir} onChange={(e) => setCreateDir(e.target.value)} className="ml-1 rounded border border-slate-700 px-2 py-1 text-xs">
              {CRM_LEAD_COMMUNICATION_DIRECTION_VALUES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Outcome
            <select value={createOutcome} onChange={(e) => setCreateOutcome(e.target.value)} className="ml-1 rounded border border-slate-700 px-2 py-1 text-xs">
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o || "none"} value={o}>
                  {o || "(none)"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <input
          value={createSubject}
          onChange={(e) => setCreateSubject(e.target.value)}
          className="w-full rounded border border-slate-700 px-2 py-1 text-sm"
          placeholder="Subject (optional)"
        />
        <textarea
          value={createPreview}
          onChange={(e) => setCreatePreview(e.target.value)}
          rows={2}
          className="w-full rounded border border-slate-700 px-2 py-1 text-sm"
          placeholder="Preview / summary (optional)"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-400">
            Contact at (ISO, optional — default now)
            <input
              value={createContactAt}
              onChange={(e) => setCreateContactAt(e.target.value)}
              className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1 font-mono text-xs"
              placeholder="2026-06-05T12:00:00.000Z"
            />
          </label>
          <label className="text-xs text-slate-400">
            Next follow-up (ISO, optional)
            <input
              value={createNextFollowUp}
              onChange={(e) => setCreateNextFollowUp(e.target.value)}
              className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1 font-mono text-xs"
              placeholder="2026-06-10T09:00:00.000Z"
            />
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={createExtMsg}
            onChange={(e) => setCreateExtMsg(e.target.value)}
            className="rounded border border-slate-700 px-2 py-1 text-xs"
            placeholder="External message id (optional)"
          />
          <input
            value={createExtThread}
            onChange={(e) => setCreateExtThread(e.target.value)}
            className="rounded border border-slate-700 px-2 py-1 text-xs"
            placeholder="External thread id (optional)"
          />
        </div>
        <label className="block text-xs text-slate-400">
          Metadata JSON (optional object)
          <textarea
            value={createMetadataJson}
            onChange={(e) => setCreateMetadataJson(e.target.value)}
            rows={2}
            className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1 font-mono text-xs"
            placeholder="{}"
          />
        </label>
        <button type="submit" disabled={busy} className="rounded bg-gray-800 px-2 py-1 text-xs text-white disabled:opacity-50">
          Add to contact log
        </button>
      </form>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Active entries</h3>
      {filteredActive.length === 0 ? (
        <p className="mb-4 text-sm text-slate-400">No contact log entries match this filter.</p>
      ) : (
        <ul className="mb-4 space-y-3 text-sm">
          {filteredActive.map((c) => (
            <li key={c.id} className="rounded border border-white/[0.06] p-3">
              {editingId === c.id ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-3">
                    <select value={editType} onChange={(e) => setEditType(e.target.value)} className="rounded border border-slate-700 px-2 py-1 text-xs">
                      {CRM_LEAD_COMMUNICATION_TYPE_VALUES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <select value={editDir} onChange={(e) => setEditDir(e.target.value)} className="rounded border border-slate-700 px-2 py-1 text-xs">
                      {CRM_LEAD_COMMUNICATION_DIRECTION_VALUES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <select value={editOutcome} onChange={(e) => setEditOutcome(e.target.value)} className="rounded border border-slate-700 px-2 py-1 text-xs">
                      {OUTCOME_OPTIONS.map((o) => (
                        <option key={o || "none"} value={o}>
                          {o || "(none)"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="w-full rounded border border-slate-700 px-2 py-1 text-sm" />
                  <textarea value={editPreview} onChange={(e) => setEditPreview(e.target.value)} rows={2} className="w-full rounded border border-slate-700 px-2 py-1 text-sm" />
                  <input
                    value={editContactAt}
                    onChange={(e) => setEditContactAt(e.target.value)}
                    className="w-full rounded border border-slate-700 px-2 py-1 font-mono text-xs"
                  />
                  <input
                    value={editNextFollowUp}
                    onChange={(e) => setEditNextFollowUp(e.target.value)}
                    className="w-full rounded border border-slate-700 px-2 py-1 font-mono text-xs"
                    placeholder="Next follow-up (ISO or empty)"
                  />
                  <textarea value={editMetadataJson} onChange={(e) => setEditMetadataJson(e.target.value)} rows={2} className="w-full font-mono text-xs" />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => onSaveEdit(c.id)} className="rounded bg-gray-800 px-2 py-1 text-xs text-white disabled:opacity-50">
                      Save
                    </button>
                    <button type="button" disabled={busy} onClick={cancelEdit} className="rounded border border-slate-700 px-2 py-1 text-xs disabled:opacity-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                      <span className="font-medium text-slate-200">{c.communication_type}</span>
                      <span>{c.direction}</span>
                      {c.outcome ? <span className="rounded bg-white/[0.06] px-1.5 py-0.5">{c.outcome}</span> : null}
                    </div>
                    {c.subject ? <p className="mt-1 font-medium text-slate-100">{c.subject}</p> : null}
                    {c.preview ? <p className="mt-1 text-slate-300">{c.preview}</p> : null}
                    <p className="mt-1 text-xs text-gray-500">Contact: {c.contact_at}</p>
                    {c.next_follow_up_at ? (
                      <p className="mt-1 text-xs font-semibold text-amber-300">Next follow-up: {c.next_follow_up_at}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button type="button" disabled={busy} onClick={() => startEdit(c)} className="rounded border border-slate-700 px-2 py-0.5 text-xs disabled:opacity-50">
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onArchive(c.id)}
                      className="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-300 disabled:opacity-50"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-white/[0.06] pt-3">
        <button type="button" className="text-xs font-medium text-blue-300 hover:underline" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Hide" : "Show"} archived entries{archived.length ? ` (${archived.length})` : ""}
        </button>
        {showArchived && sortedArchived.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm text-slate-400">
            {sortedArchived.map((c) => (
              <li key={c.id} className="rounded border border-dashed border-white/[0.08] bg-white/[0.03] p-2">
                <p className="text-xs text-gray-500">Archived {c.archived_at}</p>
                <p className="text-xs">
                  {c.communication_type} · {c.direction}
                  {c.outcome ? ` · ${c.outcome}` : ""}
                </p>
                {c.subject ? <p className="mt-1 text-slate-200">{c.subject}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {showArchived && sortedArchived.length === 0 ? <p className="mt-2 text-xs text-gray-500">No archived entries.</p> : null}
      </div>

      {feedback ? <p className="mt-3 text-sm text-slate-200">{feedback}</p> : null}
    </section>
  );
}
