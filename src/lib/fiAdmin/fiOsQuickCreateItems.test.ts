import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveFiOsQuickCreateItems } from "./fiOsQuickCreateItems";

const TID = "b0000000-0000-4000-8000-0000000000b2";
const base = `/fi-admin/${TID}`;

test("resolveFiOsQuickCreateItems: consultation always navigable", () => {
  const items = resolveFiOsQuickCreateItems(base, false, false);
  const c = items.find((i) => i.id === "consultation");
  assert.ok(c?.enabled);
  assert.equal(c?.href, `${base}/consultations/new`);
});

test("resolveFiOsQuickCreateItems: patient gated by bookings board", () => {
  const off = resolveFiOsQuickCreateItems(base, true, false);
  const on = resolveFiOsQuickCreateItems(base, true, true);
  assert.equal(off.find((i) => i.id === "patient")?.enabled, false);
  assert.equal(on.find((i) => i.id === "patient")?.enabled, true);
});

test("resolveFiOsQuickCreateItems: lead uses CRM anchor hash", () => {
  const items = resolveFiOsQuickCreateItems(base, true, false);
  const lead = items.find((i) => i.id === "lead");
  assert.equal(lead?.href, `${base}/crm#fi-os-crm-create-lead`);
});
