"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  crmCreateMessagePreviewAction,
  crmCreateNoteAction,
  crmMoveLeadStageAction,
} from "@/lib/actions/fi-crm-actions";
import { useCrmLeadSlideOver } from "./LeadSlideOver";

type StageOpt = { id: string; label: string; slug: string };

export function CrmLeadSmokeForms({
  tenantId,
  leadId,
  stages,
}: {
  tenantId: string;
  leadId: string;
  stages: StageOpt[];
}) {
  const { operatorFiUserId: fiUserId } = useCrmLeadSlideOver();
  const router = useRouter();
  const [adminKey, setAdminKey] = useState("");
  const [toStageId, setToStageId] = useState(stages[0]?.id ?? "");
  const [noteBody, setNoteBody] = useState("");
  const [msgChannel, setMsgChannel] = useState("email");
  const [msgDirection, setMsgDirection] = useState<"inbound" | "outbound">("inbound");
  const [msgPreview, setMsgPreview] = useState("");
  const [msgSubject, setMsgSubject] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function withAdmin<T extends Record<string, unknown>>(body: T): T & { adminKey?: string } {
    if (adminKey.trim()) return { ...body, adminKey: adminKey.trim() };
    return body;
  }

  async function doMove(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!toStageId) {
      setFeedback("Pick a target stage.");
      return;
    }
    setBusy(true);
    try {
      const r = await crmMoveLeadStageAction(
        tenantId,
        leadId,
        withAdmin({ toStageId, changedBy: fiUserId })
      );
      setFeedback(r.ok ? "Stage updated." : r.error);
      if (r.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function doNote(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      const r = await crmCreateNoteAction(
        tenantId,
        leadId,
        withAdmin({ body: noteBody, visibility: "team" })
      );
      setFeedback(r.ok ? "Note added." : r.error);
      if (r.ok) {
        setNoteBody("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function doMsg(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      const r = await crmCreateMessagePreviewAction(
        tenantId,
        leadId,
        withAdmin({
          preview: {
            channel: msgChannel.trim() || "email",
            direction: msgDirection,
            subject: msgSubject.trim() || null,
            body_preview: msgPreview.trim() || null,
          },
        })
      );
      setFeedback(r.ok ? "Message preview saved." : r.error);
      if (r.ok) {
        setMsgPreview("");
        setMsgSubject("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded border border-dashed border-amber-300 bg-amber-400/10 p-4">
      <h2 className="mb-2 text-sm font-semibold text-amber-200">Smoke: mutations (this lead)</h2>
      <p className="mb-3 text-xs text-amber-300">All calls go through gated server actions only.</p>
      <label className="mb-4 block max-w-md text-xs">
        <span className="text-slate-400">FI admin key (optional)</span>
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          className="mt-0.5 w-full rounded border border-slate-700 px-2 py-1"
        />
      </label>

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={doMove}
          className="space-y-2 rounded border border-amber-400/20 bg-white/80 p-3 text-sm"
        >
          <h3 className="font-medium text-slate-100">Move stage</h3>
          {stages.length === 0 ? (
            <p className="text-xs text-slate-400">No stages available.</p>
          ) : (
            <>
              <select
                value={toStageId}
                onChange={(e) => setToStageId(e.target.value)}
                className="w-full rounded border border-slate-700 px-2 py-1"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.slug})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-gray-800 px-2 py-1 text-xs text-white disabled:opacity-50"
              >
                Move to stage
              </button>
            </>
          )}
        </form>

        <form
          onSubmit={doNote}
          className="space-y-2 rounded border border-amber-400/20 bg-white/80 p-3 text-sm"
        >
          <h3 className="font-medium text-slate-100">Foundation note (fi_crm_notes)</h3>
          <p className="text-xs text-slate-400">
            Smoke path for the general notes table — internal lead notes use the dedicated section
            on this page.
          </p>
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            rows={3}
            className="w-full rounded border border-slate-700 px-2 py-1 text-sm"
            placeholder="Note body"
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-gray-800 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            Save note
          </button>
        </form>

        <form
          onSubmit={doMsg}
          className="space-y-2 rounded border border-amber-400/20 bg-white/80 p-3 text-sm"
        >
          <h3 className="font-medium text-slate-100">Message preview</h3>
          <div className="flex flex-wrap gap-2">
            <input
              value={msgChannel}
              onChange={(e) => setMsgChannel(e.target.value)}
              className="w-24 rounded border border-slate-700 px-2 py-1 text-xs"
              placeholder="channel"
            />
            <select
              value={msgDirection}
              onChange={(e) => setMsgDirection(e.target.value as "inbound" | "outbound")}
              className="rounded border border-slate-700 px-2 py-1 text-xs"
            >
              <option value="inbound">inbound</option>
              <option value="outbound">outbound</option>
            </select>
          </div>
          <input
            value={msgSubject}
            onChange={(e) => setMsgSubject(e.target.value)}
            className="w-full rounded border border-slate-700 px-2 py-1 text-xs"
            placeholder="Subject (optional)"
          />
          <textarea
            value={msgPreview}
            onChange={(e) => setMsgPreview(e.target.value)}
            rows={2}
            className="w-full rounded border border-slate-700 px-2 py-1 text-xs"
            placeholder="body_preview only"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-gray-800 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            Save preview
          </button>
        </form>
      </div>

      {feedback ? <p className="mt-3 text-sm text-slate-200">{feedback}</p> : null}
    </section>
  );
}
