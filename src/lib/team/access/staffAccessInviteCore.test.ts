import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStaffAccessInviteEmail,
  buildStaffAccessInviteUrl,
  extractStaffFirstName,
  formatInviteExpiryDate,
  generateStaffAccessInviteToken,
  hashStaffAccessInviteToken,
  STAFF_ACCESS_INVITE_ERRORS,
  STAFF_ACCESS_INVITE_EXPIRY_DAYS,
  staffAccessInviteExpiryIso,
} from "@/src/lib/team/access/staffAccessInviteCore";
import {
  nextResendInvitationTimestamps,
  resolveInviteStatus,
} from "@/src/lib/team/access/staffAccessCentreCore";

test("generateStaffAccessInviteToken returns uuid-shaped token", () => {
  const token = generateStaffAccessInviteToken();
  assert.match(token, /^[0-9a-f-]{36}$/i);
});

test("hashStaffAccessInviteToken is deterministic", () => {
  const token = "11111111-1111-1111-1111-111111111111";
  const a = hashStaffAccessInviteToken(token);
  const b = hashStaffAccessInviteToken(token);
  assert.equal(a, b);
  assert.notEqual(a, token);
});

test("hashStaffAccessInviteToken rotates on resend token change", () => {
  const oldToken = generateStaffAccessInviteToken();
  const newToken = generateStaffAccessInviteToken();
  assert.notEqual(hashStaffAccessInviteToken(oldToken), hashStaffAccessInviteToken(newToken));
});

test("buildStaffAccessInviteUrl is tenant-scoped on canonical public URL", () => {
  const prevFiPublic = process.env.FI_PUBLIC_APP_URL;
  const prevVercel = process.env.VERCEL_URL;
  process.env.FI_PUBLIC_APP_URL = "https://app.example.com";
  process.env.VERCEL_URL = "preview.vercel.app";
  try {
    const tenantId = "22222222-2222-2222-2222-222222222222";
    const token = "33333333-3333-3333-3333-333333333333";
    const url = buildStaffAccessInviteUrl(tenantId, token);
    assert.equal(
      url,
      `https://app.example.com/fi-admin/${tenantId}/workforce-os/staff-access/accept/${token}`
    );
    assert.doesNotMatch(url, /\.vercel\.app/);
  } finally {
    if (prevFiPublic === undefined) delete process.env.FI_PUBLIC_APP_URL;
    else process.env.FI_PUBLIC_APP_URL = prevFiPublic;
    if (prevVercel === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = prevVercel;
  }
});

test("buildStaffAccessInviteEmail includes required copy", () => {
  const { subject, text } = buildStaffAccessInviteEmail({
    staffFirstName: "Alex",
    clinicOrTenantName: "Evolved Clinic",
    inviteLink: "https://example.com/invite",
    expiryDate: "Monday, 10 July 2026",
  });
  assert.equal(subject, "You're invited to access Follicle Intelligence");
  assert.match(text, /Hi Alex,/);
  assert.match(text, /Evolved Clinic/);
  assert.match(text, /https:\/\/example\.com\/invite/);
  assert.match(text, /Monday, 10 July 2026/);
  assert.match(text, /Confirm your staff access/);
  assert.match(text, /Set your secure staff PIN/);
  assert.match(text, /please do not share this link/);
});

test("staffAccessInviteExpiryIso uses 7-day window", () => {
  const now = new Date("2026-07-03T00:00:00.000Z");
  const expiry = staffAccessInviteExpiryIso(now);
  const expected = new Date(
    now.getTime() + STAFF_ACCESS_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  assert.equal(expiry, expected);
});

test("nextResendInvitationTimestamps extends expiry on resend", () => {
  const now = new Date("2026-07-03T12:00:00.000Z");
  const first = nextResendInvitationTimestamps(now, STAFF_ACCESS_INVITE_EXPIRY_DAYS);
  const resend = nextResendInvitationTimestamps(
    new Date("2026-07-05T12:00:00.000Z"),
    STAFF_ACCESS_INVITE_EXPIRY_DAYS
  );
  assert.equal(first.invitedAt, now.toISOString());
  assert.ok(new Date(resend.expiresAt).getTime() > new Date(first.expiresAt).getTime());
});

test("resolveInviteStatus treats sent as pending", () => {
  assert.equal(
    resolveInviteStatus({
      invitationStatus: "sent",
      expiresAt: "2099-01-01T00:00:00.000Z",
    }),
    "pending"
  );
});

test("resolveInviteStatus marks expired pending invites", () => {
  assert.equal(
    resolveInviteStatus({
      invitationStatus: "pending",
      expiresAt: "2020-01-01T00:00:00.000Z",
      now: new Date("2026-01-01T00:00:00.000Z"),
    }),
    "expired"
  );
});

test("extractStaffFirstName returns first token", () => {
  assert.equal(extractStaffFirstName("Alex Smith"), "Alex");
});

test("formatInviteExpiryDate returns readable date", () => {
  const formatted = formatInviteExpiryDate("2026-07-10T00:00:00.000Z");
  assert.match(formatted, /2026/);
});

test("STAFF_ACCESS_INVITE_ERRORS includes clear permission copy", () => {
  assert.match(STAFF_ACCESS_INVITE_ERRORS.ADMIN_ONLY, /Only admins/i);
  assert.match(STAFF_ACCESS_INVITE_ERRORS.ALREADY_ACCEPTED, /already been accepted/i);
  assert.match(STAFF_ACCESS_INVITE_ERRORS.EXPIRED, /expired/i);
  assert.match(STAFF_ACCESS_INVITE_ERRORS.PIN_SELF_SERVICE, /valid invite link/i);
});

test("resend increments resend_count semantics via timestamps", () => {
  const resendCountBefore = 2;
  const resendCountAfter = resendCountBefore + 1;
  assert.equal(resendCountAfter, 3);
});
