/**
 * ReceptionOS Phase 6 — deployed-host smoke checks (read-only / dry-run safe).
 *
 * Required: FI_BASE_URL, FI_SMOKE_TENANT_ID
 * Optional: FI_ADMIN_API_KEY (enables authenticated API payload validation)
 *
 * Never prints secret values.
 */
import { normalizeFiDeploymentBaseUrl } from "../src/lib/env/fiDeploymentBaseUrl";
import { parseReceptionOsCommandCentrePayload } from "../src/lib/receptionOs/receptionOsBoardPayloadSchema";

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
  console.log(`ReceptionOS smoke test → ${b} (tenant ${tid})`);
  console.log("---");

  // A — reception-os page without session must not render dashboard HTML
  {
    const { status } = await fetchStatus(`/fi-admin/${tid}/reception-os`);
    if (status === 200) {
      fail("A reception-os page without session", "unexpected 200 (should redirect or deny unauthenticated access)");
    }
    if (![302, 303, 307, 401, 403].includes(status)) {
      fail("A reception-os page without session", `expected redirect or 401/403, got ${status}`);
    }
    pass("A reception-os page without session", `status ${status}`);
  }

  // B — legacy reception board without session
  {
    const { status } = await fetchStatus(`/fi-admin/${tid}/reception`);
    if (status === 200) {
      fail("B legacy reception board without session", "unexpected 200");
    }
    if (![302, 303, 307, 401, 403].includes(status)) {
      fail("B legacy reception board without session", `expected redirect or 401/403, got ${status}`);
    }
    pass("B legacy reception board without session", `status ${status}`);
  }

  // C — reception-os API without auth
  {
    const { status } = await fetchStatus(`/api/tenants/${tid}/reception-os`);
    if (status === 200) {
      fail("C reception-os API without auth", "unexpected 200");
    }
    if (![401, 403].includes(status)) {
      fail("C reception-os API without auth", `expected 401 or 403, got ${status}`);
    }
    pass("C reception-os API without auth", `status ${status}`);
  }

  const headers = adminHeaders();
  if (!headers) {
    skip("D reception-os API payload validates", "FI_ADMIN_API_KEY not set in runner env");
    skip("E closeout + system status in payload", "FI_ADMIN_API_KEY not set");
    skip("F pilot dry-run defaults in payload", "FI_ADMIN_API_KEY not set");
  } else {
    // D — authenticated API payload validates
    {
      const { status, text } = await fetchStatus(`/api/tenants/${tid}/reception-os`, { headers });
      if (status !== 200) fail("D reception-os API payload validates", `expected 200, got ${status}`);
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        fail("D reception-os API payload validates", "response is not JSON");
      }
      const envelope = json as { data?: unknown };
      if (!envelope.data) fail("D reception-os API payload validates", "missing data envelope");
      try {
        parseReceptionOsCommandCentrePayload(envelope.data);
      } catch (e) {
        fail("D reception-os API payload validates", e instanceof Error ? e.message : "schema parse failed");
      }
      pass("D reception-os API payload validates", "command centre schema OK");
    }

    // E — closeout + system status present
    {
      const { status, text } = await fetchStatus(`/api/tenants/${tid}/reception-os`, { headers });
      if (status !== 200) fail("E closeout + system status in payload", `expected 200, got ${status}`);
      const envelope = JSON.parse(text) as { data: Record<string, unknown> };
      if (!envelope.data?.endOfDayCloseout) {
        fail("E closeout + system status in payload", "missing endOfDayCloseout");
      }
      if (!envelope.data?.systemStatus) {
        fail("E closeout + system status in payload", "missing systemStatus");
      }
      pass("E closeout + system status in payload", "Phase 5/6 fields present");
    }

    // F — default pilot/dry-run posture (safe for Evolved)
    {
      const { status, text } = await fetchStatus(`/api/tenants/${tid}/reception-os`, { headers });
      if (status !== 200) fail("F pilot dry-run defaults in payload", `expected 200, got ${status}`);
      const payload = parseReceptionOsCommandCentrePayload(
        (JSON.parse(text) as { data: unknown }).data,
      );
      if (!payload.systemStatus.dryRunEnabled && !payload.systemStatus.pilotModeActive) {
        skip(
          "F pilot dry-run defaults in payload",
          "live communication appears enabled on target host — confirm intentional before clinic pilot",
        );
      } else {
        pass("F pilot dry-run defaults in payload", "dry-run or pilot mode active");
      }
      if (payload.systemStatus.pilotBanner) {
        pass("F pilot banner model", payload.systemStatus.pilotBanner.title.slice(0, 48));
      }
    }
  }

  console.log("---");
  console.log("ReceptionOS smoke test completed (no mutations performed).");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Smoke test failed.");
  process.exit(1);
});
