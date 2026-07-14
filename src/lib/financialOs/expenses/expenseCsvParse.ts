/**
 * Generic bank/card CSV parser for expense import.
 * Header matching is case-insensitive; supports common AU bank export aliases.
 */

export type ExpenseCsvColumnKey =
  | "date"
  | "description"
  | "amount"
  | "debit"
  | "credit"
  | "balance"
  | "external_ref"
  | "merchant"
  | "currency";

export type ExpenseCsvParsedLine = {
  lineIndex: number;
  transactionDate: string | null;
  descriptionRaw: string | null;
  amountCents: number;
  currency: string;
  externalRef: string | null;
  merchantHint: string | null;
  warnings: string[];
  raw: Record<string, string>;
};

export type ExpenseCsvParseResult = {
  ok: boolean;
  headerRow: string[];
  lines: ExpenseCsvParsedLine[];
  errors: string[];
  mappedColumns: Partial<Record<ExpenseCsvColumnKey, string>>;
};

const HEADER_ALIASES: Record<ExpenseCsvColumnKey, readonly string[]> = {
  date: ["date", "transaction date", "txn date", "posted date", "value date", "processed date"],
  description: [
    "description",
    "narrative",
    "particulars",
    "details",
    "transaction description",
    "memo",
    "reference",
  ],
  amount: ["amount", "value", "transaction amount", "aud amount"],
  debit: ["debit", "withdrawal", "money out", "debit amount", "spend"],
  credit: ["credit", "deposit", "money in", "credit amount"],
  balance: ["balance", "running balance", "account balance"],
  external_ref: [
    "transaction id",
    "txn id",
    "id",
    "bank reference",
    "reference number",
    "receipt number",
    "external ref",
  ],
  merchant: ["merchant", "payee", "counterparty", "name"],
  currency: ["currency", "ccy", "curr"],
};

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Minimal RFC4180-ish CSV split (handles quoted commas and "" escapes). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function parseCsvRows(text: string): string[][] {
  const normalized = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0);
  return lines.map(splitCsvLine);
}

function mapHeaders(headers: string[]): Partial<Record<ExpenseCsvColumnKey, number>> {
  const map: Partial<Record<ExpenseCsvColumnKey, number>> = {};
  const normalized = headers.map(normalizeHeader);
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [
    ExpenseCsvColumnKey,
    readonly string[],
  ][]) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx >= 0) map[key] = idx;
  }
  return map;
}

/**
 * Parse amounts like "1,234.56", "-45.00", "$(12.00)", "12.00 CR", "12.00 DR".
 * Returns signed major units (negative = money out when amount column used that way).
 */
export function parseAmountToSignedMajor(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  let sign = 1;
  const upper = s.toUpperCase();
  if (/\bDR\b/.test(upper) || /\bDEBIT\b/.test(upper)) sign = -1;
  if (/\bCR\b/.test(upper) || /\bCREDIT\b/.test(upper)) sign = 1;

  s = s.replace(/[^\d.,\-()]/g, "");
  if (s.startsWith("(") && s.endsWith(")")) {
    sign = -1;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    sign = -1;
    s = s.slice(1);
  }

  // AU/UK often use 1,234.56; if both comma and dot, assume comma thousands.
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/,/g, "");
  } else if (s.includes(",") && !s.includes(".")) {
    // Could be European 1234,56 — treat last comma as decimal if 1–2 digits after.
    const parts = s.split(",");
    if (parts.length === 2 && parts[1]!.length <= 2) {
      s = `${parts[0]}.${parts[1]}`;
    } else {
      s = s.replace(/,/g, "");
    }
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return sign * n;
}

export function majorToCents(major: number): number {
  return Math.round(Math.abs(major) * 100);
}

/** Accept YYYY-MM-DD, DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY. Prefer AU day-first for slashes. */
export function parseFlexibleDateToYmd(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Parse bank/card CSV into expense-oriented lines.
 * Expense amount is always stored as non-negative outflow cents.
 * Credit-only / money-in rows are skipped with a warning (Phase 1 opex focus).
 */
export function parseExpenseBankCsv(
  text: string,
  options?: { defaultCurrency?: string; maxRows?: number }
): ExpenseCsvParseResult {
  const defaultCurrency = (options?.defaultCurrency ?? "AUD").toUpperCase();
  const maxRows = options?.maxRows ?? 5000;
  const errors: string[] = [];
  const rows = parseCsvRows(text);

  if (rows.length === 0) {
    return {
      ok: false,
      headerRow: [],
      lines: [],
      errors: ["CSV is empty."],
      mappedColumns: {},
    };
  }

  const headerRow = rows[0] ?? [];
  const colMap = mapHeaders(headerRow);
  const mappedColumns: Partial<Record<ExpenseCsvColumnKey, string>> = {};
  for (const [k, idx] of Object.entries(colMap) as [ExpenseCsvColumnKey, number][]) {
    mappedColumns[k] = headerRow[idx] ?? String(idx);
  }

  if (colMap.date == null) {
    errors.push("Could not find a date column (e.g. Date, Transaction Date).");
  }
  if (colMap.amount == null && colMap.debit == null) {
    errors.push("Could not find an amount or debit column.");
  }

  if (errors.length > 0) {
    return { ok: false, headerRow, lines: [], errors, mappedColumns };
  }

  const lines: ExpenseCsvParsedLine[] = [];
  const body = rows.slice(1, 1 + maxRows);

  for (let i = 0; i < body.length; i++) {
    const cells = body[i] ?? [];
    const raw: Record<string, string> = {};
    headerRow.forEach((h, idx) => {
      raw[h] = cells[idx] ?? "";
    });

    const warnings: string[] = [];
    const get = (key: ExpenseCsvColumnKey) => {
      const idx = colMap[key];
      if (idx == null) return "";
      return (cells[idx] ?? "").trim();
    };

    const dateRaw = get("date");
    const transactionDate = parseFlexibleDateToYmd(dateRaw);
    if (dateRaw && !transactionDate) {
      warnings.push(`Unparseable date: ${dateRaw}`);
    }

    const descriptionRaw = get("description") || get("merchant") || null;
    const merchantHint = get("merchant") || null;
    const externalRef = get("external_ref") || null;
    const currencyRaw = get("currency");
    const currency = currencyRaw ? currencyRaw.toUpperCase().slice(0, 8) : defaultCurrency;

    let signedMajor: number | null = null;
    if (colMap.amount != null) {
      signedMajor = parseAmountToSignedMajor(get("amount"));
    } else {
      const debit = parseAmountToSignedMajor(get("debit"));
      const credit = parseAmountToSignedMajor(get("credit"));
      if (debit != null && debit !== 0) {
        signedMajor = -Math.abs(debit);
      } else if (credit != null && credit !== 0) {
        signedMajor = Math.abs(credit);
      } else {
        signedMajor = 0;
      }
    }

    if (signedMajor == null) {
      warnings.push("Unparseable amount; skipped.");
      continue;
    }

    // Phase 1: opex only — skip pure money-in rows (positive credit when using amount column).
    if (signedMajor > 0 && colMap.amount != null) {
      // Some banks export expenses as positive with a type column; treat positive amount as expense.
      // If a credit column exists separately we already handled above.
    }

    // Prefer debit/outflow interpretation:
    // - negative amount → expense
    // - positive amount with only "amount" column → treat as expense (common card exports)
    // - positive amount that is clearly a credit (from credit col only) → skip
    let amountCents = 0;
    let skip = false;

    if (colMap.debit != null || colMap.credit != null) {
      if (signedMajor >= 0 && colMap.amount == null) {
        // credit-only row
        skip = true;
        warnings.push("Skipped credit/money-in row.");
      } else {
        amountCents = majorToCents(signedMajor);
      }
    } else {
      // Single amount column: absolute value is the expense amount.
      amountCents = majorToCents(signedMajor);
      if (signedMajor === 0) {
        warnings.push("Zero amount.");
      }
    }

    if (skip) continue;

    lines.push({
      lineIndex: i,
      transactionDate,
      descriptionRaw: descriptionRaw || null,
      amountCents,
      currency,
      externalRef: externalRef || null,
      merchantHint: merchantHint || descriptionRaw || null,
      warnings,
      raw,
    });
  }

  if (lines.length === 0) {
    errors.push("No expense lines could be parsed from the CSV body.");
  }

  return {
    ok: errors.length === 0 && lines.length > 0,
    headerRow,
    lines,
    errors,
    mappedColumns,
  };
}
