import type {
  FiCrmActivityEventRow,
  FiCrmLeadRow,
  FiCrmMessageRow,
  FiCrmNoteRow,
  FiCrmPipelineStageRow,
  FiCrmTaskRow,
} from "@/src/lib/crm";

const card = "rounded border border-gray-200 bg-white p-4 shadow-sm";

export function CrmPipelinePanel({ stages }: { stages: FiCrmPipelineStageRow[] }) {
  if (stages.length === 0) {
    return (
      <section className={card}>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Pipeline stages</h2>
        <p className="text-sm text-gray-600">No pipeline stages returned. Default seeding may be misconfigured for this scope.</p>
      </section>
    );
  }
  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Pipeline stages</h2>
      <ul className="divide-y divide-gray-100 text-sm">
        {stages.map((s) => (
          <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
            <span className="font-medium text-gray-800">{s.label}</span>
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
      <h2 className="mb-2 text-sm font-semibold text-gray-900">Lead</h2>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-gray-500">ID</dt>
          <dd className="font-mono text-xs text-gray-900">{lead.id}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Person</dt>
          <dd className="font-mono text-xs text-gray-900">{lead.person_id}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Current stage</dt>
          <dd className="font-mono text-xs text-gray-900">{lead.current_stage_id ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Status</dt>
          <dd className="text-gray-900">{lead.status}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-gray-500">Summary</dt>
          <dd className="text-gray-900">{lead.summary?.trim() ? lead.summary : "—"}</dd>
        </div>
      </dl>
    </section>
  );
}

export function CrmActivityPanel({ events }: { events: FiCrmActivityEventRow[] }) {
  if (events.length === 0) {
    return (
      <section className={card}>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Activity</h2>
        <p className="text-sm text-gray-600">No CRM activity events yet for this lead.</p>
      </section>
    );
  }
  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Activity timeline</h2>
      <ul className="max-h-80 space-y-3 overflow-y-auto text-sm">
        {events.map((e) => (
          <li key={e.id} className="border-l-2 border-gray-200 pl-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <time dateTime={e.occurred_at}>{e.occurred_at}</time>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700">{e.activity_kind}</span>
            </div>
            {e.title ? <p className="mt-0.5 font-medium text-gray-900">{e.title}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CrmTasksPanel({ tasks }: { tasks: FiCrmTaskRow[] }) {
  if (tasks.length === 0) {
    return (
      <section className={card}>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Tasks</h2>
        <p className="text-sm text-gray-600">No tasks on this lead.</p>
      </section>
    );
  }
  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Tasks</h2>
      <ul className="space-y-2 text-sm">
        {tasks.map((t) => (
          <li key={t.id} className="rounded bg-gray-50 p-2">
            <span className="font-medium text-gray-900">{t.title}</span>
            <span className="ml-2 text-xs text-gray-500">{t.status}</span>
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
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Notes</h2>
        <p className="text-sm text-gray-600">No notes on this lead.</p>
      </section>
    );
  }
  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Notes</h2>
      <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
        {notes.map((n) => (
          <li key={n.id} className="rounded border border-gray-100 p-2">
            <p className="whitespace-pre-wrap text-gray-800">{n.body}</p>
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
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Message previews</h2>
        <p className="text-sm text-gray-600">No message preview rows for this lead.</p>
      </section>
    );
  }
  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">Message previews</h2>
      <ul className="space-y-2 text-sm">
        {messages.map((m) => (
          <li key={m.id} className="rounded bg-gray-50 p-2">
            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
              <span>{m.channel}</span>
              <span>{m.direction}</span>
              {m.subject ? <span className="font-medium text-gray-800">{m.subject}</span> : null}
            </div>
            {m.body_preview ? <p className="mt-1 text-gray-800">{m.body_preview}</p> : <p className="mt-1 text-gray-400">No preview text</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
