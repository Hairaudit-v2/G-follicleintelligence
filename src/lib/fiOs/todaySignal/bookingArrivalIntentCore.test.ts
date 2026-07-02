import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOOKING_ARRIVAL_TOKEN_TTL_MS,
  bookingHasPendingArrivalIntent,
  signBookingArrivalToken,
  verifyBookingArrivalToken,
  withArrivalIntentMetadata,
  withoutArrivalIntentMetadata,
} from "@/src/lib/fiOs/todaySignal/bookingArrivalIntentCore";

const SECRET = "test-arrival-secret";
const TENANT = "11111111-1111-1111-1111-111111111111";
const BOOKING = "22222222-2222-2222-2222-222222222222";

describe("bookingArrivalIntentCore", () => {
  it("signs and verifies appointment-scoped tokens with expiry", () => {
    const now = Date.now();
    const token = signBookingArrivalToken(
      { tenantId: TENANT, bookingId: BOOKING, exp: now + BOOKING_ARRIVAL_TOKEN_TTL_MS },
      SECRET
    );
    const payload = verifyBookingArrivalToken(token, SECRET, now);
    assert.deepEqual(payload, {
      tenantId: TENANT,
      bookingId: BOOKING,
      exp: now + BOOKING_ARRIVAL_TOKEN_TTL_MS,
    });
  });

  it("rejects expired tokens", () => {
    const token = signBookingArrivalToken(
      { tenantId: TENANT, bookingId: BOOKING, exp: Date.now() - 1000 },
      SECRET
    );
    assert.equal(verifyBookingArrivalToken(token, SECRET), null);
  });

  it("tracks pending arrival intent on expected bookings only", () => {
    const meta = withArrivalIntentMetadata({}, new Date().toISOString(), "qr");
    assert.equal(
      bookingHasPendingArrivalIntent({ booking_status: "confirmed", metadata: meta }),
      true
    );
    assert.equal(
      bookingHasPendingArrivalIntent({ booking_status: "arrived", metadata: meta }),
      false
    );
    assert.equal(
      bookingHasPendingArrivalIntent({
        booking_status: "confirmed",
        metadata: withoutArrivalIntentMetadata(meta),
      }),
      false
    );
  });
});
