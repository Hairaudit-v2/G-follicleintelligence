import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CalendarQuickTemplate } from "@/src/lib/calendar/calendarQuickCreateTemplates";
import { toDatetimeLocalValueInTimezone } from "@/src/lib/calendar/calendarTimezone";
import {
  addMinutesToLocalTime,
  buildQuickBookTimeSummary,
  deriveQuickBookEndLocal,
  normalizeQuickBookDatetimeLocal,
} from "@/src/lib/calendar/quickBookTime";

describe("quickBookTime — addMinutesToLocalTime", () => {
  it("16:00 + 45 = 16:45", () => {
    assert.equal(addMinutesToLocalTime("2026-06-10T16:00", 45), "2026-06-10T16:45");
    assert.equal(addMinutesToLocalTime("2026-06-10T16:00:00", 45), "2026-06-10T16:45");
  });

  it("09:30 + 30 = 10:00", () => {
    assert.equal(addMinutesToLocalTime("2026-06-10T09:30", 30), "2026-06-10T10:00");
  });
});

describe("quickBookTime — deriveQuickBookEndLocal (Brisbane, no DST)", () => {
  const tz = "Australia/Brisbane";

  it("16:00 + 45 = 16:45", () => {
    assert.equal(
      deriveQuickBookEndLocal({ startLocal: "2026-06-10T16:00:00", durationMinutes: 45, timeZone: tz }),
      "2026-06-10T16:45"
    );
  });

  it("start change 16:00 → 16:15 with 45 mins updates end 17:00", () => {
    assert.equal(
      deriveQuickBookEndLocal({ startLocal: "2026-06-10T16:15", durationMinutes: 45, timeZone: tz }),
      "2026-06-10T17:00"
    );
  });

  it("service change 30 → 45 updates end time (same start)", () => {
    const start = "2026-06-10T16:00";
    assert.equal(deriveQuickBookEndLocal({ startLocal: start, durationMinutes: 30, timeZone: tz }), "2026-06-10T16:30");
    assert.equal(deriveQuickBookEndLocal({ startLocal: start, durationMinutes: 45, timeZone: tz }), "2026-06-10T16:45");
  });

  it("month view default 09:00 + selected consult duration works", () => {
    assert.equal(
      deriveQuickBookEndLocal({ startLocal: "2026-06-10T09:00", durationMinutes: 45, timeZone: tz }),
      "2026-06-10T09:45"
    );
  });
});

describe("quickBookTime — next available slot start/end", () => {
  const tz = "Australia/Brisbane";

  it("maps slot UTC to local start and derives end when only start + duration known", () => {
    const startAt = "2026-06-10T06:00:00.000Z";
    const startLocal = toDatetimeLocalValueInTimezone(startAt, tz);
    assert.equal(startLocal, "2026-06-10T16:00");
    assert.equal(
      deriveQuickBookEndLocal({ startLocal, durationMinutes: 45, timeZone: tz }),
      "2026-06-10T16:45"
    );
  });

  it("uses slot endAt wall time when API returns a concrete end", () => {
    const endAt = "2026-06-10T06:50:00.000Z";
    assert.equal(toDatetimeLocalValueInTimezone(endAt, tz), "2026-06-10T16:50");
  });
});

describe("quickBookTime — normalizeQuickBookDatetimeLocal", () => {
  it("strips seconds for datetime-local compatibility", () => {
    assert.equal(normalizeQuickBookDatetimeLocal("2026-06-10T16:00:00"), "2026-06-10T16:00");
  });
});

describe("quickBookTime — buildQuickBookTimeSummary", () => {
  it("formats label duration and range (24h fallback without locale)", () => {
    assert.equal(
      buildQuickBookTimeSummary({
        label: "Consultation",
        startLocal: "2026-06-10T16:00",
        endLocal: "2026-06-10T16:45",
        durationMinutes: 45,
      }),
      "Consultation · 45 min · 16:00–16:45"
    );
  });

  it("uses locale time range when locale and timeZone set", () => {
    const s = buildQuickBookTimeSummary({
      label: "Consultation",
      startLocal: "2026-06-10T16:00",
      endLocal: "2026-06-10T16:45",
      durationMinutes: 45,
      locale: "en-AU",
      timeZone: "Australia/Perth",
    });
    assert.ok(s.startsWith("Consultation · 45 min ·"));
    assert.match(s, /4:00\s*p\.?m\.?/i);
    assert.match(s, /4:45\s*p\.?m\.?/i);
  });

  it("no service message", () => {
    assert.equal(
      buildQuickBookTimeSummary({
        label: null,
        startLocal: "2026-06-10T16:00",
        endLocal: "2026-06-10T16:45",
        durationMinutes: null,
      }),
      "Select an appointment type to calculate finish time."
    );
  });
});

describe("quickBookTime — template duration switch (catalog-shaped)", () => {
  const tz = "Australia/Brisbane";

  it("recomputes end when template duration changes", () => {
    const t30: CalendarQuickTemplate = {
      id: "follow_up",
      label: "Follow Up",
      bookingType: "follow_up",
      durationMinutes: 30,
      title: "Follow Up",
    };
    const t45: CalendarQuickTemplate = {
      id: "consultation",
      label: "Consultation",
      bookingType: "consultation",
      durationMinutes: 45,
      title: "Consultation",
    };
    const start = "2026-06-10T16:00";
    assert.equal(deriveQuickBookEndLocal({ startLocal: start, durationMinutes: t30.durationMinutes, timeZone: tz }), "2026-06-10T16:30");
    assert.equal(deriveQuickBookEndLocal({ startLocal: start, durationMinutes: t45.durationMinutes, timeZone: tz }), "2026-06-10T16:45");
  });
});
