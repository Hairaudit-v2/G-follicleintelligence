/**
 * Thin server adapter — identity. Loads profile fields; resolves via pure adapter.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveIdentitySignals } from "./identityReadinessAdapter";
import type { IdentitySourceBag } from "../readinessSourceBag";

export async function runIdentityReadinessAdapter(args: {
  bag: IdentitySourceBag;
  enrolmentPatientId: string;
  enrolmentTenantId: string;
  evaluatedAt: string;
  supabase?: SupabaseClient;
}) {
  void args.supabase;
  return resolveIdentitySignals({
    bag: args.bag,
    enrolmentPatientId: args.enrolmentPatientId,
    enrolmentTenantId: args.enrolmentTenantId,
    evaluatedAt: args.evaluatedAt,
  });
}
