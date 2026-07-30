/**
 * FI-IMAGINGOS-PRE-SURGERY-PROJECTION-1A — Persistent replay protection (not memory-only).
 */

import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ProjectionGatewayError } from "./errors";
import { logProjectionEvent } from "./observability";
import { sha256Hex } from "./hmac";

export type ReplayClaimResult = { ok: true } | { ok: false; reason: "replay" };

export interface ProjectionReplayStore {
  claim(input: {
    serviceSource: string;
    replayKey: string;
    expiresAt: string;
  }): Promise<ReplayClaimResult>;
}

export function buildRequestReplayKey(args: {
  timestamp: string;
  idempotencyKey: string;
  bodySha256: string;
}): string {
  return sha256Hex(`${args.timestamp}:${args.idempotencyKey}:${args.bodySha256}`);
}

export function createMemoryReplayStore(): ProjectionReplayStore & {
  keys: Map<string, string>;
} {
  const keys = new Map<string, string>();
  return {
    keys,
    async claim(input) {
      const full = `${input.serviceSource}:${input.replayKey}`;
      if (keys.has(full)) return { ok: false, reason: "replay" };
      keys.set(full, input.expiresAt);
      return { ok: true };
    },
  };
}

export function createSupabaseReplayStore(): ProjectionReplayStore {
  return {
    async claim(input) {
      const db = supabaseAdmin();
      const { error } = await db.from("imaging_os_pre_surgery_projection_replays").insert({
        service_source: input.serviceSource,
        replay_key: input.replayKey,
        expires_at: input.expiresAt,
      });
      if (error) {
        // unique violation
        if (error.code === "23505") return { ok: false, reason: "replay" };
        throw error;
      }
      return { ok: true };
    },
  };
}

export async function assertProjectionRequestNotReplayed(input: {
  store: ProjectionReplayStore;
  serviceSource: string;
  timestamp: string;
  idempotencyKey: string;
  rawBody: string;
  ttlSeconds?: number;
}): Promise<void> {
  const bodySha256 = sha256Hex(input.rawBody);
  const replayKey = buildRequestReplayKey({
    timestamp: input.timestamp,
    idempotencyKey: input.idempotencyKey,
    bodySha256,
  });
  const ttl = input.ttlSeconds ?? 600;
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  const result = await input.store.claim({
    serviceSource: input.serviceSource,
    replayKey,
    expiresAt,
  });
  if (!result.ok) {
    logProjectionEvent({
      event: "replay_rejected",
      reason: "replay",
      httpStatus: 409,
      idempotencyKeyPrefix: input.idempotencyKey,
    });
    throw new ProjectionGatewayError("replay_rejected", "Replay of signed request rejected", 409);
  }
}
