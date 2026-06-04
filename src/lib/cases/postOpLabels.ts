import type { FollowUpCheckpointValue, FollowUpStatusValue, PostOpStatusValue } from "./postOpTypes";
import { FOLLOW_UP_CHECKPOINT_VALUES, FOLLOW_UP_STATUS_VALUES, POST_OP_STATUS_VALUES } from "./postOpTypes";

export { FOLLOW_UP_CHECKPOINT_VALUES, FOLLOW_UP_STATUS_VALUES, POST_OP_STATUS_VALUES };

const POST_OP_LABELS: Record<PostOpStatusValue, string> = {
  not_started: "Not started",
  immediate_post_op: "Immediate post-op",
  early_recovery: "Early recovery",
  healing: "Healing",
  routine_follow_up: "Routine follow-up",
  stable: "Stable",
  needs_attention: "Needs attention",
  closed: "Closed",
};

export function postOpStatusLabel(status: string | null | undefined): string {
  if (!status?.trim()) return POST_OP_LABELS.not_started;
  const k = status.trim().toLowerCase();
  if (k in POST_OP_LABELS) return POST_OP_LABELS[k as PostOpStatusValue];
  return status.trim();
}

const CHECKPOINT_LABELS: Record<FollowUpCheckpointValue, string> = {
  day_1: "Day 1",
  day_7: "Day 7",
  day_14: "Day 14",
  month_1: "Month 1",
  month_3: "Month 3",
  month_6: "Month 6",
  month_12: "Month 12",
};

export function followUpCheckpointLabel(checkpoint: string | null | undefined): string {
  if (!checkpoint?.trim()) return "—";
  const k = checkpoint.trim().toLowerCase();
  if (k in CHECKPOINT_LABELS) return CHECKPOINT_LABELS[k as FollowUpCheckpointValue];
  return checkpoint.trim();
}

const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatusValue, string> = {
  pending: "Pending",
  scheduled: "Scheduled",
  completed: "Completed",
  skipped: "Skipped",
  cancelled: "Cancelled",
};

export function followUpStatusLabel(status: string | null | undefined): string {
  if (!status?.trim()) return FOLLOW_UP_STATUS_LABELS.pending;
  const k = status.trim().toLowerCase();
  if (k in FOLLOW_UP_STATUS_LABELS) return FOLLOW_UP_STATUS_LABELS[k as FollowUpStatusValue];
  return status.trim();
}
