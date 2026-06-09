#!/usr/bin/env tsx
/**
 * CLI: preview or commit Evolved payroll EmployeeData export → FI OS staff.
 *
 * Usage:
 *   tsx scripts/import-evolved-payroll-staff.ts --tenant-id=<uuid> --file=path/to/export.xlsx
 *   tsx scripts/import-evolved-payroll-staff.ts --tenant-id=<uuid> --file=... --commit
 */

import { readFileSync } from "node:fs";

import { parseEvolvedPayrollExportXlsxBuffer } from "@/src/lib/staffImport/evolvedPayrollStaffImportParse";
import {
  logEvolvedPayrollStaffImportReport,
  runEvolvedPayrollStaffImport,
} from "@/src/lib/staffImport/evolvedPayrollStaffImportRunner";

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

async function main(): Promise<void> {
  const tenantId = arg("tenant-id")?.trim() ?? process.env.EVOLVED_PERTH_TENANT_ID?.trim() ?? "";
  const file = arg("file")?.trim();
  const commit = process.argv.includes("--commit");

  if (!tenantId) {
    console.error("Missing --tenant-id= or EVOLVED_PERTH_TENANT_ID");
    process.exit(1);
  }
  if (!file) {
    console.error("Missing --file=path/to/EmployeeData.xlsx");
    process.exit(1);
  }

  const buffer = readFileSync(file);
  const parsed = parseEvolvedPayrollExportXlsxBuffer(buffer);
  if (parsed.validationErrors.length) {
    for (const e of parsed.validationErrors) console.error(e);
  }

  const result = await runEvolvedPayrollStaffImport({
    tenantId,
    rows: [],
    packedRows: parsed.rows,
    sourceRowIndices: parsed.sourceRowIndices,
    skippedSensitiveFields: parsed.skippedSensitiveFields,
    commit,
    confirm: commit,
    adminKey: process.env.FI_ADMIN_API_KEY,
  });

  logEvolvedPayrollStaffImportReport(result);
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
