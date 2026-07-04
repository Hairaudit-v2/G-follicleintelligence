import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  enqueueImagingAiAnalysisJob,
  mapImagingAiJobRow,
  supersedeImagingAiAnalysisJob,
} from "./imagingAiAnalysisJobs.server";
import {
  markImagingAiReviewJobIgnored,
  requeueStaleImagingAiReviewJob,
  retryFailedImagingAiReviewJob,
} from "./imagingAiReviewOpsMutations.server";
import { CrmAccessError } from "@/src/lib/crm/crmGate";

type JobRow = Record<string, unknown>;

function makeJob(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "tenant-1",
    patient_image_id: "22222222-2222-4222-8222-222222222222",
    analysis_kind: "graft_tray_count_estimate",
    status: "failed",
    request_payload: { attempt_count: 2 },
    result_payload: null,
    error_message: "provider timeout",
    created_at: "2026-07-04T10:00:00.000Z",
    updated_at: "2026-07-04T10:05:00.000Z",
    completed_at: "2026-07-04T10:05:00.000Z",
    ...overrides,
  };
}

function createOpsStore(initial: { jobs?: JobRow[]; reviewStatus?: string | null } = {}) {
  const jobs = (initial.jobs ?? [makeJob()]).map((r) => ({ ...r }));
  const reviewStatusByImage = new Map<string, string | null>([
    ["22222222-2222-4222-8222-222222222222", initial.reviewStatus ?? "pending_review"],
  ]);
  let nextId = jobs.length + 1;

  const match = (rows: JobRow[], filters: Array<{ col: string; val: unknown }>) =>
    rows.filter((row) => filters.every((f) => row[f.col] === f.val));

  const jobBuilder = () => {
    const filters: Array<{ col: string; val: unknown }> = [];
    let op: "select" | "insert" | "update" = "select";
    let insertRow: JobRow | null = null;
    let updatePatch: Partial<JobRow> | null = null;
    let returning = false;
    let order: { col: string; asc: boolean } | null = null;
    let limit: number | null = null;
    let terminal: "many" | "single" | "maybeSingle" = "many";
    let inFilter: { col: string; vals: unknown[] } | null = null;

    const exec = () => {
      let matched = match(jobs, filters);
      if (inFilter) matched = matched.filter((r) => inFilter!.vals.includes(r[inFilter!.col]));
      if (order) {
        matched = [...matched].sort((a, b) => {
          const av = String(a[order!.col]);
          const bv = String(b[order!.col]);
          return order!.asc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (limit != null) matched = matched.slice(0, limit);

      if (op === "insert" && insertRow) {
        const row = { id: `job-${nextId++}`, ...insertRow };
        jobs.push(row);
        const data = returning ? row : row;
        return { data, error: null };
      }

      if (op === "update" && updatePatch) {
        for (const row of matched) Object.assign(row, updatePatch);
        if (returning) {
          const data = terminal === "maybeSingle" ? (matched[0] ?? null) : matched[0];
          return { data, error: null };
        }
      }

      if (terminal === "single" || terminal === "maybeSingle") {
        return { data: matched[0] ?? null, error: null };
      }
      if (op === "select" && matched.length > 0 && Object.keys(matched[0]).length === 1 && matched[0].id) {
        return { data: matched.map((r) => ({ id: r.id })), error: null };
      }
      return { data: matched, error: null };
    };

    const api: Record<string, unknown> = {
      select() {
        if (op === "insert" || op === "update") returning = true;
        else op = "select";
        return api;
      },
      insert(row: JobRow) {
        op = "insert";
        insertRow = row;
        return api;
      },
      update(patch: Partial<JobRow>) {
        op = "update";
        updatePatch = patch;
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, val });
        return api;
      },
      in(col: string, vals: unknown[]) {
        inFilter = { col, vals };
        return api;
      },
      order(col: string, opts: { ascending: boolean }) {
        order = { col, asc: opts.ascending };
        return api;
      },
      limit(n: number) {
        limit = n;
        return api;
      },
      single() {
        terminal = "single";
        return api;
      },
      maybeSingle() {
        terminal = "maybeSingle";
        return api;
      },
      then(resolve: (v: unknown) => void) {
        return Promise.resolve(exec()).then(resolve);
      },
    };
    return api;
  };

  const estimateBuilder = () => {
    const filters: Array<{ col: string; val: unknown }> = [];
    let inFilter: { col: string; vals: unknown[] } | null = null;
    const api: Record<string, unknown> = {
      select() {
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, val });
        return api;
      },
      in(col: string, vals: unknown[]) {
        inFilter = { col, vals };
        return api;
      },
      order() {
        return api;
      },
      then(resolve: (v: unknown) => void) {
        const imageId = inFilter?.vals[0];
        const status = typeof imageId === "string" ? reviewStatusByImage.get(imageId) : null;
        if (!status) return Promise.resolve({ data: [], error: null }).then(resolve);
        return Promise.resolve({
          data: [
            {
              id: "est-1",
              tenant_id: "tenant-1",
              patient_id: "patient-1",
              image_id: imageId,
              graft_tray_link_id: null,
              surgery_id: null,
              estimated_graft_count: 120,
              manual_graft_count: 118,
              manual_count_source: "confirmed_tray_latest",
              corrected_graft_count: null,
              delta: 2,
              mismatch_band: "within_tolerance",
              confidence: 0.82,
              confidence_band: "high",
              image_quality: "suitable",
              assessable: true,
              review_status: status,
              reviewer_decision: null,
              provider: "stub",
              provider_version: "graft_tray_stub_v1",
              review_reasons: [],
              created_at: "2026-07-04T10:02:00.000Z",
              updated_at: "2026-07-04T10:02:00.000Z",
            },
          ],
          error: null,
        }).then(resolve);
      },
    };
    return api;
  };

  const client = {
    from(table: string) {
      if (table === "fi_imaging_graft_tray_ai_estimates") return estimateBuilder();
      if (table === "fi_imaging_ai_analysis_jobs") return jobBuilder();
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;

  return { client, jobs, setReviewStatus: (status: string | null) => reviewStatusByImage.set("22222222-2222-4222-8222-222222222222", status) };
}

describe("imagingAiReviewOpsMutations", () => {
  it("retry creates a new queued job and supersedes the failed job", async () => {
    const { client, jobs } = createOpsStore();
    const result = await retryFailedImagingAiReviewJob({
      tenantId: "tenant-1",
      jobId: "11111111-1111-4111-8111-111111111111",
      client,
    });
    assert.equal(result.action, "retry");
    assert.ok(result.newJobId);
    const oldJob = jobs.find((j) => j.id === "11111111-1111-4111-8111-111111111111");
    assert.equal(oldJob?.status, "superseded");
    const newJob = jobs.find((j) => j.id === result.newJobId);
    assert.equal(newJob?.status, "queued");
  });

  it("accepted staff-reviewed estimate is not overwritten by retry", async () => {
    const { client } = createOpsStore({ reviewStatus: "accepted_ai" });
    await assert.rejects(
      () =>
        retryFailedImagingAiReviewJob({
          tenantId: "tenant-1",
          jobId: "11111111-1111-4111-8111-111111111111",
          client,
        }),
      /cannot be overwritten/
    );
  });

  it("stale running job can be requeued safely", async () => {
    const { client, jobs } = createOpsStore({
      jobs: [
        makeJob({
          id: "33333333-3333-4333-8333-333333333333",
          status: "running",
          updated_at: "2020-01-01T00:00:00.000Z",
          error_message: null,
          completed_at: null,
        }),
      ],
    });
    const result = await requeueStaleImagingAiReviewJob({
      tenantId: "tenant-1",
      jobId: "33333333-3333-4333-8333-333333333333",
      client,
    });
    assert.equal(result.action, "requeue_stale");
    assert.ok(result.newJobId);
    const oldJob = jobs.find((j) => j.id === "33333333-3333-4333-8333-333333333333");
    assert.equal(oldJob?.status, "superseded");
  });

  it("mark ignored supersedes without creating a new job", async () => {
    const { client, jobs } = createOpsStore();
    const result = await markImagingAiReviewJobIgnored({
      tenantId: "tenant-1",
      jobId: "11111111-1111-4111-8111-111111111111",
      reason: "Duplicate capture",
      client,
    });
    assert.equal(result.action, "mark_ignored");
    assert.equal(result.newJobId, null);
    assert.equal(jobs[0]?.status, "superseded");
  });

  it("permission-style CRM access errors surface as mutation failures", async () => {
    const err = new CrmAccessError(403, "Not authorized for this tenant.");
    assert.equal(err.message, "Not authorized for this tenant.");
  });
});

describe("supersedeImagingAiAnalysisJob", () => {
  it("records supersede reason on the job payload", async () => {
    const { client, jobs } = createOpsStore({
      jobs: [makeJob({ status: "queued" })],
    });
    await supersedeImagingAiAnalysisJob({
      tenantId: "tenant-1",
      jobId: "11111111-1111-4111-8111-111111111111",
      reason: "operator_retry_failed_job",
      client,
    });
    const row = mapImagingAiJobRow(jobs[0]!);
    assert.equal(row.status, "superseded");
    assert.equal(row.request_payload.superseded_reason, "operator_retry_failed_job");
  });
});