import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Best-effort object existence check before dual-write insert.
 * Uses a short-lived signed URL probe (does not download bytes).
 */
export async function verifyDualWriteStorageObjectExists(
  supabase: SupabaseClient,
  storageBucket: string,
  storagePath: string
): Promise<boolean> {
  const bucket = storageBucket.trim();
  const path = storagePath.trim();
  if (!bucket || !path) return false;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return false;
  return true;
}