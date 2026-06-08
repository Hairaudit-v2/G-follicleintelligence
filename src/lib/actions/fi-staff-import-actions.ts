"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { type IiohrHrStaffImportRunResult, runIiohrHrStaffImport } from "@/src/lib/staffImport/iiohrHrStaffImportRunner";

const tenantRowsBodySchema = z.object({
  tenantId: z.string().uuid("tenantId must be a UUID."),
  adminKey: z.string().optional(),
  rows: z.array(z.unknown()),
});

const commitBodySchema = tenantRowsBodySchema.extend({
  confirm: z.literal(true),
});

const legacyImportBodySchema = z
  .object({
    tenantId: z.string().uuid("tenantId must be a UUID."),
    adminKey: z.string().optional(),
    commit: z.boolean().optional(),
    confirm: z.boolean().optional(),
    rows: z.array(z.unknown()),
  })
  .refine((b) => b.commit !== true || b.confirm === true, {
    message: "When commit is true, confirm must be true.",
    path: ["confirm"],
  });

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateStaffSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/staff`);
  revalidatePath(`/fi-admin/${tid}/hr/staff-import`);
  revalidatePath(`/fi-admin/${tid}/calendar`);
  revalidatePath(`/fi-admin/${tid}`);
  revalidatePath(`/fi-admin/${tid}/appointments`);
  revalidatePath(`/fi-admin/${tid}/patients`);
}

/**
 * Dry-run only: plan IIOHR HR staff import for the tenant (no DB writes).
 * Gated by staff-manage / FI admin (see `assertIiohrHrStaffImportAllowed` in runner).
 */
export async function planIiohrHrStaffImportAction(
  body: unknown
): Promise<{ ok: true; result: IiohrHrStaffImportRunResult } | { ok: false; error: string }> {
  try {
    const parsed = tenantRowsBodySchema.parse(body);
    const authUserId = await resolveAuthUserId(null);
    const result = await runIiohrHrStaffImport({
      tenantId: parsed.tenantId,
      rows: parsed.rows,
      commit: false,
      adminKey: parsed.adminKey,
      authUserId,
    });
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/**
 * Apply a previously previewed plan. Requires `confirm: true` alongside the same `rows` payload.
 */
export async function commitIiohrHrStaffImportAction(
  body: unknown
): Promise<{ ok: true; result: IiohrHrStaffImportRunResult } | { ok: false; error: string }> {
  try {
    const parsed = commitBodySchema.parse(body);
    const authUserId = await resolveAuthUserId(null);
    const result = await runIiohrHrStaffImport({
      tenantId: parsed.tenantId,
      rows: parsed.rows,
      commit: true,
      confirm: true,
      adminKey: parsed.adminKey,
      authUserId,
    });

    if (result.ok && result.commit) {
      revalidateStaffSurfaces(parsed.tenantId);
    }

    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/**
 * Tenant-scoped IIOHR HR staff import (dry-run by default).
 * When `commit: true`, `confirm: true` is required.
 */
export async function importIiohrHrStaffAction(
  body: unknown
): Promise<{ ok: true; result: IiohrHrStaffImportRunResult } | { ok: false; error: string }> {
  try {
    const parsed = legacyImportBodySchema.parse(body);
    const authUserId = await resolveAuthUserId(null);
    const result = await runIiohrHrStaffImport({
      tenantId: parsed.tenantId,
      rows: parsed.rows,
      commit: parsed.commit === true,
      confirm: parsed.confirm === true,
      adminKey: parsed.adminKey,
      authUserId,
    });

    if (result.ok && result.commit) {
      revalidateStaffSurfaces(parsed.tenantId);
    }

    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
