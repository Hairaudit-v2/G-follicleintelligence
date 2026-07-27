/**
 * Privacy-safe form submission ID reconciliation: baseline CSVs vs staging JSON dump.
 * Does not print names, emails, or field values.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const BASE =
  "G:/follicleintelligence/FI-HUBSPOT-BACKUP-1/record-exports/forms-and-submissions/submissions";
const OUT_DIR = "G:/follicleintelligence/docs/audits";

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".csv")) acc.push(p);
  }
  return acc;
}

function parseCsv(text) {
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n" || (c === "\r" && text[i + 1] === "\n")) {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      if (c === "\r") i += 2;
      else i++;
      continue;
    }
    if (c === "\r") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const files = walk(BASE);
const all = new Set();
const byForm = new Map();
const fileStats = [];
const baselineDupEvents = [];

for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  const rows = parseCsv(text);
  if (!rows.length) continue;
  const header = rows[0].map((h) => String(h || "").trim());
  let idx = header.findIndex((h) => /conversion\s*id/i.test(h));
  if (idx < 0) idx = header.findIndex((h) => /submission\s*id/i.test(h));
  if (idx < 0) idx = header.findIndex((h) => /^record id$/i.test(h));
  const folder = path.basename(path.dirname(f));
  if (!byForm.has(folder)) byForm.set(folder, new Set());
  const set = byForm.get(folder);
  let blank = 0;
  for (let r = 1; r < rows.length; r++) {
    const id = String(rows[r][idx] ?? "").trim();
    if (!id) {
      blank++;
      continue;
    }
    if (all.has(id)) baselineDupEvents.push({ idHash: hashId(id), folder });
    all.add(id);
    set.add(id);
  }
  fileStats.push({
    folder,
    file: path.basename(f),
    headerIdCol: header[idx] || null,
    rows: rows.length - 1,
    uniqueInFileFolder: set.size,
    blank,
  });
}

function hashId(id) {
  return createHash("sha256").update(id, "utf8").digest("hex").slice(0, 12);
}

const outIds = path.join(OUT_DIR, ".tmp-baseline-submission-ids.json");
fs.writeFileSync(
  outIds,
  JSON.stringify({
    canonical_column_hint: "Conversion ID",
    count: all.size,
    ids: [...all],
    byForm: Object.fromEntries([...byForm].map(([k, v]) => [k, [...v]])),
  })
);

console.log(
  JSON.stringify(
    {
      baseline_unique_ids: all.size,
      baseline_internal_dup_events: baselineDupEvents.length,
      files: fileStats,
      ids_path: outIds,
    },
    null,
    2
  )
);
