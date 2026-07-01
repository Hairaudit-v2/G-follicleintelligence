import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  claimNextImagingAiAnalysisJob,
  completeImagingAiAnalysisJob,
  enqueueImagingAiAnalysisJob,
  failImagingAiAnalysisJob,
  mapImagingAiJobRow,
} from "./imagingAiAnalysisJobs.server";

type JobRow = Record<string, unknown>;

function makeJob(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: "job-1",
    tenant_id: "tenant-1",
    patient_image_id: "img-1",
    analysis_kind: "clinical_image_analysis",
    status: "queued",
    request_payload: {},
    result_payload: null,
    error_message: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

function createJobStore(initial: JobRow[] = []) {
  const rows = initial.map((r) => ({ ...r }));
  let nextId = rows.length + 1;

  const match = (filters: Array<{ col: string; val: unknown }>) =>
    rows.filter((row) => filters.every((f) => row[f.col] === f.val));

  const builder = (table: string) => {
    assert.equal(table, "fi_imaging_ai_analysis_jobs");
    const filters: Array<{ col: string; val: unknown }> = [];
    let op: "select" | "insert" | "update" = "select";
    let insertRow: JobRow | null = null;
    let updatePatch: Partial<JobRow> | null = null;
    let returning = false;
    let order: { col: string; asc: boolean } | null = null;
    let limit: number | null = null;
    let terminal: "many" | "single" | "maybeSingle" = "many";

    const exec = () => {
      if (op === "insert" && insertRow) {
        const row = { id: `job-${nextId++}`, ...insertRow };
        rows.push(row);
        const data = returning
          ? terminal === "many"
            ? [row]
            : row
          : terminal === "many"
            ? [row]
            : row;
        return { data, error: null };
      }

      let matched = match(filters);
      if (order) {
        matched = [...matched].sort((a, b) => {
          const av = String(a[order!.col]);
          const bv = String(b[order!.col]);
          return order!.asc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (limit != null) matched = matched.slice(0, limit);

      if (op === "update" && updatePatch) {
        for (const row of matched) Object.assign(row, updatePatch);
        if (returning) {
          const data =
            terminal === "many" ? matched : terminal === "maybeSingle" ? (matched[0] ?? null) : matched[0];
          return { data, error: null };
        }
      }

      if (terminal === "single" || terminal === "maybeSingle") {
        return { data: matched[0] ?? null, error: null };
      }

      if (op === "select" && matched.length > 0) {
        const sample = matched[0];
        const keys = Object.keys(sample);
        if (keys.length === 1 && keys[0] === "id") {
          return { data: matched.map((r) => ({ id: r.id })), error: null };
        }
      }

      return { data: matched, error: null };
    };

    const api: Record<string, unknown> = {
      select() {
        if (op === "insert" || op === "update") {
          returning = true;
        } else {
          op = "select";
        }
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

  return {
    client: { from: builder } as unknown as import("@supabase/supabase-js").SupabaseClient,
    rows,
  };
}

describe("imagingAiAnalysisJobs", () => {
  it("maps job rows", () => {
    const row = mapImagingAiJobRow(makeJob());
    assert.equal(row.analysis_kind, "clinical_image_analysis");
    assert.equal(row.status, "queued");
  });

  it("enqueues a queued job", async () => {
    const { client } = createJobStore();
    const jobId = await enqueueImagingAiAnalysisJob({
      tenantId: "tenant-1",
      patientImageId: "img-1",
      analysisKind: "donor_assessment",
      client,
    });
    assert.ok(jobId.startsWith("job-"));
  });

  it("claims a queued job and marks running", async () => {
    const { client } = createJobStore([makeJob({ id: "job-1", status: "queued" })]);
    const claimed = await claimNextImagingAiAnalysisJob({ tenantId: "tenant-1", client });
    assert.ok(claimed);
    assert.equal(claimed!.status, "running");
  });

  it("completes a running job", async () => {
    const { client, rows } = createJobStore([
      makeJob({ id: "job-1", analysis_kind: "donor_assessment", status: "running" }),
    ]);
    await completeImagingAiAnalysisJob({
      tenantId: "tenant-1",
      jobId: "job-1",
      resultPayload: { ok: true },
      client,
    });
    assert.equal(rows[0].status, "completed");
    assert.deepEqual(rows[0].result_payload, { ok: true });
  });

  it("requeues failed jobs before max attempts", async () => {
    const { client, rows } = createJobStore([
      makeJob({
        id: "job-1",
        status: "running",
        request_payload: { attempt_count: 0 },
      }),
    ]);
    await failImagingAiAnalysisJob({
      tenantId: "tenant-1",
      jobId: "job-1",
      errorMessage: "temporary",
      client,
    });
    assert.equal(rows[0].status, "queued");
    assert.equal((rows[0].request_payload as { attempt_count: number }).attempt_count, 1);
  });
});