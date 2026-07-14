/**
 * FI-UX-REBUILD-1 S4.4 — Pipeline server loaders (batch enrichment + session wiring).
 */

import "server-only";

import { isFiOsPlatformAdminFullSessionBypass } from "@/src/lib/crm/crmGate";
import {
  getBookingsOperatorSessionIfAllowed,
  getCrmShellPageSession,
} from "@/src/lib/crm/crmShellAccess";
import {
  loadCrmShellLeadsBoardIndex,
  loadCrmShellPipelineStages,
} from "@/src/lib/crm/crmShellLoaders";
import {
  loadConsultationBookingsByLeadIds,
  loadCrmCommunicationHintsByLeadIds,
  loadCrmTasksByLeadIds,
  loadReminderJobsByLeadIds,
} from "@/src/lib/crm/pipelineLoaderBatch.server";
import type { PipelinePresentation } from "@/src/lib/crm/pipelinePresentation.types";
import {
  loadPipelineDualRunHarnessData as loadHarnessOrchestration,
  loadPipelineFullPayload as loadFullOrchestration,
  loadPipelineShellPayload as loadShellOrchestration,
  refreshPipelinePresentation as refreshOrchestration,
  type PipelineLoaderDeps,
  type PipelineLoaderTiming,
} from "@/src/lib/crm/pipelineLoaderOrchestration";

export type {
  PipelineFullLoadResult,
  PipelineLoaderDeps,
  PipelineLoaderTiming,
  PipelineSessionContext,
} from "@/src/lib/crm/pipelineLoaderOrchestration";

export {
  loadConsultationBookingsByLeadIds,
  loadCrmCommunicationHintsByLeadIds,
  loadCrmTasksByLeadIds,
  loadReminderJobsByLeadIds,
} from "@/src/lib/crm/pipelineLoaderBatch.server";

function logPipelineLoaderTiming(label: string, timing: Partial<PipelineLoaderTiming>): void {
  if (process.env.NODE_ENV === "production" && !process.env.PIPELINE_LOADER_TIMING) return;
  console.info(`[pipeline-loader] ${label}`, JSON.stringify(timing));
}

async function resolvePipelineSessionContext(tenantId: string) {
  const session = await getCrmShellPageSession(tenantId);
  const bookingsSession = await getBookingsOperatorSessionIfAllowed(tenantId);
  // getCrmShellPageSession already required a tenant proxy for platform-admin bypass;
  // fiUserId present + full-session bypass ⇒ valid tenant-scoped proxy.
  const platformAdminBypass = await isFiOsPlatformAdminFullSessionBypass(session.authUserId);
  const validPlatformAdminTenantProxy = platformAdminBypass && Boolean(session.fiUserId?.trim());

  if (process.env.PIPELINE_PERMISSION_DIAG === "1") {
    console.info(
      "[pipeline-permission-session]",
      JSON.stringify({
        tenantId: tenantId.trim(),
        sessionKind: platformAdminBypass ? "platform_admin_full_session" : "tenant_operator",
        isPlatformAdmin: platformAdminBypass,
        hasTenantProxy: Boolean(session.fiUserId?.trim()),
        proxyTenantMatches: validPlatformAdminTenantProxy,
        resolvedRole: session.role,
        canUseClinicFeatures: session.canUseClinicFeatures,
      })
    );
  }

  return {
    session: {
      authUserId: session.authUserId,
      fiUserId: session.fiUserId,
      role: session.role,
      canUseClinicFeatures: session.canUseClinicFeatures,
    },
    bookingsOperator: bookingsSession !== null,
    validPlatformAdminTenantProxy,
  };
}

function defaultPipelineLoaderDeps(overrides: PipelineLoaderDeps = {}): PipelineLoaderDeps {
  return {
    getSessionContext: resolvePipelineSessionContext,
    loadBoardIndex: loadCrmShellLeadsBoardIndex,
    loadStages: loadCrmShellPipelineStages,
    loadTasksByLeadIds: loadCrmTasksByLeadIds,
    loadCommunicationHintsByLeadIds: loadCrmCommunicationHintsByLeadIds,
    loadConsultationBookingsByLeadIds: loadConsultationBookingsByLeadIds,
    loadReminderJobsByLeadIds: loadReminderJobsByLeadIds,
    onTiming: logPipelineLoaderTiming,
    ...overrides,
  };
}

export async function loadPipelineShellPayload(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  deps: PipelineLoaderDeps = {}
) {
  return loadShellOrchestration(tenantId, searchParams, defaultPipelineLoaderDeps(deps));
}

export async function loadPipelineFullPayload(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  deps: PipelineLoaderDeps = {}
) {
  return loadFullOrchestration(tenantId, searchParams, defaultPipelineLoaderDeps(deps));
}

export async function refreshPipelinePresentation(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  deps: PipelineLoaderDeps = {}
): Promise<PipelinePresentation> {
  return refreshOrchestration(tenantId, searchParams, defaultPipelineLoaderDeps(deps));
}

export async function loadPipelineDualRunHarnessData(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>,
  deps: PipelineLoaderDeps = {}
) {
  return loadHarnessOrchestration(tenantId, searchParams, defaultPipelineLoaderDeps(deps));
}
