import assert from "node:assert/strict";
import { test } from "node:test";

import type { FiServiceApprovedImportRow } from "./buildApprovedFiSeed";
import {
  EXCEL_BOOKING_TYPE_ALIASES,
  parseExcelCatalogueRow,
  resolveDuplicateBookingTypesInCatalogue,
  type StagedCatalogueRow,
} from "./excelCatalogueToApprovedSeed";

function staged(
  excel_row_number: number,
  bookable: boolean,
  row: FiServiceApprovedImportRow
): StagedCatalogueRow {
  return { excel_row_number, bookable, row };
}

test("EXCEL_BOOKING_TYPE_ALIASES maps facial_prp and led", () => {
  assert.equal(EXCEL_BOOKING_TYPE_ALIASES.facial_prp, "prp");
  assert.equal(EXCEL_BOOKING_TYPE_ALIASES.led, "other");
});

test("parseExcelCatalogueRow rejects missing duration", () => {
  const r = parseExcelCatalogueRow(5, {
    "Import?": "Yes",
    "Service Name": "X",
    "FI Category": "Other",
    "Booking Type": "",
    "Suggested Duration (mins)": "",
    "Base Price AUD": 0,
    Colour: "#fff",
    "Active?": "Yes",
    "Bookable?": "Yes",
  });
  assert.equal(r.kind, "rejected");
  if (r.kind === "rejected") {
    assert.ok(r.rejected.reasons.some((x) => x === "missing_or_invalid_duration_minutes"));
  }
});

test("parseExcelCatalogueRow maps facial_prp to prp", () => {
  const r = parseExcelCatalogueRow(2, {
    "Import?": "Yes",
    "Service Name": "Facial PRP",
    "FI Category": "Treatment",
    "Booking Type": "facial_prp",
    "Suggested Duration (mins)": 60,
    "Base Price AUD": 1,
    Colour: "#dc2626",
    "Active?": "Yes",
    "Bookable?": "Yes",
  });
  assert.equal(r.kind, "parsed");
  if (r.kind === "parsed") {
    assert.equal(r.staged.row.booking_type, "prp");
    assert.ok(r.staged.row.curation_notes?.includes("facial_prp"));
  }
});

test("resolveDuplicateBookingTypesInCatalogue prefers bookable earlier row", () => {
  const a = staged(10, true, {
    name: "A",
    category: "Treatment",
    booking_type: "prp",
    duration_minutes: 45,
    base_price: 1,
    color: "#fff",
    is_active: true,
    review_flags: [],
  });
  const b = staged(11, false, {
    name: "B",
    category: "Treatment",
    booking_type: "prp",
    duration_minutes: 45,
    base_price: 2,
    color: "#fff",
    is_active: true,
    review_flags: [],
  });
  const { rows, warnings } = resolveDuplicateBookingTypesInCatalogue([b, a]);
  assert.ok(warnings.length > 0);
  const ra = rows.find((x) => x.name === "A")!;
  const rb = rows.find((x) => x.name === "B")!;
  assert.equal(ra.booking_type, "prp");
  assert.equal(rb.booking_type, null);
  assert.ok(rb.review_flags.includes("duplicate_booking_type_cleared"));
});

test("parseExcelCatalogueRow not_yes for Review", () => {
  const r = parseExcelCatalogueRow(99, {
    "Import?": "Review",
    "Service Name": "Retail Product Sale",
    "FI Category": "Other",
    "Booking Type": "",
    "Suggested Duration (mins)": 0,
    "Base Price AUD": "",
    Colour: "#64748B",
    "Active?": "No",
    "Bookable?": "No",
    "Internal Notes": "Do not import into fi_services unless retail stock is handled in FI.",
  });
  assert.equal(r.kind, "not_yes");
});
