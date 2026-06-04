import "server-only";

/**
 * Server loaders for FI Admin CRM shell (Stage 2E). Each route must call
 * `assertCrmShellPageAccess(tenantId)` before invoking these functions.
 */

import {
  ensureDefaultPipelineStages,
  loadCrmActivityTimelineForLead,
  loadCrmLeadById,
  loadCrmMessagesForLead,
  loadCrmNotesForLead,
  loadCrmTasksForLead,
} from "./server";
import type { FiCrmActivityEventRow, FiCrmLeadRow, FiCrmMessageRow, FiCrmNoteRow, FiCrmPipelineStageRow, FiCrmTaskRow } from "./types";
import { DEFAULT_CRM_PIPELINE_KEY } from "./types";

export async function loadCrmShellPipelineStages(tenantId: string): Promise<FiCrmPipelineStageRow[]> {
  const scope = {
    tenantId,
    organisationId: null as string | null,
    clinicId: null as string | null,
    pipelineKey: DEFAULT_CRM_PIPELINE_KEY,
  };
  const { stages } = await ensureDefaultPipelineStages(scope);
  return stages;
}

export type CrmLeadShellBundle = {
  lead: FiCrmLeadRow | null;
  events: FiCrmActivityEventRow[];
  tasks: FiCrmTaskRow[];
  notes: FiCrmNoteRow[];
  messages: FiCrmMessageRow[];
};

export async function loadCrmShellLeadBundle(tenantId: string, leadId: string): Promise<CrmLeadShellBundle> {
  const lid = leadId.trim();
  const lead = await loadCrmLeadById(lid, tenantId);
  if (!lead) {
    return { lead: null, events: [], tasks: [], notes: [], messages: [] };
  }
  const [events, tasks, notes, messages] = await Promise.all([
    loadCrmActivityTimelineForLead(tenantId, lid, { limit: 80 }),
    loadCrmTasksForLead(tenantId, lid, { limit: 40 }),
    loadCrmNotesForLead(tenantId, lid, { limit: 40 }),
    loadCrmMessagesForLead(tenantId, lid, { limit: 40 }),
  ]);
  return { lead, events, tasks, notes, messages };
}
