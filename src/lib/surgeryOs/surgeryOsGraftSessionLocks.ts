/**
 * SurgeryOS graft counting session locks — theatre-tablet lock resolution and takeover rules.
 */

/** Session lock TTL — stale locks can be taken over by another theatre tablet. */
export const SURGERY_OS_GRAFT_SESSION_LOCK_TTL_MS = 4 * 60 * 60 * 1000;

export type SurgeryOsGraftCountSessionLockKind = "extraction" | "implantation";

export type SurgeryOsGraftCountSessionLock = {
  kind: SurgeryOsGraftCountSessionLockKind;
  deviceId: string | null;
  heldAt: string | null;
  heldByFiUserId: string | null;
  heldByLabel: string | null;
  isHeldByDevice: boolean;
  isStale: boolean;
};

export function isGraftCountSessionLockStale(heldAt: string | null, nowMs: number): boolean {
  if (!heldAt) return true;
  const heldMs = Date.parse(heldAt);
  if (!Number.isFinite(heldMs)) return true;
  return nowMs - heldMs > SURGERY_OS_GRAFT_SESSION_LOCK_TTL_MS;
}

export function resolveGraftCountSessionLock(input: {
  kind: SurgeryOsGraftCountSessionLockKind;
  deviceId: string | null;
  heldAt: string | null;
  heldByFiUserId: string | null;
  heldByLabel?: string | null;
  requestingDeviceId: string | null;
  nowMs: number;
}): SurgeryOsGraftCountSessionLock {
  const isStale = isGraftCountSessionLockStale(input.heldAt, input.nowMs);
  const isHeldByDevice =
    Boolean(input.deviceId) &&
    Boolean(input.requestingDeviceId) &&
    input.deviceId === input.requestingDeviceId &&
    !isStale;

  return {
    kind: input.kind,
    deviceId: input.deviceId,
    heldAt: input.heldAt,
    heldByFiUserId: input.heldByFiUserId,
    heldByLabel: input.heldByLabel ?? null,
    isHeldByDevice,
    isStale,
  };
}

export function canAcquireGraftCountSessionLock(input: {
  lockDeviceId: string | null;
  lockHeldAt: string | null;
  requestingDeviceId: string | null;
  nowMs: number;
}): boolean {
  if (!input.requestingDeviceId?.trim()) {
    return false;
  }
  if (!input.lockDeviceId?.trim()) return true;
  if (input.lockDeviceId === input.requestingDeviceId) return true;
  return isGraftCountSessionLockStale(input.lockHeldAt, input.nowMs);
}

export function assertGraftCountSessionLock(input: {
  kind: SurgeryOsGraftCountSessionLockKind;
  lockDeviceId: string | null;
  lockHeldAt: string | null;
  requestingDeviceId: string | null;
  nowMs: number;
}): void {
  if (!input.requestingDeviceId?.trim()) {
    throw new Error("A theatre device id is required for graft counting.");
  }
  if (
    !canAcquireGraftCountSessionLock({
      lockDeviceId: input.lockDeviceId,
      lockHeldAt: input.lockHeldAt,
      requestingDeviceId: input.requestingDeviceId,
      nowMs: input.nowMs,
    })
  ) {
    const phase = input.kind === "extraction" ? "extraction" : "implantation";
    throw new Error(
      `Another tablet holds the active ${phase} count session. Sync or wait for the lock to expire before counting.`
    );
  }
}
