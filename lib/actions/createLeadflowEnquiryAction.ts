"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import { createCrmLeadWithPerson } from "@/src/lib/crm/server";
import { loadCrmShellUserPickerOptions } from "@/src/lib/crm/crmShellLoaders";
import { getCrmShellSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import {
  createLeadflowEnquiryInputSchema,
  mapLeadflowEnquiryToCrmCreateBody,
} from "@/src/lib/leadFlow/createLeadflowEnquiryCore";

const PERMISSION_DENIED = "You do not have permission to create enquiries.";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) {
    if (e.status === 401 || e.status === 403) return PERMISSION_DENIED;
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return "Could not create enquiry. Please try again.";
}

export async function createLeadflowEnquiryAction(
  tenantId: string,
  input: unknown
): Promise<{ ok: true; leadId: string } | { ok: false; error: string }> {
  try {
    const tid = tenantId.trim();
    if (!tid) return { ok: false, error: "Tenant is required." };

    await assertCrmTenantWriteAllowed({ tenantId: tid, request: undefined });

    const parsed = createLeadflowEnquiryInputSchema.parse(input);
    const body = mapLeadflowEnquiryToCrmCreateBody(parsed);
    const person = body.person as Record<string, unknown>;

    const phoneRaw = person.phone;
    const emailRaw = person.email;
    const phone = phoneRaw != null && String(phoneRaw).trim() ? String(phoneRaw).trim() : null;
    const email = emailRaw != null && String(emailRaw).trim() ? String(emailRaw).trim() : null;

    const lead = await createCrmLeadWithPerson({
      tenantId: tid,
      summary: String(body.summary),
      status: String(body.status ?? "open"),
      priority: (body.priority as string | undefined) ?? undefined,
      primaryOwnerUserId: (body.primaryOwnerUserId as string | undefined) ?? undefined,
      metadata: (body.metadata as Record<string, unknown>) ?? undefined,
      person: {
        display_name: String(person.display_name ?? ""),
        source_system: String(person.source_system ?? "fi_crm"),
        phone,
        email,
        metadata: (person.metadata as Record<string, unknown> | undefined) ?? undefined,
      },
    });

    revalidatePath(`/fi-admin/${tid}/crm`);
    revalidatePath(`/fi-admin/${tid}/leadflow`);

    return { ok: true, leadId: lead.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadLeadflowEnquiryFormOptionsAction(tenantId: string): Promise<
  | {
      ok: true;
      owners: Awaited<ReturnType<typeof loadCrmShellUserPickerOptions>>;
      defaultOwnerUserId: string;
    }
  | { ok: false; error: string }
> {
  try {
    const tid = tenantId.trim();
    if (!tid) return { ok: false, error: "Tenant is required." };

    const session = await getCrmShellSessionIfAllowed(tid);
    if (!session?.canUseClinicFeatures) {
      return { ok: false, error: PERMISSION_DENIED };
    }

    const owners = await loadCrmShellUserPickerOptions(tid);
    return { ok: true, owners, defaultOwnerUserId: session.fiUserId };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
