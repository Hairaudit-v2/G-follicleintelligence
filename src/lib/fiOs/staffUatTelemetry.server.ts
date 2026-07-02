import "server-only";

import { publishFiEventBestEffort } from "@/src/lib/events/fiEventPublisher.server";
import type { StaffUatFrictionEvent, StaffUatFeedbackInput } from "./staffUatFrictionCore";

export async function persistStaffUatFeedback(input: StaffUatFeedbackInput): Promise<{ ok: boolean }> {
  const eventId = await publishFiEventBestEffort({
    tenantId: input.tenantId,
    eventName: "staff.uat.feedback",
    sourceModule: "platform_core",
    entityType: "staff_uat",
    payload: {
      route: input.route,
      role: input.role,
      screenKey: input.screenKey ?? null,
      rating: input.rating,
      comment: input.comment?.trim() || null,
    },
    metadata: {
      idempotencyKey: `uat-feedback:${input.route}:${input.rating}:${Date.now()}`,
    },
  });
  return { ok: eventId != null };
}

export async function persistStaffUatFriction(
  tenantId: string,
  event: StaffUatFrictionEvent
): Promise<{ ok: boolean }> {
  const eventId = await publishFiEventBestEffort({
    tenantId,
    eventName: "staff.uat.friction",
    sourceModule: "platform_core",
    entityType: "staff_uat",
    occurredAt: event.occurredAt,
    payload: {
      frictionType: event.frictionType,
      route: event.route,
      role: event.role,
      screenKey: event.screenKey ?? null,
      detail: event.detail ?? null,
      ...event.payload,
    },
    metadata: {
      idempotencyKey: `uat-friction:${event.frictionType}:${event.route}:${event.occurredAt}`,
    },
  });
  return { ok: eventId != null };
}