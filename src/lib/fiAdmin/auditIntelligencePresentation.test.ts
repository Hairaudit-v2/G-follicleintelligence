import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildAuditAttentionPriorities,
  buildAuditHealthCards,
  buildQualityTrendMetrics,
  hasUrgentAuditAttention,
} from "@/src/lib/fiAdmin/auditIntelligencePresentation";
import type { AuditDashboardSnapshot } from "@/src/lib/fiAdmin/auditDashboardTypes";

const emptySnapshot: AuditDashboardSnapshot = {
  kpis: {
    draft_reports: 0,
    changes_required_reports: 0,
    released_reports: 0,
    pending_reviews: 0,
    oldest_queue_created_at: null,
  },
  queue: [],
  recent_audit_activity: [],
  pipeline: {
    model_runs: { queued: 0, running: 0, failed: 0, complete: 0 },
    scorecards_total: 0,
  },
};

test("buildAuditAttentionPriorities: returns at most five items ordered by priority", () => {
  const items = buildAuditAttentionPriorities("/fi-admin/t1", {
    ...emptySnapshot,
    kpis: {
      draft_reports: 4,
      changes_required_reports: 2,
      released_reports: 1,
      pending_reviews: 6,
      oldest_queue_created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
    queue: [
      {
        report_id: "r1",
        case_id: "c1",
        version: 1,
        report_status: "draft",
        created_at: new Date().toISOString(),
        patient: null,
      },
    ],
  });
  assert.equal(items.length, 5);
  assert.equal(items[0]?.id, "pending_review");
});

test("buildAuditAttentionPriorities: calm state when no urgent items", () => {
  const items = buildAuditAttentionPriorities("/fi-admin/t1", {
    ...emptySnapshot,
    kpis: {
      draft_reports: 0,
      changes_required_reports: 0,
      released_reports: 5,
      pending_reviews: 0,
      oldest_queue_created_at: null,
    },
    pipeline: {
      model_runs: { queued: 0, running: 0, failed: 0, complete: 5 },
      scorecards_total: 5,
    },
  });
  assert.equal(hasUrgentAuditAttention(items), false);
});

test("buildAuditHealthCards: returns six clinic-facing cards", () => {
  const cards = buildAuditHealthCards({
    ...emptySnapshot,
    kpis: {
      draft_reports: 2,
      changes_required_reports: 1,
      released_reports: 3,
      pending_reviews: 3,
      oldest_queue_created_at: null,
    },
    pipeline: {
      model_runs: { queued: 0, running: 0, failed: 0, complete: 3 },
      scorecards_total: 3,
    },
  });
  assert.equal(cards.length, 6);
  assert.match(cards[0]?.label ?? "", /awaiting review/i);
});

test("buildQualityTrendMetrics: null when no reports", () => {
  assert.equal(buildQualityTrendMetrics(emptySnapshot.kpis), null);
});
