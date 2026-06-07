import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getClinicOsShellActiveNavId,
  resolveClinicOsShellNavItems,
  resolveClinicOsShellQuickActions,
} from "./clinicOsShellConfig";

/** Synthetic tenant id (Evolved or any tenant uses the same URL shape). */
const EVOLVED_LIKE_TENANT = "a0000000-0000-4000-8000-0000000000e1";
const base = `/fi-admin/${EVOLVED_LIKE_TENANT}`;

test("resolveClinicOsShellNavItems: core routes href under tenant base", () => {
  const items = resolveClinicOsShellNavItems(base, true);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  assert.equal(byId.dashboard?.href, base);
  assert.equal(byId.dashboard?.disabled, false);
  assert.equal(byId.bookings?.href, `${base}/bookings`);
  assert.equal(byId.calendar?.href, `${base}/calendar`);
  assert.equal(byId.patientos?.href, `${base}/patients`);
  assert.equal(byId.staff?.href, `${base}/staff`);
  assert.equal(byId.services?.href, `${base}/services`);
  assert.equal(byId.consultations?.href, `${base}/consultations`);
  assert.equal(byId.surgeryos?.href, `${base}/cases`);
  assert.equal(byId.auditos?.href, `${base}/audit`);
  assert.equal(byId.configuration?.href, `${base}/configuration`);
});

test("resolveClinicOsShellNavItems: LeadFlow (CRM) enabled when showCrmNav", () => {
  const items = resolveClinicOsShellNavItems(base, true);
  const leadflow = items.find((i) => i.id === "leadflow");
  assert.ok(leadflow);
  assert.equal(leadflow!.disabled, false);
  assert.equal(leadflow!.href, `${base}/crm`);
});

test("resolveClinicOsShellNavItems: LeadFlow disabled without showCrmNav", () => {
  const items = resolveClinicOsShellNavItems(base, false);
  const leadflow = items.find((i) => i.id === "leadflow");
  assert.ok(leadflow);
  assert.equal(leadflow!.disabled, true);
  assert.equal(leadflow!.href, "#");
});

test("resolveClinicOsShellNavItems: placeholders stay disabled", () => {
  const items = resolveClinicOsShellNavItems(base, true);
  for (const id of ["messages", "academyos", "analyticsos"]) {
    const row = items.find((i) => i.id === id);
    assert.ok(row, id);
    assert.equal(row!.disabled, true);
    assert.equal(row!.href, "#");
  }
});

test("getClinicOsShellActiveNavId: dashboard and deep CRM", () => {
  assert.equal(getClinicOsShellActiveNavId(base, base), "dashboard");
  assert.equal(getClinicOsShellActiveNavId(`${base}/`, base), "dashboard");
  assert.equal(getClinicOsShellActiveNavId(`${base}/crm`, base), "leadflow");
  assert.equal(getClinicOsShellActiveNavId(`${base}/crm/leads`, base), "leadflow");
  assert.equal(getClinicOsShellActiveNavId(`${base}/calendar`, base), "calendar");
  assert.equal(getClinicOsShellActiveNavId(`${base}/bookings/new`, base), "bookings");
  assert.equal(getClinicOsShellActiveNavId(`${base}/patients/p-1`, base), "patientos");
  assert.equal(getClinicOsShellActiveNavId(`${base}/services`, base), "services");
  assert.equal(getClinicOsShellActiveNavId(`${base}/configuration`, base), "configuration");
  assert.equal(getClinicOsShellActiveNavId(`${base}/appointments`, base), "calendar");
  assert.equal(getClinicOsShellActiveNavId(`${base}/appointments/ap-1`, base), "calendar");
  assert.equal(getClinicOsShellActiveNavId(`${base}/directory`, base), "patientos");
});

test("resolveClinicOsShellQuickActions: booking enabled when only bookings board access", () => {
  const mixed = resolveClinicOsShellQuickActions(base, false, true);
  const booking = mixed.find((a) => a.id === "booking");
  const lead = mixed.find((a) => a.id === "lead");
  assert.equal(booking?.disabled, false);
  assert.equal(booking?.href, `${base}/bookings/new`);
  assert.equal(lead?.disabled, true);
});

test("resolveClinicOsShellQuickActions: CRM-gated actions match nav policy", () => {
  const on = resolveClinicOsShellQuickActions(base, true);
  const off = resolveClinicOsShellQuickActions(base, false);

  const leadOn = on.find((a) => a.id === "lead");
  const leadOff = off.find((a) => a.id === "lead");
  assert.equal(leadOn?.href, `${base}/crm`);
  assert.equal(leadOn?.disabled, false);
  assert.equal(leadOff?.disabled, true);

  const patient = on.find((a) => a.id === "patient");
  assert.equal(patient?.href, `${base}/patients/new`);
  assert.equal(patient?.disabled, false);

  const surgeryCase = on.find((a) => a.id === "case");
  assert.equal(surgeryCase?.label, "New case");
  assert.equal(surgeryCase?.href, `${base}/cases/new`);
});
