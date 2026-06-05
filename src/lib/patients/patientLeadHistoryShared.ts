import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import type { FiCrmLeadRow } from "@/src/lib/crm/types";
import { sortActivityEventsNewestFirst } from "./patientProfileSummary";

export type PatientPersonLeadHistoryItem = {
  lead: FiCrmLeadRow;
  stageLabel: string | null;
  ownerLabel: string | null;
  linkedToThisPatient: boolean;
};

export type PatientPersonCrmActivityItem = {
  id: string;
  occurred_at: string;
  activity_kind: string;
  title: string | null;
  lead_id: string;
  leadTitle: string | null;
  linkedToThisPatient: boolean;
};

export type PatientLeadHistoryTimelineRow =
  | {
      kind: "lead";
      id: string;
      occurredAt: string;
      item: PatientPersonLeadHistoryItem;
    }
  | {
      kind: "crm_activity";
      id: string;
      occurredAt: string;
      item: PatientPersonCrmActivityItem;
    };

/** Pick the best CRM lead anchor for booking prefill (linked to this patient first). */
export function pickPrimaryLeadForPatient(items: PatientPersonLeadHistoryItem[]): FiCrmLeadRow | null {
  const linked = items.filter((i) => i.linkedToThisPatient);
  if (linked.length > 0) return linked[0]!.lead;
  return items[0]?.lead ?? null;
}

export function buildPatientLeadHistoryTimeline(
  leads: PatientPersonLeadHistoryItem[],
  activity: PatientPersonCrmActivityItem[]
): PatientLeadHistoryTimelineRow[] {
  const rows: PatientLeadHistoryTimelineRow[] = [];

  for (const item of leads) {
    const at = item.lead.updated_at?.trim() || item.lead.created_at?.trim();
    if (!at) continue;
    rows.push({
      kind: "lead",
      id: `lead:${item.lead.id}`,
      occurredAt: at,
      item,
    });
  }

  for (const item of activity) {
    rows.push({
      kind: "crm_activity",
      id: `activity:${item.id}`,
      occurredAt: item.occurred_at,
      item,
    });
  }

  return rows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function mapPersonCrmActivityRows(
  rawRows: Record<string, unknown>[],
  leadItems: PatientPersonLeadHistoryItem[]
): PatientPersonCrmActivityItem[] {
  const titleByLeadId = new Map(
    leadItems.map((i) => [i.lead.id, leadTitleFromRow(i.lead.summary, i.lead.id)])
  );
  const linkedByLeadId = new Map(leadItems.map((i) => [i.lead.id, i.linkedToThisPatient]));

  const mapped = rawRows.map((r) => {
    const leadId = String(r.lead_id);
    return {
      id: String(r.id),
      occurred_at: String(r.occurred_at),
      activity_kind: String(r.activity_kind),
      title: r.title != null ? String(r.title) : null,
      lead_id: leadId,
      leadTitle: titleByLeadId.get(leadId) ?? null,
      linkedToThisPatient: linkedByLeadId.get(leadId) ?? false,
    };
  });

  return sortActivityEventsNewestFirst(mapped);
}
