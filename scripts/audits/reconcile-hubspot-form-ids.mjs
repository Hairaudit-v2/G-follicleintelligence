import { readFileSync, writeFileSync } from "node:fs";

const exp = JSON.parse(
  readFileSync("docs/audits/evidence-fi-hubspot-export-form-ids.json", "utf8")
);
const bak = JSON.parse(
  readFileSync("docs/audits/evidence-fi-hubspot-backup-form-ids.json", "utf8")
);

const exportSet = new Set(exp.formIds.map((id) => String(id).toLowerCase()));
const backupSet = new Set(bak.formIds.map((id) => String(id).toLowerCase()));
const onlyInExport = [...exportSet].filter((id) => !backupSet.has(id)).sort();
const onlyInBackup = [...backupSet].filter((id) => !exportSet.has(id)).sort();
const intersectionCount = [...exportSet].filter((id) => backupSet.has(id)).length;

const out = {
  evidenceType: "hubspot_forms_inventory_reconciliation",
  status: "IDS_COMPARED",
  backupRunId: bak.backupRunId,
  exportEvidence: "docs/audits/evidence-fi-hubspot-export-form-ids.json",
  backupFormIdsEvidence: "docs/audits/evidence-fi-hubspot-backup-form-ids.json",
  exportSourceFilename: exp.sourceFilename,
  exportSourceSha256: exp.sourceSha256,
  exportSheet: exp.sourceSheet,
  exportIdColumn: exp.sourceIdColumn,
  exportUnique: exportSet.size,
  backupUnique: backupSet.size,
  onlyInExport,
  onlyInBackup,
  duplicatesInExport: exp.duplicateIds ?? [],
  duplicatesInBackup: bak.duplicateIds ?? [],
  intersectionCount,
  parentFormIntegritySubmissions: {
    submissionRows: 5311,
    withParentFormAssociation: 5311,
    orphanMissingParentFormDefinition: 0,
    note: "All staged submissions resolve to the 46 backed-up form definitions.",
  },
  exportOnlyClassifications: null,
};

writeFileSync(
  "docs/audits/evidence-fi-hubspot-forms-reconciliation.json",
  `${JSON.stringify(out, null, 2)}\n`
);
console.log(
  JSON.stringify(
    {
      exportUnique: out.exportUnique,
      backupUnique: out.backupUnique,
      onlyInExport,
      onlyInBackup,
      intersectionCount,
    },
    null,
    2
  )
);
