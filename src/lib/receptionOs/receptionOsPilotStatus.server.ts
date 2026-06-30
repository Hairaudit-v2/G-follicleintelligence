import "server-only";

import {
  isReceptionOsCommunicationDryRun,
  isReceptionOsEmailSendEnabled,
  isReceptionOsSmsSendEnabled,
} from "@/src/lib/receptionOs/receptionCommunicationDeliveryPolicy";
import {
  buildReceptionOsSystemStatus,
  type ReceptionOsSystemStatus,
} from "@/src/lib/receptionOs/receptionOsPilotStatusModel";
import type { ReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import {
  isEmailDeliveryConfigured,
  isSmsDeliveryConfigured,
} from "@/src/lib/reminders/reminderDeliveryConfig";
import { loadReminderDeliveryConfig } from "@/src/lib/reminders/reminderDeliveryConfig.server";

export function buildReceptionOsSystemStatusFromPayload(
  payload: Pick<ReceptionOsCommandCentrePayload, "loadedAt" | "endOfDayCloseout">
): ReceptionOsSystemStatus {
  const cfg = loadReminderDeliveryConfig();
  return buildReceptionOsSystemStatus({
    dryRunEnabled: isReceptionOsCommunicationDryRun(),
    emailSendEnabled: isReceptionOsEmailSendEnabled(),
    smsSendEnabled: isReceptionOsSmsSendEnabled(),
    resendConfigured: isEmailDeliveryConfigured(cfg),
    twilioConfigured: isSmsDeliveryConfigured(cfg),
    loadedAt: payload.loadedAt,
    closeout: payload.endOfDayCloseout,
  });
}
