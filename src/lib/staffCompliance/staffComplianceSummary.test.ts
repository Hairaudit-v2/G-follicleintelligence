import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildStaffComplianceSummaryFromSourceRows,
  inferStaffComplianceStatus,
  resolveStaffComplianceStatus,
} from "./staffComplianceSummary";

const FIXED = new Date("2026-06-08T12:00:00.000Z");

test("infer: current — completed, expiry far in future, no status", () => {
  const s = inferStaffComplianceStatus(
    {
      id: "x",
      completed_at: "2026-06-01T00:00:00.000Z",
      expires_at: "2027-06-01T00:00:00.000Z",
    },
    FIXED
  );
  assert.equal(s, "current");
});

test("infer: expired — expires_at in the past", () => {
  const s = inferStaffComplianceStatus(
    { id: "x", completed_at: "2025-01-01T00:00:00.000Z", expires_at: "2026-01-01T00:00:00.000Z" },
    FIXED
  );
  assert.equal(s, "expired");
});

test("infer: due_soon — expires_at within 30 days", () => {
  const s = inferStaffComplianceStatus(
    { id: "x", completed_at: "2026-01-01T00:00:00.000Z", expires_at: "2026-07-01T00:00:00.000Z" },
    FIXED
  );
  assert.equal(s, "due_soon");
});

test("infer: missing — no completed_at", () => {
  assert.equal(
    inferStaffComplianceStatus({ id: "x", expires_at: "2027-06-01T00:00:00.000Z" }, FIXED),
    "missing"
  );
  assert.equal(inferStaffComplianceStatus({ id: "x" }, FIXED), "missing");
});

test("infer: current — completed_at only, no expiry", () => {
  assert.equal(
    inferStaffComplianceStatus({ id: "x", completed_at: "2026-05-01T00:00:00.000Z" }, FIXED),
    "current"
  );
});

test("resolve: declared unknown preserved when dates do not override", () => {
  const r = resolveStaffComplianceStatus(
    "unknown",
    { id: "x", completed_at: "2026-05-01T00:00:00.000Z", expires_at: "2027-06-01T00:00:00.000Z" },
    FIXED
  );
  assert.equal(r, "unknown");
});

test("build: invalid per-item source_url ignored", () => {
  const sum = buildStaffComplianceSummaryFromSourceRows(
    [
      {
        source_system: "iiohr",
        metadata: {
          training: [
            {
              id: "a",
              label: "A",
              completed_at: "2026-06-01T00:00:00.000Z",
              expires_at: "2027-06-01T00:00:00.000Z",
              source_url: "javascript:alert(1)",
            },
          ],
        },
      },
    ],
    { now: FIXED }
  );
  assert.equal(sum.items[0]?.sourceUrl, null);
});

test("build: overallStatus priority expired over current", () => {
  const sum = buildStaffComplianceSummaryFromSourceRows(
    [
      {
        source_system: "iiohr",
        metadata: {
          training: [
            {
              id: "ok",
              label: "Ok",
              completed_at: "2026-06-01T00:00:00.000Z",
              expires_at: "2027-06-01T00:00:00.000Z",
            },
          ],
          compliance: [
            {
              id: "bad",
              label: "Bad",
              completed_at: "2024-01-01T00:00:00.000Z",
              expires_at: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      },
    ],
    { now: FIXED }
  );
  assert.equal(sum.overallStatus, "expired");
  assert.equal(sum.counts.expired, 1);
  assert.equal(sum.counts.current, 1);
});

test("build: empty metadata / no rows", () => {
  assert.equal(
    buildStaffComplianceSummaryFromSourceRows([], { now: FIXED }).overallStatus,
    "unknown"
  );
  assert.equal(
    buildStaffComplianceSummaryFromSourceRows([{ source_system: "x", metadata: {} }], {
      now: FIXED,
    }).items.length,
    0
  );
});

test("build: lastSyncedAt picks latest parseable", () => {
  const sum = buildStaffComplianceSummaryFromSourceRows(
    [
      { source_system: "a", metadata: { last_synced_at: "2026-06-01T00:00:00.000Z" } },
      { source_system: "b", metadata: { last_synced_at: "2026-06-08T00:00:00.000Z" } },
    ],
    { now: FIXED }
  );
  assert.equal(sum.lastSyncedAt, "2026-06-08T00:00:00.000Z");
});

test("build: training and compliance arrays combined", () => {
  const sum = buildStaffComplianceSummaryFromSourceRows(
    [
      {
        source_system: "iiohr",
        metadata: {
          last_synced_at: "2026-06-08T00:00:00.000Z",
          training: [{ id: "t1", label: "T1", completed_at: "2026-06-01T00:00:00.000Z" }],
          compliance: [{ id: "c1", label: "C1", completed_at: "2026-05-01T00:00:00.000Z" }],
        },
      },
    ],
    { now: FIXED }
  );
  assert.equal(sum.items.length, 2);
  assert.ok(sum.items.some((i) => i.id === "t1" && i.label === "T1"));
  assert.ok(sum.items.some((i) => i.id === "c1" && i.label === "C1"));
});

test("build: https source_url kept", () => {
  const sum = buildStaffComplianceSummaryFromSourceRows(
    [
      {
        source_system: "iiohr",
        metadata: {
          training: [
            {
              id: "doc",
              label: "Doctor Training Volume 1",
              completed_at: "2026-06-01T00:00:00.000Z",
              expires_at: "2027-06-01T00:00:00.000Z",
              status: "current",
              source_url: "https://academy.example/course/1",
            },
          ],
        },
      },
    ],
    { now: FIXED }
  );
  assert.equal(sum.items[0]?.sourceUrl, "https://academy.example/course/1");
  assert.equal(sum.items[0]?.status, "current");
});

test("resolve: declared current overridden to due_soon when expiry within 30 days", () => {
  const sum = buildStaffComplianceSummaryFromSourceRows(
    [
      {
        source_system: "iiohr",
        metadata: {
          compliance: [
            {
              id: "ic",
              label: "Infection Control",
              completed_at: "2026-05-01T00:00:00.000Z",
              expires_at: "2026-07-01T00:00:00.000Z",
              status: "current",
            },
          ],
        },
      },
    ],
    { now: FIXED }
  );
  assert.equal(sum.items[0]?.status, "due_soon");
});

test("build: overall missing beats current", () => {
  const sum = buildStaffComplianceSummaryFromSourceRows(
    [
      {
        source_system: "iiohr",
        metadata: {
          training: [{ id: "m", label: "M", expires_at: "2027-06-01T00:00:00.000Z" }],
          compliance: [{ id: "c", label: "C", completed_at: "2026-06-01T00:00:00.000Z" }],
        },
      },
    ],
    { now: FIXED }
  );
  assert.equal(sum.overallStatus, "missing");
});
