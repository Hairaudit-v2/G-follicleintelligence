/** Shared pathology inbound email route validation (no server-only imports). */

export const PATHOLOGY_EMAIL_ROUTE_STATUSES = ["active", "disabled"] as const;
export type PathologyEmailRouteStatusValue = (typeof PATHOLOGY_EMAIL_ROUTE_STATUSES)[number];

export const PATHOLOGY_EMAIL_WEBHOOK_SECRET_HEADER = "X-Pathology-Email-Webhook-Secret";
export const PATHOLOGY_EMAIL_INBOUND_WEBHOOK_PATH = "/api/integrations/pathology-email/inbound";

export const EVOLVED_PATHOLOGY_EMAIL_TENANT_SLUG = "evolved-hair";
export const EVOLVED_PATHOLOGY_EMAIL_SOURCE_LABEL = "Evolved Pathology Inbox";
export const EVOLVED_PATHOLOGY_EMAIL_LOCAL_PART = "pathology+evolved";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePathologyInboundEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidPathologyInboundEmail(email: string): boolean {
  const normalized = normalizePathologyInboundEmail(email);
  return normalized.length > 0 && EMAIL_PATTERN.test(normalized);
}

export function buildPathologyInboundWebhookUrl(appOrigin: string): string {
  const base = appOrigin.replace(/\/+$/, "") || "http://localhost:3000";
  return `${base}${PATHOLOGY_EMAIL_INBOUND_WEBHOOK_PATH}`;
}

export function resolvePathologyEmailAppOrigin(): string {
  const fromPublic = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const fromVercel = process.env.VERCEL_URL?.trim()
    ? `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`
    : null;
  return fromPublic || fromVercel || "http://localhost:3000";
}

export function buildEvolvedPathologyInboundEmail(inboundDomain: string): string {
  const domain = inboundDomain.trim().toLowerCase().replace(/^@+/, "");
  if (!domain) {
    throw new Error("Inbound domain is required.");
  }
  return `${EVOLVED_PATHOLOGY_EMAIL_LOCAL_PART}@inbound.${domain}`;
}

export type PathologyEmailRoutesEnvSlice = Partial<
  Record<"PATHOLOGY_EMAIL_INBOUND_DOMAIN", string>
>;

export function readPathologyEmailInboundDomainFromEnv(
  env: PathologyEmailRoutesEnvSlice = process.env as PathologyEmailRoutesEnvSlice
): string {
  return env.PATHOLOGY_EMAIL_INBOUND_DOMAIN?.trim() ?? "";
}

export type PathologyEmailRouteMessageStat = {
  message_count: number;
  last_used_at: string | null;
  last_provider: string | null;
};

export function aggregatePathologyEmailRouteMessageStats(
  messages: Array<{
    to_email: string;
    received_at: string | null;
    created_at: string;
    provider: string;
  }>
): Map<string, PathologyEmailRouteMessageStat> {
  const stats = new Map<string, PathologyEmailRouteMessageStat>();

  for (const message of messages) {
    const key = normalizePathologyInboundEmail(message.to_email);
    const when = message.received_at ?? message.created_at;
    const existing = stats.get(key);
    if (!existing) {
      stats.set(key, {
        message_count: 1,
        last_used_at: when,
        last_provider: message.provider,
      });
      continue;
    }
    existing.message_count += 1;
    if (when && (!existing.last_used_at || when > existing.last_used_at)) {
      existing.last_used_at = when;
      existing.last_provider = message.provider;
    }
  }

  return stats;
}
