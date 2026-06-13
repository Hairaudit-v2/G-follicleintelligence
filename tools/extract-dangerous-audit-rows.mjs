import fs from "node:fs";

const text = fs.readFileSync(new URL("./audit-supabase-admin-from.result.csv", import.meta.url), "utf8");

function parseCSV(text) {
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
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
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const rows = parseCSV(text);
const h = rows[0];
const idx = Object.fromEntries(h.map((k, i) => [k, i]));
const dangerous = rows.slice(1).filter((r) => r[idx.rating] === "DANGEROUS");
const out = new URL("./dangerous-rows.parsed.json", import.meta.url);
fs.writeFileSync(out, JSON.stringify({ count: dangerous.length, rows: dangerous, headers: h }, null, 2), "utf8");
console.log("wrote", out.pathname || out.href, "count", dangerous.length);
