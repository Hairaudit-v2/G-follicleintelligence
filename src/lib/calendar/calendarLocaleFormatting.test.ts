import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromDatetimeLocalValueInTimezone } from "@/src/lib/calendar/calendarTimezone";
import {
  formatClinicDate,
  formatClinicDateTimeRange,
  formatClinicLongDate,
  formatClinicTime,
  resolveClinicLocale,
} from "@/src/lib/calendar/calendarLocaleFormatting";

describe("calendarLocaleFormatting — resolveClinicLocale", () => {
  it("defaults Australia/Perth calendar to en-AU (Evolved Perth)", () => {
    assert.equal(
      resolveClinicLocale({
        clinicMetadata: null,
        tenantMetadata: null,
        calendarTimezone: "Australia/Perth",
      }),
      "en-AU"
    );
  });

  it("prefers explicit clinic metadata locale", () => {
    assert.equal(
      resolveClinicLocale({
        clinicMetadata: { locale: "en-US" },
        tenantMetadata: { locale: "en-IN" },
        calendarTimezone: "Australia/Perth",
      }),
      "en-US"
    );
  });

  it("maps AU country metadata to en-AU", () => {
    assert.equal(
      resolveClinicLocale({
        clinicMetadata: { country_region: "AU" },
        tenantMetadata: null,
        calendarTimezone: "UTC",
      }),
      "en-AU"
    );
  });
});

describe("calendarLocaleFormatting — formatClinicDate", () => {
  it("en-AU formats 2026-06-10 as 10/06/2026", () => {
    assert.equal(formatClinicDate("2026-06-10", "en-AU"), "10/06/2026");
  });

  it("en-US formats 2026-06-10 as 06/10/2026", () => {
    assert.equal(formatClinicDate("2026-06-10", "en-US"), "06/10/2026");
  });

  it("en-IN formats 2026-06-10 as 10/06/2026", () => {
    assert.equal(formatClinicDate("2026-06-10", "en-IN"), "10/06/2026");
  });
});

describe("calendarLocaleFormatting — formatClinicLongDate", () => {
  it("en-AU long date includes Wednesday, 10 June 2026", () => {
    assert.equal(formatClinicLongDate("2026-06-10", "en-AU"), "Wednesday, 10 June 2026");
  });
});

describe("calendarLocaleFormatting — formatClinicTime / range (Perth)", () => {
  const tz = "Australia/Perth";

  it("formats 4:00 pm style for wall local in en-AU", () => {
    const s = formatClinicTime("2026-06-10T16:00", "en-AU", tz);
    assert.match(s, /4:00\s*p\.?m\.?/i);
  });

  it("time range formats correctly for Perth", () => {
    const r = formatClinicDateTimeRange("2026-06-10T16:00", "2026-06-10T16:45", "en-AU", tz);
    assert.match(r, /4:00\s*p\.?m\.?/i);
    assert.match(r, /4:45\s*p\.?m\.?/i);
    assert.ok(r.includes("–") || r.includes("-"));
  });
});

describe("calendarLocaleFormatting — save path unchanged (ISO)", () => {
  it("wall local → UTC ISO for booking payload is unchanged by display helpers", () => {
    const iso = fromDatetimeLocalValueInTimezone("2026-06-10T16:00", "Australia/Perth");
    assert.equal(iso, "2026-06-10T08:00:00.000Z");
    void formatClinicTime("2026-06-10T16:00", "en-AU", "Australia/Perth");
    assert.equal(fromDatetimeLocalValueInTimezone("2026-06-10T16:00", "Australia/Perth"), iso);
  });
});
