import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPrivacySafeNotificationPreview,
  buildPrivacySafeNotificationTitle,
  decideNotificationDispatch,
  DEFAULT_PATIENT_GATEWAY_NOTIFICATION_PREFERENCES,
  notificationAndroidChannelId,
} from "./patientGatewayNotificationCore";
import { sendPatientNotification } from "./patientNotificationDispatch.server";

describe("patientNotificationDispatch", () => {
  it("N/O. new_message push uses privacy-safe title/body", () => {
    assert.equal(buildPrivacySafeNotificationTitle("new_message"), "Follicle Intelligence");
    assert.equal(
      buildPrivacySafeNotificationPreview("new_message"),
      "New message from your clinic."
    );
    assert.ok(
      !/finasteride|diagnosis|blood|\$|invoice amount|surgery/i.test(
        buildPrivacySafeNotificationPreview("new_message")
      )
    );
  });

  it("P/Q/R. other event previews stay non-clinical", () => {
    for (const event of [
      "appointment_upcoming",
      "images_due",
      "payment_received",
    ] as const) {
      const preview = buildPrivacySafeNotificationPreview(event);
      assert.ok(!/finasteride|blood|prescription|diagnosis|\$[0-9]/i.test(preview));
    }
    assert.equal(
      buildPrivacySafeNotificationPreview("appointment_upcoming"),
      "Your appointment is coming up."
    );
    assert.equal(
      buildPrivacySafeNotificationPreview("images_due"),
      "It's time to update your progress photos."
    );
    assert.equal(
      buildPrivacySafeNotificationPreview("payment_received"),
      "Your account has been updated."
    );
  });

  it("K/L. push channel requires preference; optional opt-out skips", () => {
    const enabled = decideNotificationDispatch({
      event: "new_message",
      preferences: {
        ...DEFAULT_PATIENT_GATEWAY_NOTIFICATION_PREFERENCES,
        push: true,
        messageNotifications: true,
      },
    });
    assert.ok(enabled.channels.includes("push"));

    const disabled = decideNotificationDispatch({
      event: "new_message",
      preferences: {
        ...DEFAULT_PATIENT_GATEWAY_NOTIFICATION_PREFERENCES,
        push: false,
        messageNotifications: true,
      },
    });
    assert.equal(disabled.channels.includes("push"), false);
  });

  it("maps android channels without alarmist taxonomy", () => {
    assert.equal(notificationAndroidChannelId("new_message"), "messages");
    assert.equal(notificationAndroidChannelId("appointment_upcoming"), "appointments");
    assert.equal(notificationAndroidChannelId("images_due"), "reminders");
    assert.equal(notificationAndroidChannelId("payment_received"), "general");
  });

  it("Y/Z/AA. invalid token disables device; dedupe prevents duplicate send", async () => {
    const disabled: string[] = [];
    const sends: string[] = [];
    const rows = new Map<string, { status: string }>();

    const supabase = {
      from(table: string) {
        if (table === "fi_patient_notification_dispatch_log") {
          return {
            insert(payload: { dedupe_key: string }) {
              if (rows.has(payload.dedupe_key)) {
                return Promise.resolve({
                  error: { message: "duplicate", code: "23505" },
                });
              }
              rows.set(payload.dedupe_key, { status: "skipped" });
              return Promise.resolve({ error: null });
            },
            update(payload: { status: string }) {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        eq() {
                          return {
                            eq(key: string, value: string) {
                              if (key === "dedupe_key") {
                                const row = rows.get(value);
                                if (row) row.status = payload.status;
                              }
                              return Promise.resolve({ error: null });
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }
        if (table === "fi_patients") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        maybeSingle: async () => ({
                          data: {
                            id: "p1",
                            tenant_id: "t1",
                            metadata: {
                              patient_gateway_notification_preferences: {
                                ...DEFAULT_PATIENT_GATEWAY_NOTIFICATION_PREFERENCES,
                                push: true,
                              },
                            },
                            reminder_consent: true,
                            preferred_contact_method: "email",
                          },
                          error: null,
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        }
        if (table === "fi_patient_notification_devices") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        is: async () => ({
                          data: [
                            {
                              id: "d1",
                              tenant_id: "t1",
                              patient_id: "p1",
                              platform: "android",
                              provider: "expo",
                              provider_token: "ExponentPushToken[dead]",
                              token_fingerprint: "a".repeat(64),
                              device_label: null,
                              app_version: "1.0.0",
                              environment: "production",
                              created_at: "2026-01-01T00:00:00.000Z",
                              last_seen_at: "2026-01-01T00:00:00.000Z",
                              disabled_at: null,
                            },
                          ],
                          error: null,
                        }),
                      };
                    },
                  };
                },
              };
            },
            update() {
              return {
                eq(idKey: string, id: string) {
                  disabled.push(id);
                  return {
                    is: async () => {
                      void idKey;
                      return { error: null };
                    },
                  };
                },
              };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };

    const first = await sendPatientNotification(
      {
        patientId: "p1",
        tenantId: "t1",
        eventType: "new_message",
        sourceEntity: "msg-1",
        resourceId: "thread-1",
      },
      {
        // @ts-expect-error test double
        supabase,
        writeAudit: false,
        sendPush: async () => {
          sends.push("1");
          return { ok: false, kind: "invalid_token", message: "DeviceNotRegistered" };
        },
      }
    );
    assert.equal(first.sent, 0);
    assert.equal(first.skippedReason, "all_tokens_invalid");
    assert.ok(disabled.includes("d1"));

    const second = await sendPatientNotification(
      {
        patientId: "p1",
        tenantId: "t1",
        eventType: "new_message",
        sourceEntity: "msg-1",
        resourceId: "thread-1",
      },
      {
        // @ts-expect-error test double
        supabase,
        writeAudit: false,
        sendPush: async () => {
          sends.push("2");
          return { ok: true, ticketId: "t" };
        },
      }
    );
    assert.equal(second.skippedReason, "dedupe");
    assert.equal(sends.includes("2"), false);
  });
});
