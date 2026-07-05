import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CrmAccessError } from "@/src/lib/crm/crmGate";
import {
  resolveCurrentTenantFiUserId,
  type ResolveCurrentTenantFiUserIdInput,
} from "@/src/lib/workforce-os/resolveCurrentTenantFiUserId.server";
import { WORKFORCE_ACTOR_FI_USER_NOT_LINKED_MESSAGE } from "@/src/lib/workforce-os/workforceMutationErrorsCore";

export { WORKFORCE_ACTOR_FI_USER_NOT_LINKED_MESSAGE };

export type ResolveWorkforceActorFiUserIdTestOptions = Pick<
  ResolveCurrentTenantFiUserIdInput,
  "authUserIdForTests" | "skipPlatformAdminLookupForTests" | "supabase"
>;

/**
 * Resolves `fi_users.id` for audited workforce mutations (leave blocks, roster shifts, lifecycle).
 * Never returns `auth.users.id`.
 */
export async function resolveWorkforceActorFiUserId(
  tenantId: string,
  testOptions?: ResolveWorkforceActorFiUserIdTestOptions
): Promise<string> {
  try {
    return await resolveCurrentTenantFiUserId({
      supabase: testOptions?.supabase ?? supabaseAdmin(),
      tenantId,
      authUserIdForTests: testOptions?.authUserIdForTests,
      skipPlatformAdminLookupForTests: testOptions?.skipPlatformAdminLookupForTests,
    });
  } catch (e) {
    if (e instanceof CrmAccessError && (e.status === 403 || e.status === 401)) {
      throw new CrmAccessError(e.status, WORKFORCE_ACTOR_FI_USER_NOT_LINKED_MESSAGE);
    }
    throw e;
  }
}
