import type {
  PathologyExtractionProviderAuditOutcome,
  PathologyExtractionProviderAuditRecord,
  PathologyExtractionProviderId,
} from "./pathologyExtractionProviderTypes";

export type BuildPathologyExtractionProviderAuditInput = {
  providerId: PathologyExtractionProviderId;
  requestedProviderId: PathologyExtractionProviderId;
  outcome: PathologyExtractionProviderAuditOutcome;
  fallbackReason?: string | null;
  latencyMs: number;
  credentialPresent: boolean;
  externalRequestId?: string | null;
  invokedAt?: string;
};

export function buildPathologyExtractionProviderAudit(
  input: BuildPathologyExtractionProviderAuditInput
): PathologyExtractionProviderAuditRecord {
  return {
    provider_id: input.providerId,
    requested_provider_id: input.requestedProviderId,
    outcome: input.outcome,
    fallback_reason: input.fallbackReason?.trim() ? input.fallbackReason.trim() : null,
    latency_ms: Math.max(0, Math.round(input.latencyMs)),
    credential_present: input.credentialPresent,
    external_request_id: input.externalRequestId?.trim() ? input.externalRequestId.trim() : null,
    invoked_at: input.invokedAt ?? new Date().toISOString(),
  };
}

export function providerAuditToEventDetail(
  audit: PathologyExtractionProviderAuditRecord
): Record<string, unknown> {
  return {
    provider_id: audit.provider_id,
    requested_provider_id: audit.requested_provider_id,
    outcome: audit.outcome,
    fallback_reason: audit.fallback_reason,
    latency_ms: audit.latency_ms,
    credential_present: audit.credential_present,
    external_request_id: audit.external_request_id,
    invoked_at: audit.invoked_at,
  };
}
