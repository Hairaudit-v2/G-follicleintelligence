import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const base =
  "G:/follicleintelligence/FI-HUBSPOT-BACKUP-1/record-exports/forms-and-submissions/submissions";

function walk(d, acc = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
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

let filesWithCol = 0;
let rows = 0;
let populated = 0;
let blank = 0;
const perFile = [];

for (const f of walk(base)) {
  const table = parseCsv(readFileSync(f, "utf8"));
  if (!table.length) continue;
  const header = table[0].map((h) => String(h ?? "").trim());
  const idx = header.findIndex((h) => /hubspot\s*contact\s*id|^contact\s*id$/i.test(h));
  if (idx < 0) continue;
  filesWithCol += 1;
  let filePop = 0;
  let fileBlank = 0;
  for (let r = 1; r < table.length; r++) {
    rows += 1;
    const v = String(table[r][idx] ?? "").trim();
    if (v) {
      populated += 1;
      filePop += 1;
    } else {
      blank += 1;
      fileBlank += 1;
    }
  }
  perFile.push({
    file: path.basename(f),
    header: header[idx],
    rows: table.length - 1,
    populated: filePop,
    blank: fileBlank,
  });
}

console.log(
  JSON.stringify(
    {
      csvFilesWithContactIdCol: filesWithCol,
      submissionRows: rows,
      contactIdPopulated: populated,
      contactIdBlank: blank,
      perFile,
      note: "Counts only; no contact IDs printed.",
    },
    null,
    2
  )
);
