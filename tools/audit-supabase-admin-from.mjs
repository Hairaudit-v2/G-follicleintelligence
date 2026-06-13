/**
 * Audit: supabaseAdmin-assigned client usage — .from / .schema().from / .rpc
 * Multiline method chains via dot-continuation merge; tenant + ownership heuristics.
 * Writes tools/audit-supabase-admin-from.result.{json,csv}
 */
import fs from "node:fs";
import path from "node:path";

const roots = ["src", "lib", "app", "scripts"];
const exts = new Set([".ts", ".tsx"]);
const files = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) {
      if (n.name === "node_modules" || n.name === ".git") continue;
      walk(p);
    } else if (exts.has(path.extname(n.name))) files.push(p);
  }
}
for (const r of roots) walk(path.join(process.cwd(), r));

const OWNERSHIP_ASSERTIONS = [
  "assertCrmTenantReadAllowed",
  "assertCrmTenantWriteAllowed",
  "assertPatientInTenant",
  "assertCaseInTenant",
  "checkFiTenantPortalApiAccess",
  "assertFiTenantPortalAccess",
];

const ownershipAnyRe = new RegExp(`\\b(?:${OWNERSHIP_ASSERTIONS.join("|")})\\s*\\(`);

const assignRe = /\b(?:const|let)\s+(\w+)\s*=\s*supabaseAdmin\s*\(\s*\)/g;
const altRe = /\b(?:const|let)\s+(\w+)\s*=\s*[^;]*supabaseAdmin\s*\(\s*\)\s*;/g;
const coalesceRe =
  /\b(?:const|let)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*[^;]*?\?\?\s*supabaseAdmin\s*\(\s*\)/g;

const globalTables = new Set([
  "fi_tenants",
  "fi_os_identities",
  "fi_staff_position_types",
  "fi_medication_os_canonical",
]);

/** @typedef {{file:string,line:number,fn:string,client:string,table:string,schema:string|null,rpc:string|null,chain:string,inline:boolean,kind:'from'|'rpc',fromPhysicalLine:number,segmentStart:number,segmentEnd:number}} Hit */

/** @type {Hit[]} */
const hits = [];

function collectAdminVars(text) {
  const adminVars = new Set();
  let m;
  assignRe.lastIndex = 0;
  while ((m = assignRe.exec(text)) !== null) adminVars.add(m[1]);
  altRe.lastIndex = 0;
  while ((m = altRe.exec(text)) !== null) adminVars.add(m[1]);
  coalesceRe.lastIndex = 0;
  while ((m = coalesceRe.exec(text)) !== null) adminVars.add(m[1]);
  return adminVars;
}

/**
 * Merge lines where the next non-empty line continues a method chain (starts with ".").
 * Flushes when a line does not start with "." or the buffer already ends with ";".
 */
function mergeDotChainSegments(lines) {
  /** @type {{text:string,startLine:number,endLine:number}[]} */
  const segs = [];
  let buf = "";
  let startLine = 1;
  let endLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const tl = raw.trim();
    const lineNo = i + 1;
    if (tl === "" || tl.startsWith("//")) continue;

    if (!buf) {
      buf = raw;
      startLine = endLine = lineNo;
      continue;
    }

    if (tl.startsWith(".") && !/;\s*$/.test(buf.trim())) {
      buf += " " + tl;
      endLine = lineNo;
    } else {
      segs.push({
        text: buf.replace(/\s+/g, " ").trim(),
        startLine,
        endLine,
      });
      buf = raw;
      startLine = endLine = lineNo;
    }
  }
  if (buf) segs.push({ text: buf.replace(/\s+/g, " ").trim(), startLine, endLine });
  return segs;
}

/**
 * Build query chain from the physical line of `.from(` / `.rpc(` forward until a line
 * contains `;` (end of statement). Captures multiline insert bodies and trailing `.eq`
 * without relying on dot-only merge.
 */
function chainFromPhysicalQueryLine(lines, startLine1) {
  const parts = [];
  const max = Math.min(lines.length, startLine1 + 55);
  for (let ln = startLine1; ln <= max; ln++) {
    const raw = lines[ln - 1];
    parts.push(raw.trim());
    if (raw.includes(";")) break;
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function fnAtLine(lines, line1) {
  const fnStack = [];
  const fnDecl = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/;
  const arrowMod = /^(?:export\s+)?(?:async\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/;
  const idx = line1 - 1;
  for (let j = 0; j <= idx && j < lines.length; j++) {
    const line = lines[j];
    if (fnDecl.test(line)) {
      const mm = line.match(fnDecl);
      if (mm) fnStack.push(mm[1]);
    } else if (arrowMod.test(line)) {
      const mm = line.match(arrowMod);
      if (mm) fnStack.push(mm[1]);
    } else if (/^\s*\}\s*$/.test(line) && fnStack.length) fnStack.pop();
  }
  return fnStack.length ? fnStack[fnStack.length - 1] : "(top-level or unscoped)";
}

/** 1-based physical line of `.from(` / `.rpc(` in original lines within [start,end] */
function physicalLineOfFrom(lines, startLine, endLine, tableOrRpc, kind) {
  const needle =
    kind === "rpc"
      ? new RegExp(`\\.\\s*rpc\\s*\\(\\s*["']${escapeRe(tableOrRpc)}["']`)
      : new RegExp(`\\.\\s*from\\s*\\(\\s*["']${escapeRe(tableOrRpc)}["']`);
  for (let ln = startLine; ln <= endLine && ln <= lines.length; ln++) {
    const line = lines[ln - 1];
    if (needle.test(line)) return ln;
  }
  return startLine;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tenantFilterInChain(chain) {
  return (
    /\.eq\s*\(\s*["']tenant_id["']/.test(chain) ||
    /\.eq\s*\(\s*["']tid["']/.test(chain) ||
    /\.in\s*\(\s*["']tenant_id["']/.test(chain) ||
    /\.filter\s*\(\s*["']tenant_id["']/.test(chain) ||
    /\btenant_id\s*:/.test(chain) ||
    /\btenantId\s*:/.test(chain) ||
    /\.contains\s*\(\s*\{[^}]*tenant_id/.test(chain)
  );
}

function insertContainsTenantId(chain) {
  const ins = /\.(?:insert|upsert)\s*\(/;
  const m = ins.exec(chain);
  if (!m) return false;
  const tail = chain.slice(m.index);
  return /\btenant_id\s*:/.test(tail) || /["']tenant_id["']\s*:/.test(tail);
}

function idOnlyPrimaryFilter(chain) {
  const hasTenant = tenantFilterInChain(chain) || insertContainsTenantId(chain);
  if (hasTenant) return false;
  const idEq = /\.eq\s*\(\s*["']id["']/.test(chain);
  const uuidEq = /\.eq\s*\(\s*["']uuid["']/.test(chain);
  const matchSingleId = /\.match\s*\(\s*\{[^}]*\bid\s*:/.test(chain);
  return idEq || uuidEq || matchSingleId;
}

function tenantScopedByPrimaryKey(chain, table) {
  const t = table.toLowerCase();
  if (t === "fi_tenants" && /\.eq\s*\(\s*["']id["']/.test(chain) && /tenantId/.test(chain)) return true;
  return false;
}

function priorOwnershipInText(before) {
  return ownershipAnyRe.test(before);
}

function isSystemSuperAdminPath(file) {
  return file.includes("fi-admin/system/");
}

function baseTableName(tableField) {
  const t = tableField.toLowerCase();
  if (t.startsWith("rpc:")) return t;
  const parts = t.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : t;
}

function scanSegments(rel, lines, segments, adminVars) {
  for (const seg of segments) {
    const text = seg.text;
    if (!text.includes(".from") && !text.includes(".rpc")) continue;

    const schemaFromRe =
      /\b(\w+)\s*\.\s*schema\s*\(\s*["']([^"']+)["']\s*\)\s*\.\s*from\s*\(\s*["']([^"']+)["']/g;
    let m;
    schemaFromRe.lastIndex = 0;
    while ((m = schemaFromRe.exec(text)) !== null) {
      const client = m[1];
      const schema = m[2];
      const table = m[3];
      if (!adminVars.has(client)) continue;
      const fromLine = physicalLineOfFrom(lines, seg.startLine, seg.endLine, table, "from");
      const chain = chainFromPhysicalQueryLine(lines, fromLine);
      hits.push({
        file: rel,
        line: fromLine,
        fn: fnAtLine(lines, fromLine),
        client,
        table: `${schema}.${table}`,
        schema,
        rpc: null,
        chain,
        inline: false,
        kind: "from",
        fromPhysicalLine: fromLine,
        segmentStart: seg.startLine,
        segmentEnd: seg.endLine,
      });
    }

    const plainFromRe = /\b(\w+)\s*\.\s*from\s*\(\s*["']([^"']+)["']/g;
    plainFromRe.lastIndex = 0;
    while ((m = plainFromRe.exec(text)) !== null) {
      const client = m[1];
      const table = m[2];
      if (!adminVars.has(client)) continue;
      const before = text.slice(0, m.index);
      if (/\.schema\s*\(\s*["'][^"']+["']\s*\)\s*$/i.test(before.trimEnd())) continue;
      const fromLine = physicalLineOfFrom(lines, seg.startLine, seg.endLine, table, "from");
      const chain = chainFromPhysicalQueryLine(lines, fromLine);
      hits.push({
        file: rel,
        line: fromLine,
        fn: fnAtLine(lines, fromLine),
        client,
        table,
        schema: null,
        rpc: null,
        chain,
        inline: false,
        kind: "from",
        fromPhysicalLine: fromLine,
        segmentStart: seg.startLine,
        segmentEnd: seg.endLine,
      });
    }

    const inlineSchemaFromRe =
      /supabaseAdmin\s*\(\s*\)\s*\.\s*schema\s*\(\s*["']([^"']+)["']\s*\)\s*\.\s*from\s*\(\s*["']([^"']+)["']/g;
    inlineSchemaFromRe.lastIndex = 0;
    while ((m = inlineSchemaFromRe.exec(text)) !== null) {
      const schema = m[1];
      const table = m[2];
      const fromLine = physicalLineOfFrom(lines, seg.startLine, seg.endLine, table, "from");
      const chain = chainFromPhysicalQueryLine(lines, fromLine);
      hits.push({
        file: rel,
        line: fromLine,
        fn: fnAtLine(lines, fromLine),
        client: "supabaseAdmin()",
        table: `${schema}.${table}`,
        schema,
        rpc: null,
        chain,
        inline: true,
        kind: "from",
        fromPhysicalLine: fromLine,
        segmentStart: seg.startLine,
        segmentEnd: seg.endLine,
      });
    }

    const inlineFromRe = /supabaseAdmin\s*\(\s*\)\s*\.\s*from\s*\(\s*["']([^"']+)["']/g;
    inlineFromRe.lastIndex = 0;
    while ((m = inlineFromRe.exec(text)) !== null) {
      const table = m[1];
      const fromLine = physicalLineOfFrom(lines, seg.startLine, seg.endLine, table, "from");
      const chain = chainFromPhysicalQueryLine(lines, fromLine);
      hits.push({
        file: rel,
        line: fromLine,
        fn: fnAtLine(lines, fromLine),
        client: "supabaseAdmin()",
        table,
        schema: null,
        rpc: null,
        chain,
        inline: true,
        kind: "from",
        fromPhysicalLine: fromLine,
        segmentStart: seg.startLine,
        segmentEnd: seg.endLine,
      });
    }

    const rpcRe = /\b(\w+)\s*\.\s*rpc\s*\(\s*["']([^"']+)["']/g;
    rpcRe.lastIndex = 0;
    while ((m = rpcRe.exec(text)) !== null) {
      const client = m[1];
      const rpc = m[2];
      if (!adminVars.has(client)) continue;
      const rpcLine = physicalLineOfFrom(lines, seg.startLine, seg.endLine, rpc, "rpc");
      const chain = chainFromPhysicalQueryLine(lines, rpcLine);
      hits.push({
        file: rel,
        line: rpcLine,
        fn: fnAtLine(lines, rpcLine),
        client,
        table: `rpc:${rpc}`,
        schema: null,
        rpc,
        chain,
        inline: false,
        kind: "rpc",
        fromPhysicalLine: rpcLine,
        segmentStart: seg.startLine,
        segmentEnd: seg.endLine,
      });
    }

    const inlineRpcRe = /supabaseAdmin\s*\(\s*\)\s*\.\s*rpc\s*\(\s*["']([^"']+)["']/g;
    inlineRpcRe.lastIndex = 0;
    while ((m = inlineRpcRe.exec(text)) !== null) {
      const rpc = m[1];
      const rpcLine = physicalLineOfFrom(lines, seg.startLine, seg.endLine, rpc, "rpc");
      const chain = chainFromPhysicalQueryLine(lines, rpcLine);
      hits.push({
        file: rel,
        line: rpcLine,
        fn: fnAtLine(lines, rpcLine),
        client: "supabaseAdmin()",
        table: `rpc:${rpc}`,
        schema: null,
        rpc,
        chain,
        inline: true,
        kind: "rpc",
        fromPhysicalLine: rpcLine,
        segmentStart: seg.startLine,
        segmentEnd: seg.endLine,
      });
    }
  }
}

for (const fp of files) {
  let text;
  try {
    text = fs.readFileSync(fp, "utf8");
  } catch {
    continue;
  }
  if (!text.includes("supabaseAdmin")) continue;
  const adminVars = collectAdminVars(text);
  if (!adminVars.size) continue;

  const rel = fp.replace(process.cwd() + path.sep, "").replace(/\\/g, "/");
  const lines = text.split(/\r?\n/);
  const segments = mergeDotChainSegments(lines);
  scanSegments(rel, lines, segments, adminVars);
}

hits.sort((a, b) => (a.file + String(a.line)).localeCompare(b.file + String(b.line)));

function dedupeHits() {
  const seen = new Set();
  const out = [];
  for (const h of hits) {
    const k = `${h.file}:${h.line}:${h.table}:${h.kind}:${h.client}:${h.chain.slice(0, 120)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h);
  }
  return out;
}

const uniqueHits = dedupeHits();

function classifyHit(h, chain, priorOwn, likelyFalsePositive) {
  const t = h.table.toLowerCase();
  const base = baseTableName(t);
  const tf = tenantFilterInChain(chain);
  const insTid = insertContainsTenantId(chain);
  const pk = tenantScopedByPrimaryKey(chain, base);
  const globalT = globalTables.has(base) || globalTables.has(t);
  const isRpc = h.kind === "rpc";
  const idOnly = idOnlyPrimaryFilter(chain);

  if (likelyFalsePositive) return "SAFE";

  if (globalT || tf || insTid || pk || priorOwn) {
    return "SAFE";
  }

  if (t.startsWith("auth.") || isRpc) return "REVIEW";

  if (/\.maybeSingle\s*\(\s*\)/.test(chain) && /\.eq\s*\(\s*["']id["']/.test(chain)) return "REVIEW";

  if (idOnly && !priorOwn) return "CRITICAL";

  if (idOnly && priorOwn) return "DANGEROUS";

  return "DANGEROUS";
}

function multilineTenantFlag(segStart, segEnd, fromLine, chain) {
  const tf = tenantFilterInChain(chain);
  if (!tf) return false;
  return segEnd > segStart || fromLine > segStart;
}

function likelyFalsePositiveHit(h, chain) {
  const t = h.table.toLowerCase();
  const base = baseTableName(t);
  const tf = tenantFilterInChain(chain);
  const globalT = globalTables.has(base) || globalTables.has(t);
  const systemPath = isSystemSuperAdminPath(h.file);
  if (globalT && tf) return true;
  if (systemPath && globalT) return true;
  if (h.file.includes("/api/cron/") && globalT) return true;
  if (tenantScopedByPrimaryKey(chain, base) && tf) return true;
  return false;
}

function priorOwnershipContext(lines, line1) {
  const start = Math.max(0, line1 - 120);
  const beforeLines = lines.slice(start, line1 - 1).join("\n");
  const same = lines[line1 - 1] ?? "";
  const fromIdx = same.search(/\.from\s*\(/);
  const rpcIdx = same.search(/\.rpc\s*\(/);
  let cut = -1;
  if (fromIdx >= 0 && rpcIdx >= 0) cut = Math.min(fromIdx, rpcIdx);
  else cut = Math.max(fromIdx, rpcIdx);
  const samePrefix = cut >= 0 ? same.slice(0, cut) : same;
  return `${beforeLines}\n${samePrefix}`;
}

function buildRow(h, fileLines) {
  const chain = h.chain;
  const priorOwn = priorOwnershipInText(priorOwnershipContext(fileLines, h.line));
  const tf = tenantFilterInChain(chain);
  const insTid = insertContainsTenantId(chain);
  const idOnly = idOnlyPrimaryFilter(chain);
  const lfp = likelyFalsePositiveHit(h, chain);
  const rating = classifyHit(h, chain, priorOwn, lfp);

  const ml = multilineTenantFlag(h.segmentStart, h.segmentEnd, h.fromPhysicalLine, chain);

  let recommendedAction =
    "Add tenant_id filter (or insert field), an ownership assert, or tenant-scoped PK pattern; prefer user JWT client where RLS suffices.";
  if (rating === "SAFE") recommendedAction = "Heuristics satisfied; still verify business rules and RPC SQL if applicable.";
  else if (rating === "REVIEW")
    recommendedAction = "Inspect RPC/auth SQL and arguments; add tenant filters or asserts if not enforced inside the function.";
  else if (rating === "CRITICAL")
    recommendedAction =
      "Service-role query filters by id/uuid only with no tenant signal and no prior ownership assert — fix before production.";
  else if (priorOwn)
    recommendedAction =
      "Ownership helper precedes query; confirm it covers this resource and prefer explicit .eq(tenant_id) on writes.";

  return {
    rating,
    file: h.file,
    function: h.fn,
    table: h.table,
    kind: h.kind,
    clientVar: h.inline ? "supabaseAdmin()" : h.client,
    tenant_filter_in_chain: tf ? "Y" : "N",
    multiline_tenant_filter_detected: ml && tf ? "Y" : "N",
    insert_contains_tenant_id: insTid ? "Y" : "N",
    prior_ownership_assertion_detected: priorOwn ? "Y" : "N",
    likely_false_positive: lfp ? "Y" : "N",
    recommended_action: recommendedAction,
    service_role_unnecessary:
      h.kind === "rpc"
        ? "RPC runs as definer; tenant safety depends on function body and parameters."
        : h.table.startsWith("auth.") || h.table.includes("auth.")
          ? "Often yes (admin API)"
          : globalTables.has(baseTableName(h.table))
            ? "Convenience; could use tenant-scoped user client for some reads"
            : "Typical server pattern; may be replaceable with RLS+user client for reads",
    rls_note: "Service role bypasses RLS; RLS only helps if query switched to user JWT client.",
    line: String(h.line),
    snippet: chain.replace(/"/g, "'").slice(0, 220),
    id_only_without_tenant_signal: idOnly ? "Y" : "N",
  };
}

const linesByFile = new Map();
for (const h of uniqueHits) {
  const ap = path.join(process.cwd(), h.file.replace(/\//g, path.sep));
  if (!linesByFile.has(ap)) {
    try {
      linesByFile.set(ap, fs.readFileSync(ap, "utf8").split(/\r?\n/));
    } catch {
      linesByFile.set(ap, []);
    }
  }
}

const rows = uniqueHits.map((h) => {
  const ap = path.join(process.cwd(), h.file.replace(/\//g, path.sep));
  return buildRow(h, linesByFile.get(ap) ?? []);
});

const summary = { SAFE: 0, REVIEW: 0, DANGEROUS: 0, CRITICAL: 0, inline_supabaseAdmin_from: 0 };
for (const r of rows) summary[r.rating]++;
for (const h of uniqueHits) if (h.inline) summary.inline_supabaseAdmin_from++;

const outJson = path.join(process.cwd(), "tools", "audit-supabase-admin-from.result.json");
fs.writeFileSync(outJson, JSON.stringify({ total: uniqueHits.length, summary, rows }, null, 2), "utf8");

const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
const header = [
  "rating",
  "file",
  "function",
  "table",
  "kind",
  "client",
  "tenant_filter_in_chain",
  "multiline_tenant_filter_detected",
  "insert_contains_tenant_id",
  "prior_ownership_assertion_detected",
  "likely_false_positive",
  "recommended_action",
  "id_only_without_tenant_signal",
  "service_role_note",
  "rls_note",
  "line",
  "snippet",
].join(",");
const csvLines = [
  header,
  ...rows.map((r) =>
    [
      r.rating,
      r.file,
      r.function,
      r.table,
      r.kind,
      r.clientVar,
      r.tenant_filter_in_chain,
      r.multiline_tenant_filter_detected,
      r.insert_contains_tenant_id,
      r.prior_ownership_assertion_detected,
      r.likely_false_positive,
      r.recommended_action,
      r.id_only_without_tenant_signal,
      r.service_role_unnecessary,
      r.rls_note,
      r.line,
      r.snippet,
    ]
      .map(esc)
      .join(",")
  ),
];
const outCsv = path.join(process.cwd(), "tools", "audit-supabase-admin-from.result.csv");
fs.writeFileSync(outCsv, csvLines.join("\n"), "utf8");

console.log(`Wrote ${outJson} and ${outCsv} (${uniqueHits.length} rows). Summary:`, summary);
