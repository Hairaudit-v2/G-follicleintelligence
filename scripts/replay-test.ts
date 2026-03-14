/**
 * Idempotency + replay test.
 * Run: npx tsx scripts/replay-test.ts
 * Requires: dev server (npm run dev) and FI_BASE_URL or defaults to http://localhost:3000
 * Requires: FI_TENANT_ID env or first tenant from API
 *
 * Flow: create case → upload → submit → run model → re-run model → approve
 * Asserts: no duplicate reports, re-run returns same report, job locking.
 */
export {};

const BASE = process.env.FI_BASE_URL || "http://localhost:3000";

function api(path: string, opts: RequestInit = {}) {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
  }).then((r) => r.json());
}

async function getTenant(): Promise<string> {
  const tenantId = process.env.FI_TENANT_ID;
  if (tenantId) return tenantId;
  const d = await api("/api/tenants");
  if (!d.ok || !d.tenants?.length)
    throw new Error("No tenants. Set FI_TENANT_ID or create a tenant.");
  return d.tenants[0].id;
}

// Minimal valid files for requirements (1 blood + 1 scalp)
const MINIMAL_CSV = new Blob(["name,value\nTest,1"], { type: "text/csv" });
const MINIMAL_PDF = new Blob(
  ["%PDF-1.4\n1 0 obj\n<<>>\nendobj\nxref\n0 1\ntrailer\n<<>>\nstartxref\n%%EOF"],
  { type: "application/pdf" }
);
// 1x1 PNG (base64)
const MINIMAL_PNG = new Blob(
  [Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")],
  { type: "image/png" }
);

async function upload(
  tenantId: string,
  caseId: string,
  type: string,
  blob: Blob,
  filename: string
): Promise<void> {
  const fd = new FormData();
  fd.set("tenant_id", tenantId);
  fd.set("case_id", caseId);
  fd.set("type", type);
  fd.append("files", blob, filename);
  const r = await fetch(`${BASE}/api/fi/uploads`, { method: "POST", body: fd });
  const d = await r.json();
  if (!d.ok) throw new Error(`Upload failed: ${d.error}`);
}

async function main() {
  console.log("Replay test: idempotency + job locking");
  console.log("Base URL:", BASE);

  const tenantId = await getTenant();
  console.log("Tenant:", tenantId);

  // 1. Create case
  const createRes = await api("/api/tenants/" + tenantId + "/cases", {
    method: "POST",
    body: JSON.stringify({
      full_name: "Replay Test Patient",
      email: "replay@test.local",
      dob: "1990-01-01",
      sex: "male",
    }),
  });
  if (!createRes.ok) throw new Error("Create case: " + createRes.error);
  const caseId = createRes.case.id;
  console.log("Case created:", caseId);

  // 2. Upload required inputs (1 blood + 1 scalp)
  await upload(tenantId, caseId, "blood_csv", MINIMAL_CSV, "test.csv");
  await upload(tenantId, caseId, "scalp_preop_front", MINIMAL_PNG, "test.png");
  console.log("Uploads done");

  // 3. Submit
  const submitRes = await api("/api/fi/submit", {
    method: "POST",
    body: JSON.stringify({ tenant_id: tenantId, case_id: caseId }),
  });
  if (!submitRes.ok) throw new Error("Submit: " + submitRes.error);
  console.log("Submitted");

  // 4. Run model
  const run1 = await api(`/api/tenants/${tenantId}/cases/${caseId}/run-model`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!run1.ok) throw new Error("Run model: " + run1.error);
  const jobId1 = run1.jobId;
  const reportId1 = run1.reportId;
  console.log("Run 1: job", jobId1, "report", reportId1);

  // 5. Re-run model (idempotent: should return same report)
  const run2 = await api(`/api/tenants/${tenantId}/cases/${caseId}/run-model`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!run2.ok) throw new Error("Re-run: " + run2.error);
  const jobId2 = run2.jobId;
  const reportId2 = run2.reportId;
  console.log("Run 2: job", jobId2, "report", reportId2);

  // Assert: re-run returns same job and report (idempotent)
  if (jobId1 !== jobId2 || reportId1 !== reportId2) {
    throw new Error(
      `Re-run not idempotent: job ${jobId1} vs ${jobId2}, report ${reportId1} vs ${reportId2}`
    );
  }
  console.log("OK: Re-run idempotent (same job + report)");

  // 6. Approve report
  const approveRes = await api("/api/fi/audit/approve", {
    method: "POST",
    body: JSON.stringify({ tenant_id: tenantId, report_id: reportId1 }),
  });
  if (!approveRes.ok) throw new Error("Approve: " + approveRes.error);
  console.log("Report approved");

  // 7. Fetch report and check consistency
  const reportRes = await api(
    `/api/fi/report?tenant_id=${tenantId}&case_id=${caseId}&report_id=${reportId1}`
  );
  if (!reportRes.ok || !reportRes.report)
    throw new Error("Fetch report: " + (reportRes.error ?? "no data"));
  if (reportRes.report.status !== "released")
    throw new Error("Report status should be released: " + reportRes.report.status);
  const reportJson = reportRes.report.report_json;
  if (!reportJson || typeof reportJson !== "object")
    throw new Error("Report has no report_json");
  const meta = (reportJson as { metadata?: { case_id?: string } }).metadata;
  if (!meta?.case_id || meta.case_id !== caseId)
    throw new Error("Report metadata case_id mismatch");
  console.log("OK: Report consistent, status=released, metadata correct");

  // 8. Re-run after approve (still idempotent)
  const run3 = await api(`/api/tenants/${tenantId}/cases/${caseId}/run-model`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!run3.ok) throw new Error("Run 3: " + run3.error);
  if (run3.reportId !== reportId1)
    throw new Error("Run 3 should return same report: " + run3.reportId);
  console.log("OK: Post-approve re-run still idempotent");

  console.log("\nAll assertions passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
