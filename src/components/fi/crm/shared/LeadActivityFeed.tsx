"use client";

import type { FiCrmActivityEventRow } from "@/src/lib/crm/types";
import { crmLeadCardClass } from "./crmSharedStyles";

const ACTIVITY_KIND_LABELS: Record<string, string> = {
  "email.clinic.inbound": "Inbound clinic email",
  "email.clinic.outbound": "Outbound clinic email",
  "lead_communication.created": "Outreach logged",
  "lead.created": "New enquiry",
  "stage.changed": "Stage changed",
  "booking.created": "Consultation booked",
};

function activityLabel(ev: FiCrmActivityEventRow): string {
  const mapped = ACTIVITY_KIND_LABELS[ev.activity_kind.trim()];
  if (mapped) return mapped;
  return ev.title?.trim() || ev.activity_kind;
}

function activityDetail(ev: FiCrmActivityEventRow): string | null {
  const detail = ev.detail;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const preview = detail.subject_preview;
  if (typeof preview === "string" && preview.trim()) return preview.trim();
  return null;
}

export type LeadActivityFeedProps = {
  events: FiCrmActivityEventRow[];
  limit?: number;
  emptyMessage?: string;
};

export function LeadActivityFeed({
  events,
  limit = 8,
  emptyMessage = "No timeline events yet.",
}: LeadActivityFeedProps) {
  const items = events.slice(0, limit);

  return (
    <section className={crmLeadCardClass}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Activity</h3>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{emptyMessage}</p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
          {items.map((ev) => (
            <li key={ev.id} className="border-l-2 border-white/[0.06] pl-2">
              <span className="text-gray-500">{ev.occurred_at}</span>{" "}
              <span className="font-medium text-slate-100">{activityLabel(ev)}</span>
              {activityDetail(ev) ? <p className="text-slate-400">{activityDetail(ev)}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
