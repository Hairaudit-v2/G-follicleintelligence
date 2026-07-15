import type { Page, Request } from "@playwright/test";

/**
 * Production HubSpot smoke — mutation / PHI safety.
 *
 * Fails if HubSpot-workspace-related requests use POST/PUT/PATCH/DELETE outside
 * documented authentication/session allowlists and Next.js read-only loaders.
 * Also blocks clicks on known mutating control labels.
 */

export const FORBIDDEN_MUTATION_LABELS = [
  "Sync now",
  "Back up secondary objects",
  "Approve",
  "Reject",
  "Import",
  "Promote",
  "Reconnect",
  "Revoke",
  "Verify credentials",
] as const;

const FORBIDDEN_CLICK_RE =
  /^(Sync now|Back up secondary objects|Approve|Reject|Import Now|Import first\b.*|Promote|Reconnect|Revoke|Verify credentials)$/i;

/** Documented auth/session POSTs that may occur during login or token refresh. */
const AUTH_SESSION_URL_RE =
  /\/auth\/v1\/|supabase\.(co|in)\/auth\/|\/follicle-intelligence\/login|\/auth\/callback|\/api\/auth\b/i;

/** HubSpot workspace HTML + API surfaces under test. */
const HUBSPOT_WORKSPACE_URL_RE =
  /\/settings\/integrations\/hubspot|\/settings\/imports\/hubspot|\/onboarding-os\/import-review|\/api\/tenants\/[^/]+\/integrations\/hubspot/i;

/** Explicit HubSpot mutation API / action fingerprints (never allowed). */
const HUBSPOT_MUTATION_FINGERPRINT_RE =
  /runHubspotSync|runHubspotSecondary|approveHubspot|rejectHubspot|cancelHubspotImport|commitHubspot|verifyHubspotSecondary|Verify credentials|Import Now|Import first/i;

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type MutationViolation = {
  method: string;
  url: string;
  reason: string;
};

export function isAuthSessionRequest(url: string): boolean {
  return AUTH_SESSION_URL_RE.test(url);
}

export function isHubspotWorkspaceRequest(url: string): boolean {
  return HUBSPOT_WORKSPACE_URL_RE.test(url);
}

/**
 * Next.js App Router may POST server-action / RSC payloads to the current page.
 * Allow those only when the body does not fingerprint a HubSpot mutation action.
 */
function isAllowedHubspotDocumentPost(request: Request): boolean {
  const url = request.url();
  if (!isHubspotWorkspaceRequest(url)) return false;
  if (!/^https?:/i.test(url)) return false;

  const headers = request.headers();
  const isNextFlight =
    Boolean(headers["next-action"]) ||
    Boolean(headers["rsc"]) ||
    String(headers["accept"] ?? "").includes("text/x-component") ||
    String(headers["content-type"] ?? "").includes("multipart/form-data") ||
    String(headers["content-type"] ?? "").includes("text/plain");

  if (!isNextFlight && !headers["next-action"]) {
    // Page soft-nav / same-document POSTs without Next markers are still
    // rejected for HubSpot paths (fail closed).
    return false;
  }

  const postData = request.postData() ?? "";
  if (HUBSPOT_MUTATION_FINGERPRINT_RE.test(postData)) return false;
  if (HUBSPOT_MUTATION_FINGERPRINT_RE.test(url)) return false;
  return true;
}

export function classifyHubspotMutatingRequest(request: Request): MutationViolation | null {
  const method = request.method().toUpperCase();
  if (!MUTATING_METHODS.has(method)) return null;

  const url = request.url();
  if (isAuthSessionRequest(url)) return null;

  if (/\/api\/tenants\/[^/]+\/integrations\/hubspot/i.test(url)) {
    return {
      method,
      url: redactUrl(url),
      reason: "Mutating method against HubSpot integration API route",
    };
  }

  if (isHubspotWorkspaceRequest(url)) {
    if (method === "POST" && isAllowedHubspotDocumentPost(request)) return null;
    return {
      method,
      url: redactUrl(url),
      reason: "Mutating method against HubSpot workspace surface (not auth/session)",
    };
  }

  const postData = request.postData() ?? "";
  if (HUBSPOT_MUTATION_FINGERPRINT_RE.test(postData) || HUBSPOT_MUTATION_FINGERPRINT_RE.test(url)) {
    return {
      method,
      url: redactUrl(url),
      reason: "Request fingerprinted as HubSpot mutation action",
    };
  }

  return null;
}

/** Strip query values that could contain PII; keep path + host only. */
function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

export type HubspotMutationGuardHandle = {
  violations: MutationViolation[];
  assertClean: () => void;
  dispose: () => void;
};

/**
 * Install click + network mutation guards on a page for the duration of a test.
 */
export async function installHubspotMutationGuard(page: Page): Promise<HubspotMutationGuardHandle> {
  const violations: MutationViolation[] = [];

  const onRequest = (request: Request) => {
    const violation = classifyHubspotMutatingRequest(request);
    if (violation) violations.push(violation);
  };

  page.on("request", onRequest);

  await page.addInitScript(
    ({ patternSource }) => {
      const re = new RegExp(patternSource, "i");
      document.addEventListener(
        "click",
        (event) => {
          const target = event.target as Element | null;
          const control = target?.closest?.("button, a, [role='button'], input[type='submit']");
          if (!control) return;
          const label = (control.textContent || (control as HTMLInputElement).value || "").trim();
          if (!label || !re.test(label)) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          throw new Error(`FI HubSpot production smoke blocked mutating click: ${label.slice(0, 80)}`);
        },
        true,
      );
    },
    { patternSource: FORBIDDEN_CLICK_RE.source },
  );

  return {
    violations,
    assertClean: () => {
      if (violations.length === 0) return;
      const sample = violations
        .slice(0, 5)
        .map((v) => `${v.method} ${v.url} (${v.reason})`)
        .join("; ");
      throw new Error(
        `HubSpot production smoke mutation guard failed (${violations.length} violation(s)): ${sample}`,
      );
    },
    dispose: () => {
      page.off("request", onRequest);
    },
  };
}
