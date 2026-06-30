import type {
  FiCrmActivityEventRow,
  FiCrmLeadRow,
  FiCrmMessageRow,
  FiCrmNoteRow,
  FiCrmPipelineStageRow,
} from "@/src/lib/crm";

const card =
  "rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40";

export function CrmPipelinePanel({ stages }: { stages: FiCrmPipelineStageRow[] }) {
  if (stages.length === 0) {
    return (
      <section className={card}>
        <h2 className="mb-2 text-sm font-semibold text-slate-100">Pipeline stages</h2>
        <p className="text-sm text-slate-400">
          No pipeline stages returned. Default seeding may be misconfigured for this scope.
        </p>
      </section>
    );
  }
  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold text-slate-100">Pipeline stages</h2>
      <ul className="divide-y divide-white/[0.06] text-sm">
        {stages.map((s) => (
          <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
            <span className="font-medium text-slate-200">{s.label}</span>
            <span className="text-xs text-gray-500">
              {s.slug}
              {s.is_entry ? " · entry" : ""}
              {s.is_won ? " · won" : ""}
              {s.is_lost ? " · lost" : ""}
            </span>
            <code className="w-full text-xs text-gray-400">{s.id}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CrmLeadSummaryPanel({ lead }: { lead: FiCrmLeadRow }) {
  return (
    <section className={card}>
      <h2 className="mb-2 text-sm font-semibold text-slate-100">Lead</h2>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-gray-500">ID</dt>
          <dd className="font-mono text-xs text-slate-100">{lead.id}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Person</dt>
          <dd className="font-mono text-xs text-slate-100">{lead.person_id}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Current stage</dt>
          <dd className="font-mono text-xs text-slate-100">{lead.current_stage_id ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Status</dt>
          <dd className="text-slate-100">{lead.status}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-gray-500">Summary</dt>
          <dd className="text-slate-100">{lead.summary?.trim() ? lead.summary : "—"}</dd>
        </div>
      </dl>
    </section>
  );
}

export function CrmActivityPanel({ events }: { events: FiCrmActivityEventRow[] }) {
  if (events.length === 0) {
    return (
      <section className={card}>
        <h2 className="mb-2 text-sm font-semibold text-slate-100">Activity</h2>
        <p className="text-sm text-slate-400">No CRM activity events yet for this lead.</p>
      </section>
    );
  }
  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold text-slate-100">Activity timeline</h2>
      <ul className="max-h-80 space-y-3 overflow-y-auto text-sm">
        {events.map((e) => (
          <li key={e.id} className="border-l-2 border-white/[0.08] pl-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <time dateTime={e.occurred_at}>{e.occurred_at}</time>
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-slate-300">
                {e.activity_kind}
              </span>
            </div>
            {e.title ? <p className="mt-0.5 font-medium text-slate-100">{e.title}</p> : null}
            {"changed_keys" in e.detail &&
            Array.isArray((e.detail as { changed_keys: unknown }).changed_keys) ? (
              <p className="mt-0.5 text-xs text-slate-400">
                Fields: {(e.detail as { changed_keys: string[] }).changed_keys.join(", ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CrmNotesPanel({ notes }: { notes: FiCrmNoteRow[] }) {
  if (notes.length === 0) {
    return (
      <section className={card}>
        <h2 className="mb-2 text-sm font-semibold text-slate-100">General CRM notes</h2>
        <p className="text-sm text-slate-400">No notes on this lead.</p>
      </section>
    );
  }
  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold text-slate-100">General CRM notes</h2>
      <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
        {notes.map((n) => (
          <li key={n.id} className="rounded border border-white/[0.06] p-2">
            <p className="whitespace-pre-wrap text-slate-200">{n.body}</p>
            <p className="mt-1 text-xs text-gray-400">{n.created_at}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CrmMessagesPanel({ messages }: { messages: FiCrmMessageRow[] }) {
  if (messages.length === 0) {
    return (
      <section className={card}>
        <h2 className="mb-2 text-sm font-semibold text-slate-100">Message previews</h2>
        <p className="text-sm text-slate-400">No message preview rows for this lead.</p>
      </section>
    );
  }
  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold text-slate-100">Message previews</h2>
      <ul className="space-y-2 text-sm">
        {messages.map((m) => (
          <li key={m.id} className="rounded bg-white/[0.03] p-2">
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span>{m.channel}</span>
              <span>{m.direction}</span>
              {m.subject ? <span className="font-medium text-slate-200">{m.subject}</span> : null}
            </div>
            {m.body_preview ? (
              <p className="mt-1 text-slate-200">{m.body_preview}</p>
            ) : (
              <p className="mt-1 text-gray-400">No preview text</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
