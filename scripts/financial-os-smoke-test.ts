/**
 * FinancialOS Phase 1B — deployed-host smoke checks (read-only / dry-run safe).
 *
 * Required: FI_BASE_URL, FI_SMOKE_TENANT_ID
 * Optional: FI_ADMIN_API_KEY (enables authenticated API payload validation)
 */
import { normalizeFiDeploymentBaseUrl } from "../src/lib/env/fiDeploymentBaseUrl";
import {
  assertFinancialOsSmokeInvariants,
  parseFinancialOsCommandCentrePayload,
} from "../src/lib/financialOs/financialOsCommandCentrePayloadSchema";

function baseUrl(): string {
  const raw = process.env.FI_BASE_URL?.trim();
  if (!raw) {
    console.error("Missing FI_BASE_URL");
    process.exit(1);
  }
  return normalizeFiDeploymentBaseUrl(raw);
}

function tenantId(): string {
  const t = process.env.FI_SMOKE_TENANT_ID?.trim();
  if (!t) {
    console.error("Missing FI_SMOKE_TENANT_ID");
    process.exit(1);
  }
  return t;
}

function skip(check: string, reason: string): void {
  console.log(`SKIPPED [${check}]: ${reason}`);
}

function pass(check: string, detail?: string): void {
  console.log(`PASS [${check}]${detail ? `: ${detail}` : ""}`);
}

function fail(check: string, detail: string): never {
  console.error(`FAIL [${check}]: ${detail}`);
  process.exit(1);
}

async function fetchStatus(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; contentType: string; text: string }> {
  const url = `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { ...init, redirect: "manual" });
  return {
    status: res.status,
    contentType: res.headers.get("content-type") ?? "",
    text: await res.text(),
  };
}

function adminHeaders(): Record<string, string> | null {
  const key = process.env.FI_ADMIN_API_KEY?.trim();
  if (!key) return null;
  return { "x-fi-admin-key": key };
}

async function main(): Promise<void> {
  const tid = tenantId();
  const b = baseUrl();
  console.log(`FinancialOS smoke test → ${b} (tenant ${tid})`);
  console.log("---");

  {
    const { status } = await fetchStatus(`/fi-admin/${tid}/financial-os`);
    if (status === 200) {
      fail("A financial-os page without session", "unexpected 200 (should redirect or deny unauthenticated access)");
    }
    if (![302, 303, 307, 401, 403].includes(status)) {
      fail("A financial-os page without session", `expected redirect or 401/403, got ${status}`);
    }
    pass("A financial-os page without session", `status ${status}`);
  }

  {
    const { status } = await fetchStatus(`/api/tenants/${tid}/financial-os`);
    if (status === 200) fail("B financial-os API without auth", "unexpected 200");
    if (![401, 403].includes(status)) {
      fail("B financial-os API without auth", `expected 401 or 403, got ${status}`);
    }
    pass("B financial-os API without auth", `status ${status}`);
  }

  const headers = adminHeaders();
  if (!headers) {
    skip("C financial-os API payload validates", "FI_ADMIN_API_KEY not set");
    skip("D ledger + invoice metric invariants", "FI_ADMIN_API_KEY not set");
    skip("E deposit filter + tenant isolation", "FI_ADMIN_API_KEY not set");
  } else {
    {
      const { status, text } = await fetchStatus(`/api/tenants/${tid}/financial-os`, { headers });
      if (status !== 200) fail("C financial-os API payload validates", `expected 200, got ${status}`);
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        fail("C financial-os API payload validates", "response is not JSON");
      }
      const envelope = json as { data?: unknown };
      if (!envelope.data) fail("C financial-os API payload validates", "missing data envelope");
      try {
        parseFinancialOsCommandCentrePayload(envelope.data);
      } catch (e) {
        fail("C financial-os API payload validates", e instanceof Error ? e.message : "schema parse failed");
      }
      pass("C financial-os API payload validates", "command centre schema OK");
    }

    {
      const { status, text } = await fetchStatus(`/api/tenants/${tid}/financial-os`, { headers });
      if (status !== 200) fail("D ledger + invoice metric invariants", `expected 200, got ${status}`);
      const payload = parseFinancialOsCommandCentrePayload((JSON.parse(text) as { data: unknown }).data);
      if (!payload.revenueTodayFromLedger) {
        fail("D ledger + invoice metric invariants", "revenueTodayFromLedger must be true");
      }
      if (!payload.outstandingInvoices.usesRemainingBalanceColumn) {
        fail("D ledger + invoice metric invariants", "outstanding must use remaining_balance_cents");
      }
      pass("D ledger + invoice metric invariants", `revenueToday=${payload.revenueTodayCents} outstanding=${payload.outstandingInvoices.totalCents}`);
    }

    {
      const { status, text } = await fetchStatus(`/api/tenants/${tid}/financial-os`, { headers });
      if (status !== 200) fail("E deposit filter + tenant isolation", `expected 200, got ${status}`);
      const payload = parseFinancialOsCommandCentrePayload((JSON.parse(text) as { data: unknown }).data);
      try {
        assertFinancialOsSmokeInvariants(payload);
      } catch (e) {
        fail("E deposit filter + tenant isolation", e instanceof Error ? e.message : "invariant failed");
      }
      if (payload.depositsAwaitingPayment.count !== payload.depositsAwaitingPayment.depositInvoiceCount) {
        fail("E deposit filter + tenant isolation", "deposit count mismatch");
      }
      pass("E deposit filter + tenant isolation", `deposits=${payload.depositsAwaitingPayment.count} alerts.review=${payload.alerts.needsReviewCount}`);
    }
  }

  console.log("---");
  console.log("FinancialOS smoke test complete.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
