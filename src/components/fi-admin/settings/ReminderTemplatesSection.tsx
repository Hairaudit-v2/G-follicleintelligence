"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createReminderTemplateAction,
  deleteReminderTemplateAction,
  loadReminderTemplatesAction,
  previewReminderTemplateAction,
  updateReminderTemplateAction,
} from "@/lib/actions/fi-reminder-template-actions";
import { REMINDER_PLACEHOLDER_KEYS } from "@/src/lib/reminders/remindersCore";
import type { FiReminderTemplateRow } from "@/src/lib/reminders/reminderTypes";
import { REMINDER_TEMPLATE_TYPES, REMINDER_TRIGGER_EVENTS } from "@/src/lib/reminders/reminderConstants";

const inputClass =
  "w-full rounded-lg border border-white/[0.1] bg-[#081020]/85 px-2 py-1.5 text-sm text-[#F8FAFC] shadow-inner outline-none transition placeholder:text-[#475569] focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20";

const sectionClass =
  "rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 shadow-lg shadow-black/25 backdrop-blur-md sm:p-5";

export function ReminderTemplatesSection(props: {
  tenantId: string;
  initialTemplates: FiReminderTemplateRow[];
}) {
  const { tenantId } = props;
  const [templates, setTemplates] = useState(props.initialTemplates);
  const [adminKey, setAdminKey] = useState("");
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof REMINDER_TEMPLATE_TYPES)[number]>("email");
  const [trigger, setTrigger] = useState<(typeof REMINDER_TRIGGER_EVENTS)[number]>("booking_24h_before");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(
    "Hi {{patient_name}}, this is a reminder about {{booking_title}} on {{booking_time}} at {{clinic_name}}."
  );
  const [isActive, setIsActive] = useState(true);
  const [preview, setPreview] = useState<{ subject: string | null; body: string } | null>(null);

  const sorted = useMemo(() => [...templates].sort((a, b) => b.created_at.localeCompare(a.created_at)), [templates]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setType("email");
    setTrigger("booking_24h_before");
    setSubject("");
    setBody("Hi {{patient_name}}, this is a reminder about {{booking_title}} on {{booking_time}} at {{clinic_name}}.");
    setIsActive(true);
    setPreview(null);
    setMsg(null);
  }

  function startEdit(row: FiReminderTemplateRow) {
    setEditingId(row.id);
    setName(row.name);
    setType(row.type);
    setTrigger(row.trigger_event);
    setSubject(row.subject ?? "");
    setBody(row.body);
    setIsActive(row.is_active);
    setPreview(null);
    setMsg(null);
  }

  function withAdmin<T extends Record<string, unknown>>(body: T): T & { adminKey?: string } {
    if (adminKey.trim()) return { ...body, adminKey: adminKey.trim() };
    return body;
  }

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <h2 className="mb-2 text-base font-semibold text-[#F8FAFC]">Merge fields</h2>
        <p className="text-xs text-[#94A3B8]">
          Use these tokens in subject/body:{" "}
          {REMINDER_PLACEHOLDER_KEYS.map((k) => (
            <code key={k} className="mr-1 rounded bg-[#141C33] px-1 py-0.5 text-[11px] text-[#22C1FF]">
              {k}
            </code>
          ))}
        </p>
      </div>

      <div className={sectionClass}>
        <h2 className="mb-3 text-base font-semibold text-[#F8FAFC]">{editingId ? "Edit template" : "New template"}</h2>
        <label className="mb-2 block text-xs text-[#94A3B8]">
          FI Admin key (optional — required when your session role cannot write CRM mutations alone)
          <input
            type="password"
            className={`${inputClass} mt-1`}
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-[#94A3B8]">
            Name
            <input className={`${inputClass} mt-1`} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-xs text-[#94A3B8]">
            Channel
            <select className={`${inputClass} mt-1`} value={type} onChange={(e) => setType(e.target.value as (typeof REMINDER_TEMPLATE_TYPES)[number])}>
              {REMINDER_TEMPLATE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[#94A3B8] sm:col-span-2">
            Trigger
            <select
              className={`${inputClass} mt-1`}
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as (typeof REMINDER_TRIGGER_EVENTS)[number])}
            >
              {REMINDER_TRIGGER_EVENTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {type === "email" ? (
            <label className="block text-xs text-[#94A3B8] sm:col-span-2">
              Subject
              <input className={`${inputClass} mt-1`} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
          ) : null}
          <label className="block text-xs text-[#94A3B8] sm:col-span-2">
            Body
            <textarea className={`${inputClass} mt-1`} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-xs text-[#94A3B8] sm:col-span-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:from-cyan-500 hover:to-sky-500 disabled:opacity-50"
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                const r = await previewReminderTemplateAction({ body, subject: type === "email" ? subject : null });
                if (!r.ok) setMsg(r.error);
                else setPreview({ subject: r.subject, body: r.body });
              });
            }}
          >
            Preview sample
          </button>
          <button
            type="button"
            disabled={busy || !name.trim() || !body.trim()}
            className="rounded-lg border border-white/[0.12] bg-[#141C33]/80 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] hover:border-[#22C1FF]/35 disabled:opacity-50"
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                if (editingId) {
                  const r = await updateReminderTemplateAction(
                    tenantId,
                    editingId,
                    withAdmin({
                      name: name.trim(),
                      type,
                      trigger_event: trigger,
                      subject: type === "email" ? subject.trim() || null : null,
                      body: body.trim(),
                      is_active: isActive,
                    })
                  );
                  if (!r.ok) {
                    setMsg(r.error);
                    return;
                  }
                  setTemplates((prev) =>
                    prev.map((t) =>
                      t.id === editingId
                        ? {
                            ...t,
                            name: name.trim(),
                            type,
                            trigger_event: trigger,
                            subject: type === "email" ? subject.trim() || null : null,
                            body: body.trim(),
                            is_active: isActive,
                            updated_at: new Date().toISOString(),
                          }
                        : t
                    )
                  );
                  resetForm();
                  setMsg("Saved.");
                } else {
                  const r = await createReminderTemplateAction(
                    tenantId,
                    withAdmin({
                      name: name.trim(),
                      type,
                      trigger_event: trigger,
                      subject: type === "email" ? subject.trim() || null : null,
                      body: body.trim(),
                      is_active: isActive,
                    })
                  );
                  if (!r.ok) {
                    setMsg(r.error);
                    return;
                  }
                  const reload = await loadReminderTemplatesAction(tenantId);
                  if (reload.ok) setTemplates(reload.templates);
                  resetForm();
                  setMsg("Created.");
                }
              });
            }}
          >
            {editingId ? "Save changes" : "Create template"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-xs text-[#94A3B8] hover:text-[#F8FAFC]"
              onClick={() => resetForm()}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
        {preview ? (
          <div className="mt-4 rounded-lg border border-white/[0.08] bg-[#081020]/60 p-3 text-xs text-[#CBD5E1]">
            <p className="font-semibold text-[#94A3B8]">Preview</p>
            {preview.subject ? <p className="mt-1 text-[#F8FAFC]">Subject: {preview.subject}</p> : null}
            <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-relaxed">{preview.body}</pre>
          </div>
        ) : null}
        {msg ? <p className="mt-2 text-xs text-[#94A3B8]">{msg}</p> : null}
      </div>

      <div className={sectionClass}>
        <h2 className="mb-3 text-base font-semibold text-[#F8FAFC]">Templates</h2>
        {sorted.length === 0 ? (
          <p className="text-sm text-[#94A3B8]">No templates yet. Create one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs text-[#CBD5E1]">
              <thead className="text-[#64748B]">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Name</th>
                  <th className="pb-2 pr-3 font-medium">Type</th>
                  <th className="pb-2 pr-3 font-medium">Trigger</th>
                  <th className="pb-2 pr-3 font-medium">Active</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.id} className="border-t border-white/[0.06]">
                    <td className="py-2 pr-3 align-top text-[#F8FAFC]">{row.name}</td>
                    <td className="py-2 pr-3 align-top">{row.type}</td>
                    <td className="py-2 pr-3 align-top font-mono text-[11px]">{row.trigger_event}</td>
                    <td className="py-2 pr-3 align-top">{row.is_active ? "yes" : "no"}</td>
                    <td className="py-2 align-top">
                      <button type="button" className="mr-2 text-[#22C1FF] hover:underline" onClick={() => startEdit(row)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-rose-300 hover:underline"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm("Delete this template? Pending jobs for this template will be removed by FK cascade.")) return;
                          startTransition(async () => {
                            const r = await deleteReminderTemplateAction(tenantId, row.id, adminKey.trim() || undefined);
                            if (!r.ok) {
                              setMsg(r.error);
                              return;
                            }
                            setTemplates((prev) => prev.filter((t) => t.id !== row.id));
                            if (editingId === row.id) resetForm();
                          });
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
