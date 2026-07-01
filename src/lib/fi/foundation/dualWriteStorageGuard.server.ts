import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { validateDualWriteStorageLocation } from "./dualWriteStoragePathValidation";
import { verifyDualWriteStorageObjectExists } from "./dualWriteStorageVerification.server";

export type DualWriteStorageGuardResult =
  | { ok: true; storage_bucket: string; storage_path: string }
  | { ok: false; error: string };

export async function assertDualWriteStorageGuard(input: {
  tenantId: string;
  storageBucket: string;
  storagePath: string;
  supabase: SupabaseClient;
  verifyObjectExists?: boolean;
}): Promise<DualWriteStorageGuardResult> {
  const validated = validateDualWriteStorageLocation({
    tenantId: input.tenantId,
    storageBucket: input.storageBucket,
    storagePath: input.storagePath,
  });
  if (!validated.ok) return validated;

  if (input.verifyObjectExists !== false) {
    const exists = await verifyDualWriteStorageObjectExists(
      input.supabase,
      validated.storage_bucket,
      validated.storage_path
    );
    if (!exists) {
      return { ok: false, error: "Storage object not found in allowed bucket." };
    }
  }

  return validated;
}